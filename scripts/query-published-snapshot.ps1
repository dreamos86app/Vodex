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
$pub = Invoke-RestMethod -Uri "$base/published_apps?project_id=eq.$projectId&select=snapshot_files,slug" -Headers $h | Select-Object -First 1
$snap = $pub.snapshot_files
@{ slug = $pub.slug; snapshotCount = if ($snap) { @($snap).Count } else { 0 }; samplePaths = if ($snap) { @($snap | Select-Object -First 10 | ForEach-Object { $_.path }) } else { @() } } | ConvertTo-Json
