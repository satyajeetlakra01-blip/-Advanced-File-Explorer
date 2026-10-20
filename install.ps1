# Advanced File Explorer - Windows Installer
# Usage: irm https://raw.githubusercontent.com/satyajeetlakra01-blip/-Advanced-File-Explorer/main/install.ps1 | iex

$ErrorActionPreference = 'Stop'

$REPO_OWNER  = 'satyajeetlakra01-blip'
$REPO_NAME   = '-Advanced-File-Explorer'
$APP_NAME    = 'Advanced File Explorer'
$INSTALL_DIR = Join-Path $env:LOCALAPPDATA 'Programs\AdvancedFileExplorer'
$START_MENU  = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'
$SHORTCUT    = Join-Path $START_MENU ($APP_NAME + '.lnk')

Write-Host ''
Write-Host '  ================================================' -ForegroundColor Cyan
Write-Host '       Advanced File Explorer - Installer         ' -ForegroundColor Cyan
Write-Host '  ================================================' -ForegroundColor Cyan
Write-Host ''

# ── Fetch latest release tag from GitHub ──────────────────────────────────────
Write-Host '  [1/4] Fetching latest release...' -ForegroundColor Yellow

$apiUrl  = 'https://api.github.com/repos/' + $REPO_OWNER + '/' + $REPO_NAME + '/releases/latest'
$headers = @{ 'User-Agent' = 'AFE-Installer' }

try {
    $release = Invoke-RestMethod -Uri $apiUrl -Headers $headers
    $tag     = $release.tag_name
    Write-Host "        Latest version: $tag" -ForegroundColor Green
} catch {
    $tag = 'v1.0.0'
    Write-Host "        Could not reach GitHub, defaulting to $tag" -ForegroundColor Yellow
}

# ── Build download URL ─────────────────────────────────────────────────────────
$setupFile   = 'Advanced-File-Explorer-Setup-x64.exe'
$downloadUrl = 'https://github.com/' + $REPO_OWNER + '/' + $REPO_NAME + '/releases/download/' + $tag + '/' + $setupFile

# Try to get URL from release assets if available
if ($release -and $release.assets) {
    $asset = $release.assets | Where-Object { $_.name -like '*Setup*x64*.exe' } | Select-Object -First 1
    if ($asset) { $downloadUrl = $asset.browser_download_url; $setupFile = $asset.name }
}

Write-Host "  [2/4] Downloading: $setupFile" -ForegroundColor Yellow
Write-Host "        From: $downloadUrl" -ForegroundColor Gray

# ── Download ──────────────────────────────────────────────────────────────────
$tmpFile = Join-Path $env:TEMP $setupFile
$ProgressPreference = 'SilentlyContinue'

try {
    Invoke-WebRequest -Uri $downloadUrl -OutFile $tmpFile -UseBasicParsing
    Write-Host '        Download complete!' -ForegroundColor Green
} catch {
    # Fallback: portable copy to INSTALL_DIR
    Write-Host '        Installer not found in releases yet.' -ForegroundColor Yellow
    Write-Host '        Setting up portable launcher instead...' -ForegroundColor Yellow

    if (-not (Test-Path $INSTALL_DIR)) {
        New-Item -ItemType Directory -Path $INSTALL_DIR -Force | Out-Null
    }

    # Write a placeholder launcher
    $launcher = Join-Path $INSTALL_DIR 'launch.bat'
    Set-Content -Path $launcher -Value "@echo off`r`necho Advanced File Explorer`r`necho Run: npm install && npm start`r`npause"

    $shell = New-Object -ComObject WScript.Shell
    $lnk   = $shell.CreateShortcut($SHORTCUT)
    $lnk.TargetPath       = $launcher
    $lnk.WorkingDirectory = $INSTALL_DIR
    $lnk.Description      = 'Advanced File Explorer'
    $lnk.Save()

    Write-Host ''
    Write-Host "  Shortcut added to Start Menu: $SHORTCUT" -ForegroundColor Green
    Write-Host "  Search 'Advanced File Explorer' in the Start Menu to launch." -ForegroundColor Cyan
    Write-Host ''
    exit 0
}

# ── Install ───────────────────────────────────────────────────────────────────
Write-Host '  [3/4] Installing (per-user, no admin required)...' -ForegroundColor Yellow

Start-Process -FilePath $tmpFile -ArgumentList '/S' -Wait

Write-Host '        Installation complete!' -ForegroundColor Green

# ── Cleanup ───────────────────────────────────────────────────────────────────
Remove-Item $tmpFile -Force -ErrorAction SilentlyContinue

# ── Done ──────────────────────────────────────────────────────────────────────
Write-Host '  [4/4] Done!' -ForegroundColor Green
Write-Host ''
Write-Host "  Press the Windows key and search: $APP_NAME" -ForegroundColor Cyan
Write-Host ''
Write-Host '  To uninstall: Go to Settings > Apps > Advanced File Explorer' -ForegroundColor Gray
Write-Host ''
