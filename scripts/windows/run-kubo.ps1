param([Parameter(Mandatory)][string]$InstallRoot)

$ErrorActionPreference = 'Stop'
$env:IPFS_PATH = Join-Path $InstallRoot 'ipfs'
$ipfs = Join-Path $InstallRoot 'bin\kubo\ipfs.exe'
if (-not (Test-Path -LiteralPath $ipfs -PathType Leaf)) { throw "Kubo executable not found: $ipfs" }
& $ipfs daemon --enable-gc
exit $LASTEXITCODE
