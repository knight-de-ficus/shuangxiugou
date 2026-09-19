param([Parameter(Mandatory)][string]$InstallRoot)

$ErrorActionPreference = 'Stop'
$node = Join-Path $InstallRoot 'bin\node\node.exe'
$app = Join-Path $InstallRoot 'app'
if (-not (Test-Path -LiteralPath $node -PathType Leaf)) { throw "Node executable not found: $node" }

$ready = $false
for ($attempt = 0; $attempt -lt 60; $attempt++) {
    try {
        Invoke-WebRequest -UseBasicParsing -Method Post -Uri 'http://127.0.0.1:5001/api/v0/id' -TimeoutSec 2 | Out-Null
        $ready = $true
        break
    } catch {
        Start-Sleep -Seconds 2
    }
}
if (-not $ready) { throw 'Kubo RPC did not become ready within 120 seconds.' }

$env:MANIFEST_PATH = Join-Path $InstallRoot 'runtime\current.manifest.json'
$env:PUBLIC_KEY_PATH = Join-Path $InstallRoot 'secrets\publisher.pub.pem'
$env:STATE_PATH = Join-Path $InstallRoot 'runtime\verification-state.json'
$env:KUBO_GATEWAY_URL = 'http://127.0.0.1:8080'
$env:PORT = '8787'
Set-Location -LiteralPath $app
& $node 'tools\resilient-web\gateway.mjs'
exit $LASTEXITCODE
