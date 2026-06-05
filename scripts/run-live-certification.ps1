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
$projectId = if ($env:E2E_RECIPLY_PROJECT_ID) { $env:E2E_RECIPLY_PROJECT_ID } else { "59bf67fb-2203-4f3a-82e7-07f31a7dc4ad" }
$payload = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String(($key.Split('.')[1] + ('=' * ((4 - ($key.Split('.')[1].Length % 4)) % 4))).Replace('-','+').Replace('_','/')))
$ref = ($payload | ConvertFrom-Json).ref
$base = "https://$ref.supabase.co/rest/v1"
$headers = @{
  apikey = $key
  Authorization = "Bearer $key"
}

$proj = Invoke-RestMethod -Uri "$base/projects?id=eq.$projectId&select=id,owner_id,name" -Headers $headers
if (-not $proj -or $proj.Count -eq 0) {
  $proj = Invoke-RestMethod -Uri "$base/projects?name=ilike.*reciply*&select=id,owner_id,name&limit=1" -Headers $headers
}
if (-not $proj -or $proj.Count -eq 0) { Write-Error "Project not found"; exit 1 }
$p = $proj[0]

Push-Location $root
npx tsx scripts/.live-cert-run.ts 2>&1
$code = $LASTEXITCODE
Pop-Location
exit $code
