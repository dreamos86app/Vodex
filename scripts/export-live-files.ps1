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
$outPath = Join-Path $root "scripts/.live-cert-files.json"
$files | ConvertTo-Json -Depth 3 -Compress | Set-Content $outPath -Encoding UTF8
Write-Output "exported $(@($files).Count) files"
