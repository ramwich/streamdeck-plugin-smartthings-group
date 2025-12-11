# Create a zip and rename it to a .streamDeckPlugin file for Windows distribution
param(
  [string] $Version = "v0.1.0",
  [string] $BundleFolder = ".\StreamDeckSmartThings.sdPlugin"
)

$zipName = "StreamDeckSmartThings-$($Version).zip"
$pluginFileName = "com.ramwich.streamdeck.smartthings.streamDeckPlugin"  # adjust to your preferred identifier

if (-not (Test-Path $BundleFolder)) {
  Write-Error "Bundle folder $BundleFolder does not exist. Run build-sdplugin.ps1 first."
  exit 1
}

# Create zip of the bundle folder
Compress-Archive -Path $BundleFolder -DestinationPath $zipName -Force
Write-Host "Created zip: $zipName"

# Rename/copy the zip to the .streamDeckPlugin file (keep it as a zip archive but with .streamDeckPlugin extension)
Copy-Item -Path $zipName -Destination $pluginFileName -Force
Write-Host "Created plugin installer: $pluginFileName"

# Optional: To install to Stream Deck Plugins folder on Windows:
$dest = Join-Path $env:APPDATA "Elgato\StreamDeck\Plugins\$BundleFolder"
Remove-Item -Recurse -Force $dest -ErrorAction SilentlyContinue
Copy-Item -Recurse -Force $BundleFolder $dest
Write-Host "Installed plugin folder to $dest (restart Stream Deck if needed)"