# Advanced File Explorer - One-Command Windows Installer
# Usage: irm https://raw.githubusercontent.com/satyajeetlakra01-blip/-Advanced-File-Explorer/main/install.ps1 | iex

param(
    [string]$Version = "latest",
    [switch]$Portable,
    [switch]$Uninstall
)

$ErrorActionPreference = "Stop"

# ─── Config ───────────────────────────────────────────────────────────────────
$REPO        = "satyajeetlakra01-blip/-Advanced-File-Explorer"
$APP_NAME    = "Advanced File Explorer"
$PRODUCT_EXE = "Advanced File Explorer.exe"
$INSTALL_DIR = "$env:LOCALAPPDATA\Programs\AdvancedFileExplorer"
$SHORTCUT_DIR = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs"

# ─── Colors ───────────────────────────────────────────────────────────────────
function Write-Info  { param($msg) Write-Host "  [INFO]  $msg" -ForegroundColor Cyan }
function Write-Ok    { param($msg) Write-Host "  [OK]    $msg" -ForegroundColor Green }
function Write-Warn  { param($msg) Write-Host "  [WARN]  $msg" -ForegroundColor Yellow }
function Write-Err   { param($msg) Write-Host "  [ERROR] $msg" -ForegroundColor Red }

# ─── Banner ───────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "  ╔══════════════════════════════════════════════╗" -ForegroundColor Blue
Write-Host "  ║       Advanced File Explorer Installer       ║" -ForegroundColor Blue
Write-Host "  ║   github.com/$REPO   ║" -ForegroundColor Blue
Write-Host "  ╚══════════════════════════════════════════════╝" -ForegroundColor Blue
Write-Host ""

# ─── Uninstall mode ───────────────────────────────────────────────────────────
if ($Uninstall) {
    Write-Info "Uninstalling $APP_NAME..."
    $uninstaller = "$INSTALL_DIR\Uninstall Advanced File Explorer.exe"
    if (Test-Path $uninstaller) {
        Start-Process -FilePath $uninstaller -ArgumentList "/S" -Wait
        Write-Ok "Uninstalled successfully."
    } else {
        $shortcut = "$SHORTCUT_DIR\$APP_NAME.lnk"
        if (Test-Path $shortcut) { Remove-Item $shortcut -Force }
        if (Test-Path $INSTALL_DIR) { Remove-Item $INSTALL_DIR -Recurse -Force }
        Write-Ok "Removed portable installation."
    }
    exit 0
}

# ─── Fetch latest release from GitHub ─────────────────────────────────────────
Write-Info "Fetching latest release info from GitHub..."

try {
    $apiUrl = "https://api.github.com/repos/$REPO/releases/latest"
    $headers = @{ "User-Agent" = "AFE-Installer/1.0" }
    $release = Invoke-RestMethod -Uri $apiUrl -Headers $headers
    $tag = $release.tag_name
    Write-Ok "Latest version: $tag"
} catch {
    Write-Warn "Could not reach GitHub API. Trying to use the direct download URL..."
    $tag = "v1.0.0"
}

# ─── Select asset ─────────────────────────────────────────────────────────────
if ($Portable) {
    $assetPattern = "*Portable*x64*.exe"
    $assetLabel   = "Portable"
} else {
    $assetPattern = "*Setup*x64*.exe"
    $assetLabel   = "NSIS Installer"
}

$asset = $release.assets | Where-Object { $_.name -like $assetPattern } | Select-Object -First 1

if (-not $asset) {
    # Fallback: construct URL directly
    if ($Portable) {
        $downloadUrl = "https://github.com/$REPO/releases/download/$tag/Advanced-File-Explorer-Portable-x64.exe"
        $fileName    = "Advanced-File-Explorer-Portable-x64.exe"
    } else {
        $downloadUrl = "https://github.com/$REPO/releases/download/$tag/Advanced-File-Explorer-Setup-x64.exe"
        $fileName    = "Advanced-File-Explorer-Setup-x64.exe"
    }
} else {
    $downloadUrl = $asset.browser_download_url
    $fileName    = $asset.name
}

# ─── Download ─────────────────────────────────────────────────────────────────
$tmpDir  = [System.IO.Path]::GetTempPath()
$outFile = Join-Path $tmpDir $fileName

Write-Info "Downloading $assetLabel: $fileName"
Write-Info "From: $downloadUrl"

try {
    $ProgressPreference = 'SilentlyContinue'
    Invoke-WebRequest -Uri $downloadUrl -OutFile $outFile -UseBasicParsing
    Write-Ok "Download complete: $outFile"
} catch {
    Write-Err "Download failed: $_"
    Write-Err "Please download manually from: https://github.com/$REPO/releases"
    exit 1
}

# ─── Install ──────────────────────────────────────────────────────────────────
if ($Portable) {
    Write-Info "Setting up portable installation at: $INSTALL_DIR"
    
    if (-not (Test-Path $INSTALL_DIR)) {
        New-Item -ItemType Directory -Path $INSTALL_DIR -Force | Out-Null
    }
    
    Copy-Item $outFile "$INSTALL_DIR\$PRODUCT_EXE" -Force
    
    # Create Start Menu shortcut
    Write-Info "Creating Start Menu shortcut..."
    $WshShell  = New-Object -ComObject WScript.Shell
    $shortcut  = $WshShell.CreateShortcut("$SHORTCUT_DIR\$APP_NAME.lnk")
    $shortcut.TargetPath       = "$INSTALL_DIR\$PRODUCT_EXE"
    $shortcut.WorkingDirectory = $INSTALL_DIR
    $shortcut.Description      = "Advanced File Explorer - Modern desktop file manager"
    $shortcut.Save()
    
    Write-Ok "Portable version installed and added to Start Menu!"
} else {
    Write-Info "Running NSIS installer (per-user, no admin required)..."
    Start-Process -FilePath $outFile -ArgumentList "/S" -Wait
    Write-Ok "Installation complete! Advanced File Explorer added to Start Menu."
}

# ─── Cleanup temp file ────────────────────────────────────────────────────────
Remove-Item $outFile -Force -ErrorAction SilentlyContinue

# ─── Done ─────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "  ✅ Done! Press Win and search for '$APP_NAME' to launch." -ForegroundColor Green
Write-Host ""
Write-Info "To uninstall later, run:"
Write-Host "  irm https://raw.githubusercontent.com/$REPO/main/install.ps1 | iex -Args '-Uninstall'" -ForegroundColor Gray
Write-Host ""
