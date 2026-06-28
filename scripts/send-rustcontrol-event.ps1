param(
    [Parameter(Mandatory = $true)]
    [string]$WebhookUrl,

    [Parameter(Mandatory = $true)]
    [string]$Secret,

    [string]$BattleMetricsServerId = "39442578",
    [string]$ServerName = "RustControl Local Test",
    [string]$PlayerSteamId = "76561198000000000",
    [string]$RelatedSteamId = "76561198000000001"
)

$payload = [ordered]@{
    event_type = "local_hmac_test"
    severity = "info"
    source = "local-script"
    server = [ordered]@{
        battlemetrics_server_id = $BattleMetricsServerId
        name = $ServerName
        ip = "127.0.0.1"
        port = 28015
        status = "online"
    }
    player = [ordered]@{
        steam_id = $PlayerSteamId
        name = "test-offender"
        clan_tag = "TST"
        team_id = "local-team-1"
        is_online = $true
        position = [ordered]@{
            x = 1234.0
            y = 14.5
            z = -480.0
        }
        map_grid = "J12"
        health = 87
        sleeping = $false
    }
    related_players = @(
        [ordered]@{
            steam_id = $RelatedSteamId
            name = "test-mate"
            team_id = "local-team-1"
            evidence_type = "same_team_snapshot"
            reason = "same live Rust team from local script"
            score_delta = 40
        }
    )
    payload = [ordered]@{
        message = "RustControl local webhook test"
        generated_by = "scripts/send-rustcontrol-event.ps1"
    }
    occurred_at = (Get-Date).ToUniversalTime().ToString("o")
}

$json = $payload | ConvertTo-Json -Depth 8 -Compress
$secretBytes = [System.Text.Encoding]::UTF8.GetBytes($Secret)
$bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($json)
$hmac = [System.Security.Cryptography.HMACSHA256]::new($secretBytes)
try {
    $hash = $hmac.ComputeHash($bodyBytes)
    $signature = -join ($hash | ForEach-Object { $_.ToString("x2") })
}
finally {
    $hmac.Dispose()
}

$headers = @{
    "Content-Type" = "application/json"
    "X-RustControl-Signature" = "sha256=$signature"
}

Write-Host "POST $WebhookUrl"
Invoke-RestMethod -Method Post -Uri $WebhookUrl -Headers $headers -Body $json
