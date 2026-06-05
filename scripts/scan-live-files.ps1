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
$files = Invoke-RestMethod -Uri "$base/app_files?project_id=eq.$projectId&select=path,content&order=path.asc&limit=250" -Headers $h
$combined = ($files | ForEach-Object { $_.content }) -join "`n"
$hits = @()
if ($combined -match 'SUPABASE_SERVICE_ROLE|sk_live_|sk-proj-') { $hits += 'secret_pattern' }
if ($combined -match '(?i)\bservice_role\b') { $hits += 'service_role_word' }
if ($combined -match '(?i)\bTODO\b') { $hits += 'todo' }
if ($combined -match '(?i)lorem ipsum') { $hits += 'lorem' }
if ($combined -match 'wciioegiczwqlmlroley') { $hits += 'legacy_ref' }
if ($combined -match 'xycqutvqxtkbszytaxbe') { $hits += 'platform_ref' }
@{ fileRows = @($files).Count; hits = $hits } | ConvertTo-Json
