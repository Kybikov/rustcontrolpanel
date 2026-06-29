param(
    [string]$FrontendUrl = "https://rust.wtmelon.store",
    [string]$ApiBaseUrl = "https://go-api.wtmelon.store"
)

$ErrorActionPreference = "Stop"

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

$FrontendUrl = $FrontendUrl.TrimEnd("/")
$ApiBaseUrl = $ApiBaseUrl.TrimEnd("/")

$checks = @()
$checks += Assert-Status -Name "frontend:index" -Url $FrontendUrl -Expected 200
$checks += Assert-Status -Name "frontend:healthz" -Url "$FrontendUrl/healthz" -Expected 200
$config = Assert-Status -Name "frontend:config" -Url "$FrontendUrl/config.js" -Expected 200 -Headers @{"Cache-Control" = "no-cache"}
$checks += $config

if ($config.Content -notmatch [regex]::Escape($ApiBaseUrl)) {
    throw "frontend:config does not contain expected API base URL: $ApiBaseUrl"
}

$assetMatch = [regex]::Match($checks[0].Content, 'src="(/assets/[^"]+\.js)"')
if (-not $assetMatch.Success) {
    throw "frontend:index does not reference a JS asset"
}
$assetPath = $assetMatch.Groups[1].Value
$asset = Assert-Status -Name "frontend:asset" -Url "$FrontendUrl$assetPath" -Expected 200
$checks += $asset
if ($asset.Content -notmatch "/api/admin/rustcontrol") {
    throw "frontend:asset does not contain RustControl API paths"
}

$checks += Assert-Status -Name "api:health" -Url "$ApiBaseUrl/health" -Expected 200
$checks += Assert-Status -Name "api:catalog" -Url "$ApiBaseUrl/api/v1/catalog" -Expected 200

$corsHeaders = @{
    Origin = $FrontendUrl
    "Access-Control-Request-Method" = "POST"
    "Access-Control-Request-Headers" = "authorization,content-type"
}
$cors = Assert-Status -Name "api:cors" -Method "OPTIONS" -Url "$ApiBaseUrl/api/admin/auth/login" -Expected 204 -Headers $corsHeaders
$checks += $cors
if ($cors.Headers["Access-Control-Allow-Headers"] -notmatch "Authorization") {
    throw "api:cors does not allow Authorization header"
}

$checks += Assert-Status -Name "api:auth-invalid" -Method "POST" -Url "$ApiBaseUrl/api/admin/auth/login" -Expected 401 -Body '{"email":"release-check@example.invalid","password":"invalid"}'
$checks += Assert-Status -Name "api:rustcontrol-protected" -Url "$ApiBaseUrl/api/admin/rustcontrol/realtime/health" -Expected 401
$checks += Assert-Status -Name "api:rustcontrol-webhook-unsigned" -Method "POST" -Url "$ApiBaseUrl/webhooks/rustcontrol/00000000-0000-0000-0000-000000000000/events" -Expected 401 -Body '{"event_type":"release_probe","source":"smoke-production"}'

$checks |
    Select-Object Name, Status, Length |
    Format-Table -AutoSize

Write-Host "Smoke check passed for $FrontendUrl -> $ApiBaseUrl"
