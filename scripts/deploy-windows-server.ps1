[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [ValidatePattern('^([A-Za-z0-9-]+\.)*[A-Za-z0-9-]+$')]
    [string]$Domain,

    [ValidatePattern('^$|^[^@\s]+@[^@\s]+\.[^@\s]+$')]
    [string]$Email = '',

    [string]$InstallRoot = (Join-Path $env:ProgramData 'ShuangxiuGo'),

    [ValidateRange(0, [int]::MaxValue)]
    [int]$Sequence = 0,

    [switch]$SkipFirewall
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$NodeVersion = '22.22.0'
$KuboVersion = '0.43.1'
$CaddyVersion = '2.10.2'
$TaskNames = @('ShuangxiuGo-Kubo', 'ShuangxiuGo-Gateway', 'ShuangxiuGo-Caddy')
$FirewallGroup = 'ShuangxiuGo Resilient Web'
$CreatedFirewallRules = [System.Collections.Generic.List[string]]::new()
$StartedProcess = $null
$DeploymentSucceeded = $false
$AppSwapped = $false
$Timestamp = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ')

function Write-Step([string]$Message) { Write-Host "[shuangxiugou] $Message" -ForegroundColor Cyan }
function Write-WarningMessage([string]$Message) { Write-Warning "[shuangxiugou] $Message" }

function Assert-Administrator {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = [Security.Principal.WindowsPrincipal]::new($identity)
    if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        throw 'Run this script in an elevated PowerShell window (Run as administrator).'
    }
}

function Invoke-Native {
    param([Parameter(Mandatory)][string]$FilePath, [Parameter()][string[]]$ArgumentList = @())
    & $FilePath @ArgumentList
    if ($LASTEXITCODE -ne 0) { throw "$FilePath exited with code $LASTEXITCODE" }
}

function Get-VerifiedArchive {
    param(
        [Parameter(Mandatory)][string]$Uri,
        [Parameter(Mandatory)][string]$ChecksumUri,
        [Parameter(Mandatory)][string]$FileName,
        [Parameter(Mandatory)][ValidateSet('SHA256', 'SHA512')][string]$Algorithm,
        [Parameter(Mandatory)][string]$Destination
    )
    Invoke-WebRequest -UseBasicParsing -Uri $Uri -OutFile $Destination
    $checksumResponse = Invoke-WebRequest -UseBasicParsing -Uri $ChecksumUri
    $checksumText = if ($checksumResponse.Content -is [byte[]]) {
        [Text.Encoding]::UTF8.GetString($checksumResponse.Content)
    } else {
        [string]$checksumResponse.Content
    }
    $escapedName = [regex]::Escape($FileName)
    $match = [regex]::Match($checksumText, "(?im)^([0-9a-f]+)\s+\*?$escapedName\s*$")
    if (-not $match.Success) { throw "Could not find $FileName in checksum list $ChecksumUri" }
    $actual = (Get-FileHash -LiteralPath $Destination -Algorithm $Algorithm).Hash
    if ($actual -ne $match.Groups[1].Value.ToUpperInvariant()) {
        throw "Checksum mismatch for $FileName"
    }
}

function Install-ArchiveDirectory {
    param([string]$Archive, [string]$ExpandedRelativePath, [string]$Destination)
    $expandRoot = Join-Path $TempRoot ([guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $expandRoot -Force | Out-Null
    Expand-Archive -LiteralPath $Archive -DestinationPath $expandRoot -Force
    $source = if ($ExpandedRelativePath) { Join-Path $expandRoot $ExpandedRelativePath } else { $expandRoot }
    if (-not (Test-Path -LiteralPath $source)) { throw "Expected archive content is missing: $ExpandedRelativePath" }
    if (Test-Path -LiteralPath $Destination) { Remove-Item -LiteralPath $Destination -Recurse -Force }
    New-Item -ItemType Directory -Path (Split-Path -Parent $Destination) -Force | Out-Null
    Move-Item -LiteralPath $source -Destination $Destination
}

function Wait-Kubo {
    for ($attempt = 0; $attempt -lt 60; $attempt++) {
        try {
            Invoke-WebRequest -UseBasicParsing -Method Post -Uri 'http://127.0.0.1:5001/api/v0/id' -TimeoutSec 2 | Out-Null
            return
        } catch { Start-Sleep -Seconds 2 }
    }
    throw 'Kubo RPC did not become ready within 120 seconds.'
}

function Register-ServiceTask {
    param([string]$Name, [string]$ScriptName)
    $scriptPath = Join-Path $InstallRoot "scripts\$ScriptName"
    $arguments = "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File `"$scriptPath`" -InstallRoot `"$InstallRoot`""
    $action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $arguments
    $trigger = New-ScheduledTaskTrigger -AtStartup
    $principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
        -RestartCount 10 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) `
        -StartWhenAvailable
    Register-ScheduledTask -TaskName $Name -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
}

function Add-FirewallRule {
    param([string]$Name, [string]$Protocol, [string]$Port)
    $existing = Get-NetFirewallRule -DisplayName $Name -ErrorAction SilentlyContinue
    if ($null -eq $existing) {
        New-NetFirewallRule -DisplayName $Name -Group $FirewallGroup -Direction Inbound -Action Allow `
            -Enabled True -Profile Any -Protocol $Protocol -LocalPort $Port | Out-Null
        $CreatedFirewallRules.Add($Name)
    }
}

