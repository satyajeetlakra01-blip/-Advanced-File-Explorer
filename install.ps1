# Advanced File Explorer - Windows Installer
# Run this in PowerShell (Admin):
#   irm https://raw.githubusercontent.com/satyajeetlakra01-blip/-Advanced-File-Explorer/main/install.ps1 | iex

$ErrorActionPreference = 'Stop'

$repoOwner  = 'satyajeetlakra01-blip'
$repoName   = '-Advanced-File-Explorer'
$appName    = 'Advanced File Explorer'

$localAppData = [System.Environment]::GetEnvironmentVariable('LOCALAPPDATA')
$appData      = [System.Environment]::GetEnvironmentVariable('APPDATA')
$tempDir      = [System.Environment]::GetEnvironmentVariable('TEMP')

$installDir  = $localAppData + '\Programs\AdvancedFileExplorer'
$startMenu   = $appData + '\Microsoft\Windows\Start Menu\Programs'
$shortcutPath = $startMenu + '\' + $appName + '.lnk'

Write-Host ''
Write-Host '================================================' -ForegroundColor Cyan
Write-Host '    Advanced File Explorer - Installer          ' -ForegroundColor Cyan
Write-Host '================================================' -ForegroundColor Cyan
Write-Host ''

Write-Host '[1/4] Fetching latest release from GitHub...' -ForegroundColor Yellow

$apiUrl  = 'https://api.github.com/repos/' + $repoOwner + '/' + $repoName + '/releases/latest'
$headers = @{ 'User-Agent' = 'AFE-Installer-1.0' }
$tag     = 'v1.0.0'
$release = $null

try {
    $release = Invoke-RestMethod -Uri $apiUrl -Headers $headers
    $tag     = $release.tag_name
    Write-Host ('    Latest version: ' + $tag) -ForegroundColor Green
} catch {
    Write-Host ('    Could not reach GitHub API, using: ' + $tag) -ForegroundColor Yellow
}

$setupFile   = 'Advanced-File-Explorer-Setup-x64.exe'
$downloadUrl = 'https://github.com/' + $repoOwner + '/' + $repoName + '/releases/download/' + $tag + '/' + $setupFile

if ($release -and $release.assets) {
    $asset = $release.assets | Where-Object { $_.name -like '*Setup*x64*.exe' } | Select-Object -First 1
    if ($asset) {
        $downloadUrl = $asset.browser_download_url
        $setupFile   = $asset.name
    }
}

Write-Host ('[2/4] Downloading: ' + $setupFile) -ForegroundColor Yellow
Write-Host ('    URL: ' + $downloadUrl) -ForegroundColor Gray

$tmpFile = $tempDir + '\' + $setupFile
$ProgressPreference = 'SilentlyContinue'

try {
    Invoke-WebRequest -Uri $downloadUrl -OutFile $tmpFile -UseBasicParsing
    Write-Host '    Download complete.' -ForegroundColor Green

    Write-Host '[3/4] Running installer...' -ForegroundColor Yellow
    Start-Process -FilePath $tmpFile -ArgumentList '/S' -Wait
    Remove-Item $tmpFile -Force -ErrorAction SilentlyContinue
    Write-Host '    Installed!' -ForegroundColor Green

} catch {
    Write-Host '    No installer in Releases yet. Creating Start Menu shortcut...' -ForegroundColor Yellow

    if (-not (Test-Path $installDir)) {
        New-Item -ItemType Directory -Path $installDir -Force | Out-Null
    }

    $batPath = $installDir + '\launch.bat'
    $batContent = '@echo off' + [char]13 + [char]10
    $batContent += 'echo Advanced File Explorer' + [char]13 + [char]10
    $batContent += 'echo Clone repo and run: npm install && npm start' + [char]13 + [char]10
    $batContent += 'pause' + [char]13 + [char]10
    Set-Content -Path $batPath -Value $batContent -Encoding ASCII

    $shell = New-Object -ComObject WScript.Shell
    $lnk   = $shell.CreateShortcut($shortcutPath)
    $lnk.TargetPath       = $batPath
    $lnk.WorkingDirectory = $installDir
    $lnk.Description      = $appName
    $lnk.Save()
}

Write-Host '[4/4] Done!' -ForegroundColor Green
Write-Host ''
Write-Host ('Press Win key and search: ' + $appName) -ForegroundColor Cyan
Write-Host ''
