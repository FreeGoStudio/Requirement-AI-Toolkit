param(
  [string]$RepoUrl = "https://github.com/FreeGoStudio/Requirement-AI-Toolkit.git",
  [string]$Branch = "main",
  [string]$CodexHome = $env:CODEX_HOME,
  [string]$InstallRoot = (Join-Path $env:LOCALAPPDATA "Requirement-AI-Toolkit"),
  [switch]$NoBackup,
  [ValidateSet("prd", "prd-setup")]
  [string]$SkillName = "prd"
)

$ErrorActionPreference = "Stop"

function Assert-CommandExists {
  param([string]$Name)
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Required command not found: $Name. Please install Git and try again."
  }
}

Assert-CommandExists "git"
Assert-CommandExists "python"
if ($NoBackup) { throw '-NoBackup is retired; retain recovery history outside skill loading roots.' }

if (-not $CodexHome -or $CodexHome.Trim() -eq "") {
  $CodexHome = Join-Path $env:USERPROFILE ".codex"
}

$repoDir = Join-Path $InstallRoot "repo"
New-Item -ItemType Directory -Force -Path $InstallRoot | Out-Null

if (Test-Path -LiteralPath (Join-Path $repoDir ".git") -PathType Container) {
  $changes = git -C $repoDir status --porcelain --untracked-files=all
  if ($LASTEXITCODE -ne 0 -or $changes) { throw "Source checkout has local changes; preserve and reconcile them first: $repoDir`n$changes" }
  $currentRemote = git -C $repoDir remote get-url origin
  if ($LASTEXITCODE -ne 0 -or $currentRemote -ne $RepoUrl) { throw "Existing checkout uses a different remote: $currentRemote" }
  Write-Host "Updating existing checkout: $repoDir"
  git -C $repoDir fetch origin $Branch --prune
  if ($LASTEXITCODE -ne 0) { throw 'Git fetch failed' }
  git -C $repoDir checkout $Branch
  if ($LASTEXITCODE -ne 0) { throw 'Git checkout failed' }
  git -C $repoDir merge --ff-only "origin/$Branch"
  if ($LASTEXITCODE -ne 0) { throw 'Source diverged; reconcile before installation' }
} else {
  if (Test-Path -LiteralPath $repoDir) {
    throw "Existing non-repository directory is preserved: $repoDir"
  }

  Write-Host "Cloning $RepoUrl ($Branch) to: $repoDir"
  git clone --branch $Branch $RepoUrl $repoDir
  if ($LASTEXITCODE -ne 0) { throw 'Git clone failed' }
}

$installer = Join-Path $repoDir "scripts\install-skill.ps1"
if (-not (Test-Path -LiteralPath $installer -PathType Leaf)) {
  throw "Installer not found after clone: $installer"
}

$args = @(
  "-ExecutionPolicy", "Bypass",
  "-File", $installer,
  "-SkillName", $SkillName,
  "-CodexHome", $CodexHome
)

if ($NoBackup) {
  $args += "-NoBackup"
}

Write-Host ""
Write-Host "Running local installer..."
& powershell @args

if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

Write-Host ""
Write-Host "Done."
