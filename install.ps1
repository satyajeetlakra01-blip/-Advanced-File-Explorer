# Advanced File Explorer - Windows Installer
# Run in PowerShell (Admin):
#   irm https://raw.githubusercontent.com/satyajeetlakra01-blip/-Advanced-File-Explorer/main/install.ps1 | iex

$ErrorActionPreference = 'Stop'

$repoOwner  = 'satyajeetlakra01-blip'
$repoName   = '-Advanced-File-Explorer'
$appName    = 'Advanced File Explorer'
$cloneUrl   = 'https://github.com/' + $repoOwner + '/' + $repoName + '.git'

$localAppData = [System.Environment]::GetEnvironmentVariable('LOCALAPPDATA')
$appData      = [System.Environment]::GetEnvironmentVariable('APPDATA')
$tempDir      = [System.Environment]::GetEnvironmentVariable('TEMP')

$installDir   = $localAppData + '\Programs\AdvancedFileExplorer'
$startMenu    = $appData + '\Microsoft\Windows\Start Menu\Programs'
$shortcutPath = $startMenu + '\' + $appName + '.lnk'

Write-Host ''
Write-Host '================================================' -ForegroundColor Cyan
Write-Host '    Advanced File Explorer - Installer          ' -ForegroundColor Cyan
Write-Host '================================================' -ForegroundColor Cyan
Write-Host ''

# Step 1 - Try to get pre-built installer from GitHub Releases first
Write-Host '[1/4] Checking GitHub Releases for pre-built installer...' -ForegroundColor Yellow

$apiUrl  = 'https://api.github.com/repos/' + $repoOwner + '/' + $repoName + '/releases/latest'
$headers = @{ 'User-Agent' = 'AFE-Installer-1.0' }
$release = $null
$tag     = 'v1.0.0'

try {
    $release = Invoke-RestMethod -Uri $apiUrl -Headers $headers
    $tag     = $release.tag_name
} catch {
    Write-Host '    Could not reach GitHub API.' -ForegroundColor Yellow
}

$setupFile   = 'Advanced-File-Explorer-Setup-x64.exe'
$downloadUrl = 'https://github.com/' + $repoOwner + '/' + $repoName + '/releases/download/' + $tag + '/' + $setupFile
$hasRelease  = $false

if ($release -and $release.assets) {
    $asset = $release.assets | Where-Object { $_.name -like '*Setup*x64*.exe' } | Select-Object -First 1
    if ($asset) {
        $downloadUrl = $asset.browser_download_url
        $setupFile   = $asset.name
        $hasRelease  = $true
        Write-Host ('    Found release: ' + $tag) -ForegroundColor Green
    }
}

if ($hasRelease) {
    # Download and run NSIS installer
    Write-Host ('[2/4] Downloading: ' + $setupFile) -ForegroundColor Yellow
    $tmpFile = $tempDir + '\' + $setupFile
    $ProgressPreference = 'SilentlyContinue'
    Invoke-WebRequest -Uri $downloadUrl -OutFile $tmpFile -UseBasicParsing
    Write-Host '    Download complete.' -ForegroundColor Green

    Write-Host '[3/4] Installing...' -ForegroundColor Yellow
    Start-Process -FilePath $tmpFile -ArgumentList '/S' -Wait
    Remove-Item $tmpFile -Force -ErrorAction SilentlyContinue
    Write-Host '    Installed via NSIS installer!' -ForegroundColor Green

} else {
    # No release yet - clone repo and set up from source
    Write-Host '    No pre-built installer found. Setting up from source...' -ForegroundColor Yellow

    Write-Host '[2/4] Cloning repository...' -ForegroundColor Yellow

    if (-not (Test-Path $installDir)) {
        New-Item -ItemType Directory -Path $installDir -Force | Out-Null
    }

    $appDir = $installDir + '\app'

    if (Test-Path ($appDir + '\.git')) {
        Write-Host '    Repo already cloned. Pulling latest...' -ForegroundColor Gray
        & git -C $appDir pull
    } else {
        if (Test-Path $appDir) { Remove-Item $appDir -Recurse -Force }
        & git clone $cloneUrl $appDir
    }

    Write-Host '[3/4] Installing Node.js dependencies (this may take a minute)...' -ForegroundColor Yellow
    & npm install --prefix $appDir

    # Create a VBScript silent launcher (no terminal window flash)
    $vbsPath = $installDir + '\launch.vbs'
    $vbsContent  = 'Set WshShell = CreateObject("WScript.Shell")' + [char]13 + [char]10
    $vbsContent += 'WshShell.CurrentDirectory = "' + $appDir + '"' + [char]13 + [char]10
    $vbsContent += 'WshShell.Run "cmd /c npm run dev", 0, False' + [char]13 + [char]10
    Set-Content -Path $vbsPath -Value $vbsContent -Encoding ASCII

    # Create Start Menu shortcut pointing to VBScript launcher
    $iconUrl  = 'https://raw.githubusercontent.com/' + $repoOwner + '/' + $repoName + '/main/assets/icon.ico'
    $iconPath = $installDir + '\icon.ico'
    try {
        $ProgressPreference = 'SilentlyContinue'
        Invoke-WebRequest -Uri $iconUrl -OutFile $iconPath -UseBasicParsing
    } catch {
        $iconPath = ''
    }

    $shell = New-Object -ComObject WScript.Shell
    $lnk   = $shell.CreateShortcut($shortcutPath)
    $lnk.TargetPath       = 'wscript.exe'
    $lnk.Arguments        = '"' + $vbsPath + '"'
    $lnk.WorkingDirectory = $appDir
    $lnk.Description      = $appName
    if ($iconPath -and (Test-Path $iconPath)) {
        $lnk.IconLocation = $iconPath + ',0'
    }
    $lnk.Save()

    Write-Host '    Source setup complete!' -ForegroundColor Green
}

Write-Host '[4/4] Done!' -ForegroundColor Green
Write-Host ''
Write-Host ('Search the Start Menu for: ' + $appName) -ForegroundColor Cyan
Write-Host ''
