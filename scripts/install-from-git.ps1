param(
  [string]$RepoUrl = "https://github.com/FreeGoStudio/Requirement-AI-Toolkit.git",
  [string]$Branch = "main",
  [string]$CodexHome = $env:CODEX_HOME,
  [string]$InstallRoot = (Join-Path $env:TEMP "Requirement-AI-Toolkit"),
  [switch]$NoBackup
)

$ErrorActionPreference = "Stop"

function Assert-CommandExists {
  param([string]$Name)
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Required command not found: $Name. Please install Git and try again."
  }
}

Assert-CommandExists "git"

if (-not $CodexHome -or $CodexHome.Trim() -eq "") {
  $CodexHome = Join-Path $env:USERPROFILE ".codex"
}

$repoDir = Join-Path $InstallRoot "repo"
New-Item -ItemType Directory -Force -Path $InstallRoot | Out-Null

if (Test-Path -LiteralPath (Join-Path $repoDir ".git") -PathType Container) {
  Write-Host "Updating existing checkout: $repoDir"
  git -C $repoDir remote set-url origin $RepoUrl
  git -C $repoDir fetch origin $Branch --prune
  git -C $repoDir checkout $Branch
  git -C $repoDir reset --hard "origin/$Branch"
} else {
  if (Test-Path -LiteralPath $repoDir) {
    Remove-Item -LiteralPath $repoDir -Recurse -Force
  }

  Write-Host "Cloning $RepoUrl ($Branch) to: $repoDir"
  git clone --depth 1 --branch $Branch $RepoUrl $repoDir
}

$installer = Join-Path $repoDir "scripts\install-skill.ps1"
if (-not (Test-Path -LiteralPath $installer -PathType Leaf)) {
  throw "Installer not found after clone: $installer"
}

$args = @(
  "-ExecutionPolicy", "Bypass",
  "-File", $installer,
  "-SkillName", "prd",
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
