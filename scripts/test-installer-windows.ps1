# Real Windows integration test, intended for the isolated GitHub Windows runner.
[CmdletBinding()]
param([Parameter(Mandatory = $true)][string]$Installer, [string]$LegacyInstaller = '')
$ErrorActionPreference = 'Stop'
if ($env:CI -ne 'true' -or -not $env:RUNNER_TEMP) {
    throw 'Execute somente no runner CI Windows isolado.'
}
if (Test-Path 'HKCU:\Software\AcessaWorkspace') {
    throw 'O runner ja possui uma instalacao. Teste cancelado para preserva-la.'
}
$installerPath = (Resolve-Path -LiteralPath $Installer).Path
$legacyInstallerPath = if ($LegacyInstaller) { (Resolve-Path -LiteralPath $LegacyInstaller).Path } else { $null }
$root = Join-Path $env:RUNNER_TEMP ('acessa-upgrade-' + [Guid]::NewGuid().ToString('N'))
$target = Join-Path $root 'Install with spaces'
$other = Join-Path $root 'Other installation'
$profile = Join-Path $env:APPDATA 'Acessa Workspace'
$sentinel = Join-Path $profile 'installer-ci-preserve.txt'
$sessionSentinel = Join-Path $profile 'session.enc'
$expectedExe = (Get-FileHash -Algorithm SHA256 -LiteralPath 'release\win-unpacked\Acessa Workspace.exe').Hash
$expectedAsar = (Get-FileHash -Algorithm SHA256 -LiteralPath 'release\win-unpacked\resources\app.asar').Hash
$legacy = $null
$unrelated = $null

function Assert-True([bool]$Condition, [string]$Message) {
    if (-not $Condition) { throw $Message }
}
function Run-Installer([bool]$SelectDirectory = $false) {
    $arguments = '/S'publique 
    # NSIS /D is last and intentionally unquoted; it consumes the remaining path.
    if ($SelectDirectory) { $arguments += ' /D=' + $target }
    $process = Start-Process -FilePath $installerPath -ArgumentList $arguments -PassThru -Wait
    return $process.ExitCode
}
function Assert-Payload {
    Assert-True ((Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $target 'Acessa Workspace.exe')).Hash -eq $expectedExe) 'Executavel instalado diverge do payload.'
    Assert-True ((Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $target 'resources\app.asar')).Hash -eq $expectedAsar) 'ASAR instalado diverge do payload.'
    Assert-True ((Get-Content -Raw -LiteralPath $sentinel) -eq 'keep-settings') 'Preferencias do usuario nao foram preservadas.'
    Assert-True ((Get-Content -Raw -LiteralPath $sessionSentinel) -eq 'encrypted-session-ci') 'Sessao do usuario nao foi preservada.'
}
try {
    New-Item -ItemType Directory -Path $root, $other, $profile -Force | Out-Null
    [IO.File]::WriteAllText($sentinel, 'keep-settings')
    [IO.File]::WriteAllText($sessionSentinel, 'encrypted-session-ci')
    if ($legacyInstallerPath) {
        $old = Start-Process -FilePath $legacyInstallerPath -ArgumentList ('/S /D=' + $target) -PassThru -Wait
        Assert-True ($old.ExitCode -eq 0) 'Instalacao legada falhou.'
        Assert-True ((Get-ItemProperty 'HKCU:\Software\AcessaWorkspace').InstallDir -eq $target) 'Fixture nao gravou InstallDir legado.'
        Assert-True ((Run-Installer) -eq 0) 'Migracao do instalador legado falhou.'
        Assert-True ((Get-ItemProperty 'HKCU:\Software\AcessaWorkspace').InstallLocation -eq $target) 'Migracao nao preservou a pasta antiga.'
    } else {
        Assert-True ((Run-Installer $true) -eq 0) 'Instalacao inicial falhou.'
    }
    Assert-Payload

    # Reproduce an older tray app that ignores the graceful quit argument.
    # Use two same-named processes to ensure only the selected install is closed.
    $fixture = Join-Path $root 'legacy-fixture.exe'
    Add-Type -TypeDefinition @'
using System;
public class LegacyIdleApp {
    public static void Main(string[] args) { System.Threading.Thread.Sleep(-1); }
}
'@ -OutputAssembly $fixture -OutputType ConsoleApplication
    Copy-Item -LiteralPath $fixture -Destination (Join-Path $target 'Acessa Workspace.exe') -Force
    Copy-Item -LiteralPath $fixture -Destination (Join-Path $other 'Acessa Workspace.exe') -Force
    $legacy = Start-Process -FilePath (Join-Path $target 'Acessa Workspace.exe') -WindowStyle Hidden -PassThru
    $unrelated = Start-Process -FilePath (Join-Path $other 'Acessa Workspace.exe') -WindowStyle Hidden -PassThru
    Start-Sleep -Milliseconds 750
    Assert-True ((Run-Installer) -eq 0) 'Atualizacao sobre a instalacao existente falhou.'
    $legacy.Refresh()
    $unrelated.Refresh()
    Assert-True $legacy.HasExited 'Processo antigo permaneceu aberto.'
    Assert-True (-not $unrelated.HasExited) 'Outra instalacao foi encerrada indevidamente.'
    Assert-Payload

    # A lock held by an unrelated process must abort BEFORE replacing any file.
    $marker = Join-Path $target 'LICENSE'
    [IO.File]::WriteAllText($marker, 'preserve-until-preflight-passes')
    $lock = [IO.File]::Open((Join-Path $target 'resources\app.asar'), [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::None)
    try {
        Assert-True ((Run-Installer) -ne 0) 'Setup ignorou um arquivo bloqueado.'
        Assert-True ((Get-Content -Raw -LiteralPath $marker) -eq 'preserve-until-preflight-passes') 'Setup alterou arquivos antes de concluir a verificacao.'
    } finally { $lock.Dispose() }
    Assert-True ((Run-Installer) -eq 0) 'Setup nao recuperou apos liberar o bloqueio.'
    Assert-Payload

    $uninstall = Start-Process -FilePath (Join-Path $target 'Uninstall Acessa Workspace.exe') -ArgumentList '/S' -Wait -PassThru
    Assert-True ($uninstall.ExitCode -eq 0) 'Desinstalacao falhou.'
    $deadline = [DateTime]::UtcNow.AddSeconds(30)
    while ((Test-Path -LiteralPath (Join-Path $target 'Acessa Workspace.exe')) -and [DateTime]::UtcNow -lt $deadline) { Start-Sleep -Milliseconds 250 }
    Assert-True (-not (Test-Path -LiteralPath (Join-Path $target 'Acessa Workspace.exe'))) 'Arquivos do aplicativo nao foram removidos.'
    Assert-True ((Get-Content -Raw -LiteralPath $sentinel) -eq 'keep-settings') 'Desinstalacao removeu dados do usuario.'
    Assert-True ((Get-Content -Raw -LiteralPath $sessionSentinel) -eq 'encrypted-session-ci') 'Desinstalacao removeu a sessao do usuario.'
    Write-Output 'Windows installer: fresh install, upgrade, exact-path process closure, lock recovery, payload integrity and preference preservation passed.'
} finally {
    foreach ($process in @($legacy, $unrelated)) {
        if ($process) { $process.Refresh(); if (-not $process.HasExited) { Stop-Process -Id $process.Id -Force } }
    }
    # Registry was absent before the test and belongs only to its temporary install.
    Remove-Item 'HKCU:\Software\AcessaWorkspace' -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\AcessaWorkspace' -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $root -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $sentinel -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $sessionSentinel -Force -ErrorAction SilentlyContinue
}
