param(
    [string]$PublishDir = (Join-Path $PSScriptRoot '..\bin\Release\net9.0-windows\win-x64\publish'),
    [string]$PackageDir = (Join-Path $PSScriptRoot 'package-temp'),
    [string]$OutputDir = (Join-Path $PSScriptRoot '..\release')
)

$ErrorActionPreference = 'Stop'

$publishDir = [System.IO.Path]::GetFullPath($PublishDir)
$packageDir = [System.IO.Path]::GetFullPath($PackageDir)
$outputDir = [System.IO.Path]::GetFullPath($OutputDir)
$packageZip = Join-Path $packageDir 'app.zip'
$setupProject = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\setup\ScoreMarker.Setup.csproj'))
$setupEmbeddedPackageDir = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\setup\package'))
$setupEmbeddedPackageZip = Join-Path $setupEmbeddedPackageDir 'app.zip'
$setupPublishDir = Join-Path $PSScriptRoot '..\setup\bin\Release\net9.0-windows\win-x64\publish'
$finalInstaller = Join-Path $outputDir 'ScoreMarker-Setup.exe'

if (-not (Test-Path $publishDir)) {
    throw "Publish directory not found: $publishDir"
}

Remove-Item $packageDir -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path $packageDir -Force | Out-Null
New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
New-Item -ItemType Directory -Path $setupEmbeddedPackageDir -Force | Out-Null

New-Item -ItemType Directory -Path (Join-Path $packageDir 'app') -Force | Out-Null
robocopy $publishDir (Join-Path $packageDir 'app') /MIR /NFL /NDL /NJH /NJS /NP | Out-Null
Get-ChildItem (Join-Path $packageDir 'app') -Directory -Filter '*.WebView2' | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
Get-ChildItem (Join-Path $packageDir 'app') -Filter '*.pdb' -File | Remove-Item -Force -ErrorAction SilentlyContinue
Copy-Item (Join-Path $PSScriptRoot 'uninstall.ps1') (Join-Path $packageDir 'app\uninstall.ps1') -Force
if (Test-Path $packageZip) {
    Remove-Item $packageZip -Force
}
Compress-Archive -Path (Join-Path $packageDir 'app\*') -DestinationPath $packageZip
Copy-Item $packageZip $setupEmbeddedPackageZip -Force

dotnet publish $setupProject -c Release -r win-x64 --self-contained false `
    -p:PublishSingleFile=true `
    -p:IncludeNativeLibrariesForSelfExtract=true | Out-Null

$setupExe = Join-Path ([System.IO.Path]::GetFullPath($setupPublishDir)) 'ScoreMarker.Setup.exe'
if (-not (Test-Path $setupExe)) {
    throw "Setup executable not found: $setupExe"
}

Copy-Item $setupExe $finalInstaller -Force
Write-Output "Created installer: $finalInstaller"