function Protect-AdminDirectory([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path)) { return }
    & icacls.exe $Path '/inheritance:r' '/grant:r' '*S-1-5-18:(OI)(CI)F' '*S-1-5-32-544:(OI)(CI)F' '/T' '/C' | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Could not secure ACLs on $Path" }
}

Assert-Administrator
$os = Get-CimInstance Win32_OperatingSystem
if ($os.ProductType -eq 1 -or [int]$os.BuildNumber -lt 17763) {
    throw 'This installer supports Windows Server 2019 or newer.'
}
if (-not [Environment]::Is64BitOperatingSystem) { throw 'A 64-bit Windows Server installation is required.' }

$RepoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$InstallRoot = [IO.Path]::GetFullPath($InstallRoot)
if ([IO.Path]::GetPathRoot($InstallRoot) -eq $InstallRoot) { throw 'InstallRoot cannot be a drive root.' }
if (-not (Test-Path -LiteralPath (Join-Path $RepoRoot 'package-lock.json'))) { throw "Project checkout not found: $RepoRoot" }

$BackupRoot = Join-Path $InstallRoot "backups\$Timestamp"
$TempRoot = Join-Path $InstallRoot "staging\$Timestamp"
$OldAppBackup = Join-Path $BackupRoot 'app'
$TaskBackup = Join-Path $BackupRoot 'tasks'
$RuntimePath = Join-Path $InstallRoot 'runtime'
$SecretsPath = Join-Path $InstallRoot 'secrets'
$AppPath = Join-Path $InstallRoot 'app'

