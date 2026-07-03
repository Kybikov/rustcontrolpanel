param(
    [string]$BackendDir = "",
    [int]$BackendPort = 18080,
    [int]$FrontendPort = 4176,
    [string]$DatabaseUrl = "",
    [string]$RedisUrl = "",
    [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"

$frontendRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
if (-not $BackendDir) {
    $BackendDir = Resolve-Path (Join-Path $frontendRoot "..\wtbackend-go")
}
else {
    $BackendDir = Resolve-Path $BackendDir
}

$frontendUrl = "http://127.0.0.1:$FrontendPort"
$apiBaseUrl = "http://127.0.0.1:$BackendPort"
$runId = [Guid]::NewGuid().ToString("N")
$backendOut = Join-Path $env:TEMP "rustcp-backend-$runId.out.log"
$backendErr = Join-Path $env:TEMP "rustcp-backend-$runId.err.log"
$frontendOut = Join-Path $env:TEMP "rustcp-frontend-$runId.out.log"
$frontendErr = Join-Path $env:TEMP "rustcp-frontend-$runId.err.log"
$backendExe = Join-Path $env:TEMP "rustcp-backend-$runId.exe"
$managedProcesses = @()

function Test-PortOpen {
    param([string]$HostName, [int]$Port, [int]$TimeoutMs = 1000)
    $client = [System.Net.Sockets.TcpClient]::new()
    try {
        $result = $client.BeginConnect($HostName, $Port, $null, $null)
        if (-not $result.AsyncWaitHandle.WaitOne($TimeoutMs)) {
            return $false
        }
        $client.EndConnect($result)
        return $true
    }
    catch {
        return $false
    }
    finally {
        $client.Close()
    }
}

function Get-FreePort {
    param([string]$Name, [int]$Preferred)
    for ($port = $Preferred; $port -lt ($Preferred + 100); $port++) {
        if (-not (Test-PortOpen -HostName "127.0.0.1" -Port $port -TimeoutMs 300)) {
            if ($port -ne $Preferred) {
                Write-Host "$Name port $Preferred is busy; using $port"
            }
            return $port
        }
    }
    throw "No free $Name port found in range $Preferred-$($Preferred + 99)."
}

function Read-DotEnv {
    param([string]$Path)
    $result = @{}
    if (-not (Test-Path -LiteralPath $Path)) {
        return $result
    }
    foreach ($line in Get-Content -LiteralPath $Path) {
        if ($line -notmatch '^\s*([^#=\s]+)\s*=\s*(.*)\s*$') {
            continue
        }
        $key = $matches[1].Trim()
        $value = $matches[2].Trim()
        if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
            $value = $value.Substring(1, $value.Length - 2)
        }
        $result[$key] = $value
    }
    return $result
}

function Get-Endpoint {
    param([string]$Value, [int]$DefaultPort)
    if (-not $Value) {
        return $null
    }
    try {
        $uri = [Uri]$Value
        $port = if ($uri.Port -gt 0) { $uri.Port } else { $DefaultPort }
        return [pscustomobject]@{ Host = $uri.Host; Port = $port }
    }
    catch {
        $pairs = @{}
        foreach ($match in [regex]::Matches($Value, '(\w+)=([^\s]+)')) {
            $pairs[$match.Groups[1].Value.ToLowerInvariant()] = $match.Groups[2].Value
        }
        if ($pairs.Count -gt 0) {
            $hostName = if ($pairs["host"]) { $pairs["host"] } else { "localhost" }
            $port = if ($pairs["port"]) { [int]$pairs["port"] } else { $DefaultPort }
            return [pscustomobject]@{ Host = $hostName; Port = $port }
        }
    }
    return $null
}

function Assert-EndpointOpen {
    param([string]$Name, [object]$Endpoint, [string]$Hint)
    if (-not $Endpoint) {
        return
    }
    if (-not (Test-PortOpen -HostName $Endpoint.Host -Port $Endpoint.Port -TimeoutMs 1500)) {
        throw "$Name endpoint $($Endpoint.Host):$($Endpoint.Port) is not reachable. $Hint"
    }
}

function Read-LogTail {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) {
        return ""
    }
    return (Get-Content -LiteralPath $Path -Tail 80 -ErrorAction SilentlyContinue) -join [Environment]::NewLine
}

