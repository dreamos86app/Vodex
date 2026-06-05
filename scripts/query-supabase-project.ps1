$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root ".env.local"
Get-Content $envFile | ForEach-Object {
  if ($_ -match '^([A-Z0-9_]+)=(.*)$') {
    $name = $matches[1]
    $val = $matches[2].Trim('"', "'")
    if (-not (Test-Path "Env:$name")) { Set-Item -Path "Env:$name" -Value $val }
  }
}
$key = $env:SUPABASE_SERVICE_ROLE_KEY
$b64 = $key.Split('.')[1].Replace('-', '+').Replace('_', '/')
$pad = '=' * ((4 - ($b64.Length % 4)) % 4)
$ref = (ConvertFrom-Json ([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($b64 + $pad)))).ref
$base = "https://$ref.supabase.co/rest/v1"
$headers = @{ apikey = $key; Authorization = "Bearer $key" }
$projectId = if ($env:E2E_RECIPLY_PROJECT_ID) { $env:E2E_RECIPLY_PROJECT_ID } else { "59bf67fb-2203-4f3a-82e7-07f31a7dc4ad" }
try {
  $proj = Invoke-RestMethod -Uri "$base/projects?id=eq.$projectId&select=id,owner_id,name" -Headers $headers
} catch {
  Write-Output "ERR: $($_.Exception.Message)"
  exit 1
}
if (-not $proj -or @($proj).Count -eq 0) {
  $proj = Invoke-RestMethod -Uri "$base/projects?name=ilike.*reciply*&select=id,owner_id,name&limit=3" -Headers $headers
}
$proj | ConvertTo-Json -Compress
