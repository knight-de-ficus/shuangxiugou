param([Parameter(Mandatory)][string]$InstallRoot)

$ErrorActionPreference = 'Stop'
$caddy = Join-Path $InstallRoot 'bin\caddy\caddy.exe'
$config = Join-Path $InstallRoot 'config\Caddyfile'
if (-not (Test-Path -LiteralPath $caddy -PathType Leaf)) { throw "Caddy executable not found: $caddy" }
$env:XDG_DATA_HOME = Join-Path $InstallRoot 'caddy-data'
$env:XDG_CONFIG_HOME = Join-Path $InstallRoot 'caddy-config'
& $caddy run --config $config --adapter caddyfile
exit $LASTEXITCODE
