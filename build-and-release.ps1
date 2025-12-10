# Build + package + optionally create GitHub release (Windows PowerShell)
# Usage (from repo root):
# 1) Build only:   PowerShell -ExecutionPolicy RemoteSigned -File .\build-and-release.ps1 -BuildOnly -Version "v0.2.0"
# 2) Build + create a release with gh:
#    PowerShell -ExecutionPolicy RemoteSigned -File .\build-and-release.ps1 -CreateRelease -Version "v0.2.0" -ReleaseNotes "Initial group-enabled plugin"
param(
  [switch] $BuildOnly,
  [switch] $CreateRelease,
  [string] $Version = "v0.0.0",
  [string] $ReleaseNotes = ""
)

function Info($m){ Write-Host $m -ForegroundColor Cyan }
function Err($m){ Write-Host $m -ForegroundColor Red }

# Ensure manifest.json exists
if (-not (Test-Path "./manifest.json")) {
  Err "manifest.json not found. Run from repository root."
  exit 1
}

# Build .sdPlugin folder (calls the build script if present)
$bundleName = "StreamDeckSmartThings.sdPlugin"
if (Test-Path ".\build-sdplugin.ps1") {
  Info "Building bundle via build-sdplugin.ps1..."
  & PowerShell -ExecutionPolicy RemoteSigned -File .\build-sdplugin.ps1
} else {
  Err "build-sdplugin.ps1 not found. Please add the build script to the repo root."
  exit 1
}

# Ensure bundle exists
if (-not (Test-Path $bundleName)) {
  Err "Bundle $bundleName does not exist. Build failed."
  exit 1
}

# Package into a zip (include the bundle directory itself)
$zipName = "StreamDeckSmartThings-$($Version).zip"
if (Test-Path $zipName) { Remove-Item $zipName -Force }
Info "Creating zip: $zipName"
Compress-Archive -Path $bundleName -DestinationPath $zipName -Force

Info "Created $zipName"

if ($CreateRelease) {
  # Requires GitHub CLI (gh) authenticated and available in PATH with repo push permissions
  if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Err "gh CLI not found. Install GitHub CLI and run 'gh auth login' to authenticate."
    exit 1
  }
  if (-not $Version) {
    Err "Specify -Version (e.g. v0.2.0) to create a release"
    exit 1
  }
  Info "Creating GitHub release $Version and uploading $zipName"
  # Create release (notes may be empty)
  gh release create $Version $zipName -t $Version -n $ReleaseNotes
  Info "Release created (or updated) with asset $zipName"
}

Info "Done."