function Invoke-WithEnv {
    param(
        [hashtable]$Env,
        [scriptblock]$Action
    )
    $previous = @{}
    foreach ($key in $Env.Keys) {
        $previous[$key] = [Environment]::GetEnvironmentVariable($key, "Process")
        [Environment]::SetEnvironmentVariable($key, [string]$Env[$key], "Process")
    }
    try {
        & $Action
    }
    finally {
        foreach ($key in $Env.Keys) {
            [Environment]::SetEnvironmentVariable($key, $previous[$key], "Process")
        }
    }
}

function Start-ManagedProcess {
    param(
        [string]$Name,
        [string]$FilePath,
        [string[]]$ArgumentList,
        [string]$WorkingDirectory,
        [hashtable]$Env,
        [string]$StdOut,
        [string]$StdErr
    )
    $process = Invoke-WithEnv -Env $Env -Action {
        $params = @{
            FilePath = $FilePath
            WorkingDirectory = $WorkingDirectory
            WindowStyle = "Hidden"
            RedirectStandardOutput = $StdOut
            RedirectStandardError = $StdErr
            PassThru = $true
        }
        if ($ArgumentList -and $ArgumentList.Count -gt 0) {
            $params.ArgumentList = $ArgumentList
        }
        Start-Process @params
    }
    $script:managedProcesses += [pscustomobject]@{
        Name = $Name
        Process = $process
        StdOut = $StdOut
        StdErr = $StdErr
    }
    return $process
}

function Stop-ManagedProcesses {
    foreach ($entry in [array]$script:managedProcesses) {
        $process = $entry.Process
        if ($process -and -not $process.HasExited) {
            Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
        }
    }
}

function Wait-HttpStatus {
    param(
        [string]$Name,
        [string]$Url,
        [int[]]$Expected,
        [int]$TimeoutSec = 45,
        [object]$Process = $null,
        [string]$StdOut = "",
        [string]$StdErr = ""
    )
    $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSec)
    $lastError = ""
    while ([DateTime]::UtcNow -lt $deadline) {
        if ($Process -and $Process.HasExited) {
            throw "$Name process exited early with code $($Process.ExitCode).`nSTDOUT:`n$(Read-LogTail $StdOut)`nSTDERR:`n$(Read-LogTail $StdErr)"
        }
        try {
            $response = Invoke-WebRequest -Method GET -Uri $Url -TimeoutSec 3 -UseBasicParsing
            if ($Expected -contains [int]$response.StatusCode) {
                return $response
            }
            $lastError = "got status $($response.StatusCode)"
        }
        catch {
            $lastError = $_.Exception.Message
        }
        Start-Sleep -Milliseconds 500
    }
    throw "$Name did not reach expected status $($Expected -join ',') at $Url. Last error: $lastError"
}

