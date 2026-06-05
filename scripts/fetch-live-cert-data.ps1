$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Get-Content (Join-Path $root ".env.local") | ForEach-Object {
  if ($_ -match '^([A-Z0-9_]+)=(.*)$') {
    if (-not (Test-Path "Env:$($matches[1])")) { Set-Item -Path "Env:$($matches[1])" -Value $matches[2].Trim('"', "'") }
  }
}
$key = $env:SUPABASE_SERVICE_ROLE_KEY
$b64 = $key.Split('.')[1].Replace('-', '+').Replace('_', '/')
$pad = '=' * ((4 - ($b64.Length % 4)) % 4)
$ref = (ConvertFrom-Json ([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($b64 + $pad)))).ref
$base = "https://$ref.supabase.co/rest/v1"
$h = @{ apikey = $key; Authorization = "Bearer $key" }
$projectId = "59bf67fb-2203-4f3a-82e7-07f31a7dc4ad"

$project = Invoke-RestMethod -Uri "$base/projects?id=eq.$projectId&select=id,name,owner_id,metadata" -Headers $h | Select-Object -First 1
$files = Invoke-RestMethod -Uri "$base/app_files?project_id=eq.$projectId&select=path,content&order=path.asc&limit=250" -Headers $h
$pub = Invoke-RestMethod -Uri "$base/published_apps?project_id=eq.$projectId&status=eq.published&select=project_id,slug,public_url,canonical_url,status,snapshot_files" -Headers $h | Select-Object -First 1
$auth = Invoke-RestMethod -Uri "$base/app_auth_provider_settings?project_id=eq.$projectId&select=*" -Headers $h | Select-Object -First 1
$integrations = Invoke-RestMethod -Uri "$base/app_integration_connections?project_id=eq.$projectId&select=provider,mode,status,last_test_status,last_error" -Headers $h
$tables = @('app_user_profiles','app_analytics_events','app_integration_connections','app_payment_events','published_apps')
$tableProbe = @{}
foreach ($t in $tables) {
  try {
    Invoke-RestMethod -Uri "$base/$t`?select=id&limit=1" -Headers $h | Out-Null
    $tableProbe[$t] = "ok"
  } catch {
    $tableProbe[$t] = $_.Exception.Message
  }
}
$allFilesMeta = Invoke-RestMethod -Uri "$base/app_files?project_id=eq.$projectId&select=id" -Headers $h

$out = @{
  project = $project
  fileCount = @($allFilesMeta).Count
  filesSample = @($files).Count
  published = $pub
  auth = $auth
  integrations = $integrations
  tableProbe = $tableProbe
}
$outPath = Join-Path $root "scripts/.live-cert-data.json"
$out | ConvertTo-Json -Depth 8 | Set-Content -Path $outPath -Encoding UTF8
if ($pub.snapshot_files) {
  $snapPath = Join-Path $root "scripts/.live-cert-snapshot.json"
  $pub.snapshot_files | ConvertTo-Json -Depth 3 -Compress | Set-Content -Path $snapPath -Encoding UTF8
}
Write-Output "wrote $outPath"
