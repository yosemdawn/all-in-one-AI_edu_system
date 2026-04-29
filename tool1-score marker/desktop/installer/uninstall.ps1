$ErrorActionPreference = 'SilentlyContinue'

$targetRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$startMenuDir = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Score Marker'
$desktopShortcut = Join-Path ([Environment]::GetFolderPath('Desktop')) '智能批分助手.lnk'

Get-Process 'ScoreMarker.Desktop' -ErrorAction SilentlyContinue | Stop-Process -Force
Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique |
    ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }

Remove-Item $desktopShortcut -Force -ErrorAction SilentlyContinue
Remove-Item $startMenuDir -Recurse -Force -ErrorAction SilentlyContinue

Start-Sleep -Seconds 1
Remove-Item $targetRoot -Recurse -Force -ErrorAction SilentlyContinue