function Assert-Status {
    param(
        [string]$Name,
        [string]$Method = "GET",
        [string]$Url,
        [int[]]$Expected,
        [hashtable]$Headers = @{},
        [string]$Body = $null,
        [string]$ContentType = "application/json"
    )
    try {
        $params = @{
            Method = $Method
            Uri = $Url
            Headers = $Headers
            TimeoutSec = 20
            UseBasicParsing = $true
        }
        if ($PSBoundParameters.ContainsKey("Body")) {
            $params.Body = $Body
            $params.ContentType = $ContentType
        }
        $response = Invoke-WebRequest @params
        $status = [int]$response.StatusCode
        $content = $response.Content
        $responseHeaders = $response.Headers
    }
    catch {
        if ($_.Exception.Response) {
            $status = [int]$_.Exception.Response.StatusCode
            $stream = $_.Exception.Response.GetResponseStream()
            $content = ""
            if ($stream) {
                $reader = [System.IO.StreamReader]::new($stream)
                try { $content = $reader.ReadToEnd() } finally { $reader.Dispose() }
            }
            $responseHeaders = $_.Exception.Response.Headers
        }
        else {
            throw
        }
    }

    if ($Expected -notcontains $status) {
        throw "$Name expected $($Expected -join ',') but got $status from $Url"
    }

    [pscustomobject]@{
        Name = $Name
        Status = $status
        Length = if ($null -ne $content) { $content.Length } else { 0 }
        Content = $content
        Headers = $responseHeaders
    }
}