New-Item -ItemType Directory -Path $BackupRoot, $TempRoot, $TaskBackup -Force | Out-Null
Protect-AdminDirectory $BackupRoot
foreach ($path in @($RuntimePath, $SecretsPath, (Join-Path $InstallRoot 'config'), `
    (Join-Path $InstallRoot 'bin'), (Join-Path $InstallRoot 'scripts'))) {
    if (Test-Path -LiteralPath $path) {
        Copy-Item -LiteralPath $path -Destination $BackupRoot -Recurse -Force
    }
}
if (Test-Path -LiteralPath (Join-Path $InstallRoot 'ipfs\config')) {
    New-Item -ItemType Directory -Path (Join-Path $BackupRoot 'ipfs') -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $InstallRoot 'ipfs\config') -Destination (Join-Path $BackupRoot 'ipfs\config') -Force
}
foreach ($taskName in $TaskNames) {
    $task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    if ($null -ne $task) {
        Export-ScheduledTask -TaskName $taskName | Set-Content -LiteralPath (Join-Path $TaskBackup "$taskName.xml") -Encoding Unicode
        Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    }
}
Write-Step "Backup created at $BackupRoot"

try {
    New-Item -ItemType Directory -Path (Join-Path $InstallRoot 'bin'), $RuntimePath, $SecretsPath, `
        (Join-Path $InstallRoot 'config'), (Join-Path $InstallRoot 'scripts'), `
        (Join-Path $InstallRoot 'caddy-data'), (Join-Path $InstallRoot 'caddy-config') -Force | Out-Null

    Write-Step 'Downloading pinned Node.js, Kubo and Caddy releases and verifying checksums.'
    $nodeAsset = "node-v$NodeVersion-win-x64.zip"
    $nodeArchive = Join-Path $TempRoot $nodeAsset
    Get-VerifiedArchive -Uri "https://nodejs.org/dist/v$NodeVersion/$nodeAsset" `
        -ChecksumUri "https://nodejs.org/dist/v$NodeVersion/SHASUMS256.txt" -FileName $nodeAsset `
        -Algorithm SHA256 -Destination $nodeArchive
    Install-ArchiveDirectory -Archive $nodeArchive -ExpandedRelativePath "node-v$NodeVersion-win-x64" `
        -Destination (Join-Path $InstallRoot 'bin\node')

    $kuboAsset = "kubo_v$KuboVersion`_windows-amd64.zip"
    $kuboArchive = Join-Path $TempRoot $kuboAsset
    Get-VerifiedArchive -Uri "https://dist.ipfs.tech/kubo/v$KuboVersion/$kuboAsset" `
        -ChecksumUri "https://dist.ipfs.tech/kubo/v$KuboVersion/$kuboAsset.sha512" -FileName $kuboAsset `
        -Algorithm SHA512 -Destination $kuboArchive
    Install-ArchiveDirectory -Archive $kuboArchive -ExpandedRelativePath 'kubo' `
        -Destination (Join-Path $InstallRoot 'bin\kubo')

    $caddyAsset = "caddy_$($CaddyVersion)_windows_amd64.zip"
    $caddyArchive = Join-Path $TempRoot $caddyAsset
    Get-VerifiedArchive -Uri "https://github.com/caddyserver/caddy/releases/download/v$CaddyVersion/$caddyAsset" `
        -ChecksumUri "https://github.com/caddyserver/caddy/releases/download/v$CaddyVersion/caddy_$($CaddyVersion)_checksums.txt" `
        -FileName $caddyAsset -Algorithm SHA512 -Destination $caddyArchive
    Install-ArchiveDirectory -Archive $caddyArchive -ExpandedRelativePath '' `
        -Destination (Join-Path $InstallRoot 'bin\caddy')

    $StagedApp = Join-Path $TempRoot 'app'
    New-Item -ItemType Directory -Path $StagedApp -Force | Out-Null
    $exclude = @('/E', '/NFL', '/NDL', '/NJH', '/NJS', '/NP', '/XD', '.git', 'node_modules', 'dist', `
        (Join-Path $RepoRoot 'deploy\resilient\runtime'), (Join-Path $RepoRoot 'deploy\resilient\secrets'))
    & robocopy.exe $RepoRoot $StagedApp @exclude | Out-Null
    if ($LASTEXITCODE -ge 8) { throw "robocopy failed with code $LASTEXITCODE" }

    $node = Join-Path $InstallRoot 'bin\node\node.exe'
    $npm = Join-Path $InstallRoot 'bin\node\npm.cmd'
    $env:PATH = "$(Join-Path $InstallRoot 'bin\node');$env:PATH"
    Push-Location -LiteralPath $StagedApp
    try {
        Write-Step 'Installing locked dependencies, linting, testing and building the site.'
        Invoke-Native $npm @('ci')
        Invoke-Native $npm @('run', 'lint')
        Invoke-Native $npm @('run', 'build')
        Invoke-Native $npm @('run', 'test:resweb')
    } finally { Pop-Location }

    if (Test-Path -LiteralPath $AppPath) { Move-Item -LiteralPath $AppPath -Destination $OldAppBackup }
    Move-Item -LiteralPath $StagedApp -Destination $AppPath
$AppSwapped = $true

    Get-ChildItem -LiteralPath (Join-Path $RepoRoot 'scripts\windows') -Filter '*.ps1' -File |
        Copy-Item -Destination (Join-Path $InstallRoot 'scripts') -Force
    $emailDirective = if ($Email) { "`n    email $Email" } else { '' }
    $caddyConfig = @"
{$emailDirective
    servers {
        protocols h1 h2 h3
        strict_sni_host on
    }
}

$Domain {
    encode zstd gzip
    reverse_proxy 127.0.0.1:8787
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
        X-Content-Type-Options "nosniff"
        Content-Security-Policy "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; font-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'"
        Permissions-Policy "camera=(), microphone=(), geolocation=()"
        Referrer-Policy "strict-origin-when-cross-origin"
        -Server
    }
}
"@
    [IO.File]::WriteAllText((Join-Path $InstallRoot 'config\Caddyfile'), $caddyConfig, [Text.UTF8Encoding]::new($false))

    $env:IPFS_PATH = Join-Path $InstallRoot 'ipfs'
    $ipfs = Join-Path $InstallRoot 'bin\kubo\ipfs.exe'
    if (-not (Test-Path -LiteralPath (Join-Path $env:IPFS_PATH 'config'))) {
        Invoke-Native $ipfs @('init', '--profile=server')
    }
    Invoke-Native $ipfs @('config', 'Addresses.API', '/ip4/127.0.0.1/tcp/5001')
    Invoke-Native $ipfs @('config', 'Addresses.Gateway', '/ip4/127.0.0.1/tcp/8080')
    Invoke-Native $ipfs @('config', '--json', 'Addresses.Swarm', `
        '["/ip4/0.0.0.0/tcp/4001","/ip4/0.0.0.0/udp/4001/quic-v1","/ip6/::/tcp/4001","/ip6/::/udp/4001/quic-v1"]')

    $StartedProcess = Start-Process -FilePath $ipfs -WindowStyle Hidden -PassThru -ArgumentList 'daemon', '--enable-gc'
    Wait-Kubo

    $privateKey = Join-Path $SecretsPath 'publisher.private.pem'
    $publicKey = Join-Path $SecretsPath 'publisher.pub.pem'
    if (-not (Test-Path -LiteralPath $privateKey) -or -not (Test-Path -LiteralPath $publicKey)) {
        Write-WarningMessage 'Creating the bootstrap publisher key on this server. Move the private key offline after deployment.'
        Invoke-Native $node @((Join-Path $AppPath 'tools\resilient-web\cli.mjs'), 'keygen', `
            '--private', $privateKey, '--public', $publicKey)
    }
    Protect-AdminDirectory $SecretsPath

    $sequenceFile = Join-Path $RuntimePath 'sequence.txt'
    if ($Sequence -eq 0) {
        $previousSequence = 0
        if (Test-Path -LiteralPath $sequenceFile) {
            $parsedSequence = 0
            if ([int]::TryParse((Get-Content -LiteralPath $sequenceFile -Raw).Trim(), [ref]$parsedSequence)) {
                $previousSequence = $parsedSequence
            }
        }
        $Sequence = $previousSequence + 1
    }

    $publishArgs = @((Join-Path $AppPath 'tools\resilient-web\cli.mjs'), 'publish', '--sequence', "$Sequence", `
        '--site', (Join-Path $AppPath 'dist'), '--private-key', $privateKey, `
        '--output', (Join-Path $RuntimePath 'current.manifest.json'), '--gateways', "https://$Domain")
    $previousFile = Join-Path $RuntimePath 'last-manifest-cid.txt'
    if (Test-Path -LiteralPath $previousFile) {
        $previousCid = (Get-Content -LiteralPath $previousFile -Raw).Trim()
        if ($previousCid) { $publishArgs += @('--previous', $previousCid) }
    }
    Write-Step "Publishing signed sequence $Sequence."
    $publishOutput = & $node @publishArgs
    if ($LASTEXITCODE -ne 0) { throw 'Publishing failed.' }
    $publish = ($publishOutput -join "`n") | ConvertFrom-Json
    if (-not $publish.manifestCid -or -not $publish.contentCid) { throw 'Publisher output did not contain CIDs.' }
    Set-Content -LiteralPath $sequenceFile -Value $Sequence -Encoding Ascii
    Set-Content -LiteralPath $previousFile -Value $publish.manifestCid -Encoding Ascii

    foreach ($taskName in $TaskNames) {
        Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
    }
    Register-ServiceTask -Name 'ShuangxiuGo-Kubo' -ScriptName 'run-kubo.ps1'
    Register-ServiceTask -Name 'ShuangxiuGo-Gateway' -ScriptName 'run-gateway.ps1'
    Register-ServiceTask -Name 'ShuangxiuGo-Caddy' -ScriptName 'run-caddy.ps1'

    if ($null -ne $StartedProcess -and -not $StartedProcess.HasExited) {
        Stop-Process -Id $StartedProcess.Id -Force -ErrorAction SilentlyContinue
        Wait-Process -Id $StartedProcess.Id -Timeout 10 -ErrorAction SilentlyContinue
        $StartedProcess = $null
    }
    Start-ScheduledTask -TaskName 'ShuangxiuGo-Kubo'
    Wait-Kubo
    Start-ScheduledTask -TaskName 'ShuangxiuGo-Gateway'
    Start-Sleep -Seconds 3
    Start-ScheduledTask -TaskName 'ShuangxiuGo-Caddy'

    if (-not $SkipFirewall) {
        Add-FirewallRule -Name 'ShuangxiuGo Web TCP 80' -Protocol TCP -Port 80
        Add-FirewallRule -Name 'ShuangxiuGo Web TCP 443' -Protocol TCP -Port 443
        Add-FirewallRule -Name 'ShuangxiuGo HTTP3 UDP 443' -Protocol UDP -Port 443
        Add-FirewallRule -Name 'ShuangxiuGo IPFS TCP 4001' -Protocol TCP -Port 4001
        Add-FirewallRule -Name 'ShuangxiuGo IPFS UDP 4001' -Protocol UDP -Port 4001
        Write-Step 'Opened TCP 80/443/4001 and UDP 443/4001 in Windows Defender Firewall.'
    } else {
        Write-WarningMessage 'Windows Defender Firewall changes were skipped.'
    }

    $ready = $false
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        try {
            $response = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:8787/_resilient/readyz' -TimeoutSec 3
            if ($response.StatusCode -eq 200) { $ready = $true; break }
        } catch { Start-Sleep -Seconds 2 }
    }
    if (-not $ready) { throw 'Local verified gateway did not become ready.' }

    try {
        $addresses = Resolve-DnsName -Name $Domain -Type A_AAAA -ErrorAction Stop |
            Where-Object { $_.IPAddress } | Select-Object -ExpandProperty IPAddress -Unique
        Write-Step "DNS addresses for ${Domain}: $($addresses -join ', ')"
    } catch {
        Write-WarningMessage "DNS does not currently resolve $Domain. Add A/AAAA records before public HTTPS can succeed."
    }
    try {
        Invoke-WebRequest -UseBasicParsing -Uri "https://$Domain/_resilient/readyz" -TimeoutSec 15 | Out-Null
        Write-Step 'Public HTTPS readiness check passed.'
    } catch {
        Write-WarningMessage 'Public HTTPS is not reachable yet. Check DNS, cloud security groups, public NAT and TCP/UDP 443.'
    }

    $DeploymentSucceeded = $true
    Write-Step "Deployment complete. Sequence=$Sequence ManifestCID=$($publish.manifestCid)"
    Write-WarningMessage "Bootstrap private key is at $privateKey. Move it off the public server for production publishing."
}
catch {
    Write-WarningMessage "Deployment failed: $($_.Exception.Message)"
    if ($null -ne $StartedProcess -and -not $StartedProcess.HasExited) {
        Stop-Process -Id $StartedProcess.Id -Force -ErrorAction SilentlyContinue
        Wait-Process -Id $StartedProcess.Id -Timeout 10 -ErrorAction SilentlyContinue
    }
    foreach ($taskName in $TaskNames) {
        Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
        Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
    }
    foreach ($ruleName in $CreatedFirewallRules) {
        Remove-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
    }
    if ($AppSwapped) {
        if (Test-Path -LiteralPath $AppPath) { Remove-Item -LiteralPath $AppPath -Recurse -Force }
        if (Test-Path -LiteralPath $OldAppBackup) { Copy-Item -LiteralPath $OldAppBackup -Destination $AppPath -Recurse -Force }
    }
    foreach ($name in @('runtime', 'secrets', 'config', 'bin', 'scripts')) {
        $current = Join-Path $InstallRoot $name
        $backup = Join-Path $BackupRoot $name
        if (Test-Path -LiteralPath $backup) {
            if (Test-Path -LiteralPath $current) { Remove-Item -LiteralPath $current -Recurse -Force }
            Copy-Item -LiteralPath $backup -Destination $current -Recurse -Force
        }
    }
    $ipfsConfigBackup = Join-Path $BackupRoot 'ipfs\config'
    if (Test-Path -LiteralPath $ipfsConfigBackup) {
        Copy-Item -LiteralPath $ipfsConfigBackup -Destination (Join-Path $InstallRoot 'ipfs\config') -Force
    }
    Protect-AdminDirectory $SecretsPath
    foreach ($taskName in $TaskNames) {
        $taskXml = Join-Path $TaskBackup "$taskName.xml"
        if (Test-Path -LiteralPath $taskXml) {
            Register-ScheduledTask -TaskName $taskName -Xml (Get-Content -LiteralPath $taskXml -Raw) -Force | Out-Null
            Start-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
        }
    }
    Write-WarningMessage "Rollback attempted. Backup retained at $BackupRoot"
    throw
}
finally {
    if ($DeploymentSucceeded -and (Test-Path -LiteralPath $TempRoot)) {
        Remove-Item -LiteralPath $TempRoot -Recurse -Force
    }
}
