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
$owner = "82681c97-83d4-4c2b-9b54-060e2ef70c79"
$p1 = Invoke-RestMethod -Uri "$base/projects?id=eq.$projectId&select=id,name,owner_id" -Headers $h
$p2 = Invoke-RestMethod -Uri "$base/projects?id=eq.$projectId&owner_id=eq.$owner&select=id,name,owner_id" -Headers $h
$pub = Invoke-RestMethod -Uri "$base/published_apps?project_id=eq.$projectId&select=slug,public_url,canonical_url,status" -Headers $h
$auth = Invoke-RestMethod -Uri "$base/app_auth_provider_settings?project_id=eq.$projectId&select=last_auth_error,google_enabled" -Headers $h
@{ project = $p1; withOwner = $p2; published = $pub; auth = $auth } | ConvertTo-Json -Depth 5
