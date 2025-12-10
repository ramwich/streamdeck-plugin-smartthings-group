#!/usr/bin/env pwsh
# Simple packer for Stream Deck plugin folder (Windows PowerShell)
# Run from repo root:
#   PowerShell -ExecutionPolicy RemoteSigned -File .\build-sdplugin.ps1
param(
  [string] $OutBundleName = "StreamDeckSmartThings.sdPlugin"
)

function Info($m){ Write-Host $m -ForegroundColor Cyan }
function Warn($m){ Write-Host $m -ForegroundColor Yellow }
function Err($m){ Write-Host $m -ForegroundColor Red }

# Ensure running from repo root (manifest.json must exist)
if (-not (Test-Path "./manifest.json")) {
  Err "manifest.json not found. Run this script from the repository root."
  exit 1
}

$FILES = @(
  "manifest.json",
  "README.md",
  "package.json",
  "propertyinspector.html",
  "propertyinspector.js",
  "src"
)

$outDir = Join-Path -Path (Get-Location) -ChildPath $OutBundleName

# Remove any existing bundle and recreate
if (Test-Path $outDir) {
  Info "Removing existing bundle: $outDir"
  Remove-Item -Recurse -Force $outDir
}

Info "Creating bundle directory: $outDir"
New-Item -ItemType Directory -Path $outDir | Out-Null

foreach ($f in $FILES) {
  if (Test-Path $f) {
    Info "Copying $f -> $OutBundleName"
    Copy-Item -Recurse -Force -Path $f -Destination $outDir
  } else {
    Warn "Warning: $f not found; skipping"
  }
}

Info "Built $outDir — double-click to install in Stream Deck or place it in the Stream Deck Plugins folder."