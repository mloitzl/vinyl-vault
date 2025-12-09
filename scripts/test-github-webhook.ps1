# Test GitHub App Installation Webhook Locally
# This script invokes the webhook endpoint with the payload and headers from GitHub

# Configuration
$webHookUrl = "http://localhost:3001/webhook/github"
$webhookSecret = $env:GITHUB_APP_WEBHOOK_SECRET

# GitHub Webhook Payload
$payload = @{
    "action"       = "created"
    "installation" = @{
        "id"                        = 98758777
        "client_id"                 = "Iv23liccdkLWv60TFjSx"
        "account"                   = @{
            "login"          = "loitzl-labs"
            "id"             = 248348527
            "node_id"        = "O_kgDODs1_bw"
            "avatar_url"     = "https://avatars.githubusercontent.com/u/248348527?v=4"
            "gravatar_id"    = ""
            "url"            = "https://api.github.com/users/loitzl-labs"
            "html_url"       = "https://github.com/loitzl-labs"
            "type"           = "Organization"
            "user_view_type" = "public"
            "site_admin"     = $false
        }
        "repository_selection"      = "selected"
        "access_tokens_url"         = "https://api.github.com/app/installations/98758777/access_tokens"
        "repositories_url"          = "https://api.github.com/installation/repositories"
        "html_url"                  = "https://github.com/organizations/loitzl-labs/settings/installations/98758777"
        "app_id"                    = 2434327
        "app_slug"                  = "vinyl-vault-multiuser"
        "target_id"                 = 248348527
        "target_type"               = "Organization"
        "permissions"               = @{
            "members" = "read"
        }
        "events"                    = @()
        "created_at"                = "2025-12-09T16:34:09.000+01:00"
        "updated_at"                = "2025-12-09T16:34:09.000+01:00"
        "single_file_name"          = $null
        "has_multiple_single_files" = $false
        "single_file_paths"         = @()
        "suspended_by"              = $null
        "suspended_at"              = $null
    }
    "repositories" = @()
    "requester"    = $null
    "sender"       = @{
        "login"          = "mloitzl"
        "id"             = 12655223
        "node_id"        = "MDQ6VXNlcjEyNjU1MjIz"
        "avatar_url"     = "https://avatars.githubusercontent.com/u/12655223?v=4"
        "gravatar_id"    = ""
        "url"            = "https://api.github.com/users/mloitzl"
        "html_url"       = "https://github.com/mloitzl"
        "type"           = "User"
        "user_view_type" = "public"
        "site_admin"     = $false
    }
}

# Convert payload to JSON
$payloadJson = $payload | ConvertTo-Json -Depth 10

# Calculate HMAC SHA-256 signature if webhook secret is available
$signature = $null
if ($webhookSecret) {
    $hmac = New-Object System.Security.Cryptography.HMACSHA256
    $hmac.Key = [Text.Encoding]::UTF8.GetBytes($webhookSecret)
    $hashBytes = $hmac.ComputeHash([Text.Encoding]::UTF8.GetBytes($payloadJson))
    $signature = "sha256=" + (($hashBytes | ForEach-Object { $_.ToString("x2") }) -join '')
}

# GitHub Headers
$headers = @{
    "Accept"                                 = "*/*"
    "Content-Type"                           = "application/json"
    "User-Agent"                             = "GitHub-Hookshot/5c4e7bf"
    "X-GitHub-Delivery"                      = "8147e480-d514-11f0-8b54-7497615a8372"
    "X-GitHub-Event"                         = "installation"
    "X-GitHub-Hook-ID"                       = "585246226"
    "X-GitHub-Hook-Installation-Target-ID"   = "2434327"
    "X-GitHub-Hook-Installation-Target-Type" = "integration"
}

# Add computed signature if available
if ($signature) {
    $headers["X-Hub-Signature-256"] = $signature
}

Write-Host "╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║       GitHub App Installation Webhook Local Test               ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""
Write-Host "📍 Webhook URL: $webHookUrl" -ForegroundColor Yellow
Write-Host "📦 Payload Size: $($payloadJson.Length) bytes" -ForegroundColor Yellow
Write-Host "🔑 Webhook Secret: $(if ($webhookSecret) { 'Loaded from env' } else { '⚠️ NOT SET - signature verification will fail' })" -ForegroundColor $(if ($webhookSecret) { 'Green' } else { 'Red' })
Write-Host ""

if (-not $webhookSecret) {
    Write-Host "⚠️  WARNING: GITHUB_APP_WEBHOOK_SECRET environment variable not set!" -ForegroundColor Red
    Write-Host "   The webhook signature verification will fail unless you add it." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "   To set it, run:" -ForegroundColor Yellow
    Write-Host "   `$env:GITHUB_APP_WEBHOOK_SECRET='your-secret-here'" -ForegroundColor Gray
    Write-Host ""
}

Write-Host "📨 Sending webhook request..." -ForegroundColor Cyan
Write-Host ""

try {
    $response = Invoke-WebRequest `
        -Uri $webHookUrl `
        -Method POST `
        -Headers $headers `
        -Body $payloadJson `
        -ContentType "application/json" `
        -ErrorAction Stop

    Write-Host "✅ REQUEST SUCCESSFUL" -ForegroundColor Green
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
    Write-Host "Status Code: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "Response Headers:" -ForegroundColor Cyan
    $response.Headers | ForEach-Object { 
        Write-Host "  $($_): $($response.Headers[$_])" -ForegroundColor Gray
    }
    Write-Host ""
    Write-Host "Response Body:" -ForegroundColor Cyan
    if ($response.Content) {
        $responseBody = $response.Content | ConvertFrom-Json -ErrorAction SilentlyContinue
        if ($responseBody) {
            $responseBody | ConvertTo-Json -Depth 5 | ForEach-Object { Write-Host "  $_" }
        }
        else {
            Write-Host "  $($response.Content)" -ForegroundColor Gray
        }
    }
    else {
        Write-Host "  (empty body)" -ForegroundColor Gray
    }
    Write-Host ""
    Write-Host "✅ Webhook payload delivered successfully!" -ForegroundColor Green

}
catch {
    Write-Host "❌ REQUEST FAILED" -ForegroundColor Red
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    
    if ($_.Exception.Response) {
        $statusCode = [int]$_.Exception.Response.StatusCode
        Write-Host "Status Code: $statusCode" -ForegroundColor Red
        Write-Host ""
        
        try {
            $errorBody = $_.Exception.Response.Content.ReadAsStream() | ForEach-Object { [System.IO.StreamReader]::new($_).ReadToEnd() }
            if ($errorBody) {
                Write-Host "Response Body:" -ForegroundColor Cyan
                Write-Host "  $errorBody" -ForegroundColor Gray
            }
        }
        catch {
            Write-Host "(Could not read error response body)" -ForegroundColor Gray
        }
    }
    Write-Host ""
    Write-Host "Troubleshooting:" -ForegroundColor Yellow
    Write-Host "  1. Ensure BFF is running on http://localhost:3001" -ForegroundColor Gray
    Write-Host "  2. Check GITHUB_APP_WEBHOOK_SECRET is correctly set" -ForegroundColor Gray
    Write-Host "  3. Review BFF logs for webhook processing errors" -ForegroundColor Gray
    Write-Host "  4. Verify webhook endpoint is registered: POST /webhook/github" -ForegroundColor Gray
}

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "Webhook Test Complete" -ForegroundColor Cyan