try {
    $BackendPort = Get-FreePort -Name "Backend" -Preferred $BackendPort
    $FrontendPort = Get-FreePort -Name "Frontend" -Preferred $FrontendPort
    $frontendUrl = "http://127.0.0.1:$FrontendPort"
    $apiBaseUrl = "http://127.0.0.1:$BackendPort"

    $backendDotEnv = Read-DotEnv -Path (Join-Path $BackendDir ".env")
    $backendEnv = @{}
    foreach ($key in $backendDotEnv.Keys) {
        $backendEnv[$key] = $backendDotEnv[$key]
    }
    $backendOverrides = @{
        APP_ENV = "development"
        APP_MODE = "api"
        APP_PORT = [string]$BackendPort
        PORT = [string]$BackendPort
        CORS_ALLOWED_ORIGINS = $frontendUrl
        LOG_LEVEL = "warn"
    }
    foreach ($key in $backendOverrides.Keys) {
        $backendEnv[$key] = $backendOverrides[$key]
    }
    if ($DatabaseUrl) {
        $backendEnv["DB_URL"] = $DatabaseUrl
    }
    if ($RedisUrl) {
        $backendEnv["REDIS_URL"] = $RedisUrl
    }

    Assert-EndpointOpen `
        -Name "Database" `
        -Endpoint (Get-Endpoint -Value $backendEnv["DB_URL"] -DefaultPort 5432) `
        -Hint "Start the Postgres port-forward or pass -DatabaseUrl."
    Assert-EndpointOpen `
        -Name "Redis" `
        -Endpoint (Get-Endpoint -Value $backendEnv["REDIS_URL"] -DefaultPort 6379) `
        -Hint "Start the Redis port-forward or pass -RedisUrl."

    if (-not $SkipBuild) {
        Push-Location $frontendRoot
        try {
            npm.cmd run build
        }
        finally {
            Pop-Location
        }
    }

    Push-Location $BackendDir
    try {
        & go build -o $backendExe ./cmd/server
        if ($LASTEXITCODE -ne 0) {
            throw "Backend build failed with exit code $LASTEXITCODE"
        }
    }
    finally {
        Pop-Location
    }

    $backendProcess = Start-ManagedProcess `
        -Name "backend" `
        -FilePath $backendExe `
        -ArgumentList @() `
        -WorkingDirectory $BackendDir `
        -Env $backendEnv `
        -StdOut $backendOut `
        -StdErr $backendErr
    Wait-HttpStatus -Name "backend:health" -Url "$apiBaseUrl/health" -Expected @(200) -TimeoutSec 90 -Process $backendProcess -StdOut $backendOut -StdErr $backendErr | Out-Null

    $frontendProcess = Start-ManagedProcess `
        -Name "frontend" `
        -FilePath "node" `
        -ArgumentList @("server.mjs") `
        -WorkingDirectory $frontendRoot `
        -Env @{ PORT = [string]$FrontendPort; API_BASE_URL = $apiBaseUrl } `
        -StdOut $frontendOut `
        -StdErr $frontendErr
    Wait-HttpStatus -Name "frontend:healthz" -Url "$frontendUrl/healthz" -Expected @(200) -TimeoutSec 30 -Process $frontendProcess -StdOut $frontendOut -StdErr $frontendErr | Out-Null

    $checks = @()
    $checks += Assert-Status -Name "frontend:index" -Url $frontendUrl -Expected 200
    $checks += Assert-Status -Name "frontend:healthz" -Url "$frontendUrl/healthz" -Expected 200
    $config = Assert-Status -Name "frontend:config" -Url "$frontendUrl/config.js" -Expected 200 -Headers @{"Cache-Control" = "no-cache"}
    $checks += $config
    if ($config.Content -notmatch [regex]::Escape($apiBaseUrl)) {
        throw "frontend:config does not contain expected API base URL: $apiBaseUrl"
    }

    $assetMatch = [regex]::Match($checks[0].Content, 'src="(/assets/[^"]+\.js)"')
    if (-not $assetMatch.Success) {
        throw "frontend:index does not reference a JS asset"
    }
    $assetPath = $assetMatch.Groups[1].Value
    $asset = Assert-Status -Name "frontend:asset" -Url "$frontendUrl$assetPath" -Expected 200
    $checks += $asset
    if ($asset.Content -notmatch "/api/admin/rustcontrol") {
        throw "frontend:asset does not contain RustControl API paths"
    }

    $checks += Assert-Status -Name "api:health" -Url "$apiBaseUrl/health" -Expected 200
    $checks += Assert-Status -Name "api:catalog" -Url "$apiBaseUrl/api/v1/catalog" -Expected 200

    $corsHeaders = @{
        Origin = $frontendUrl
        "Access-Control-Request-Method" = "POST"
        "Access-Control-Request-Headers" = "authorization,content-type"
    }
    $cors = Assert-Status -Name "api:cors" -Method "OPTIONS" -Url "$apiBaseUrl/api/admin/auth/login" -Expected 204 -Headers $corsHeaders
    $checks += $cors
    if ($cors.Headers["Access-Control-Allow-Headers"] -notmatch "Authorization") {
        throw "api:cors does not allow Authorization header"
    }

    $checks += Assert-Status -Name "api:auth-invalid" -Method "POST" -Url "$apiBaseUrl/api/admin/auth/login" -Expected 401 -Body '{"email":"local-stack-smoke@example.invalid","password":"invalid"}'
    $checks += Assert-Status -Name "api:rustcontrol-protected" -Url "$apiBaseUrl/api/admin/rustcontrol/realtime/health" -Expected 401
    if ([string]::IsNullOrWhiteSpace($backendEnv["RUSTPLUS_WEBHOOK_SECRET"])) {
        $checks += Assert-Status -Name "api:rustcontrol-webhook-not-configured" -Method "POST" -Url "$apiBaseUrl/webhooks/rustcontrol/11111111-1111-1111-1111-111111111111/events" -Expected 400 -Body '{"event_type":"local_stack_probe","source":"smoke-local-stack"}'
    }
    else {
        $checks += Assert-Status -Name "api:rustcontrol-webhook-unsigned" -Method "POST" -Url "$apiBaseUrl/webhooks/rustcontrol/11111111-1111-1111-1111-111111111111/events" -Expected 401 -Body '{"event_type":"local_stack_probe","source":"smoke-local-stack"}'
    }

    $checks |
        Select-Object Name, Status, Length |
        Format-Table -AutoSize

    Write-Host "Local stack smoke passed for $frontendUrl -> $apiBaseUrl"
    Write-Host "Backend log: $backendOut"
    Write-Host "Frontend log: $frontendOut"
}
finally {
    Stop-ManagedProcesses
    try {
        if ([System.IO.File]::Exists($backendExe)) {
            [System.IO.File]::Delete($backendExe)
        }
    }
    catch {
        Write-Warning "Could not remove temporary backend executable: $($_.Exception.Message)"
    }
}
