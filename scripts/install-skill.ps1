param(
  [string]$SkillName = "prd",
  [string]$CodexHome = $env:CODEX_HOME,
  [switch]$NoBackup
)

$ErrorActionPreference = "Stop"

$scriptPath = $MyInvocation.MyCommand.Path
$scriptDir = Split-Path -Parent $scriptPath
$repoRoot = Split-Path -Parent $scriptDir
$source = Join-Path $repoRoot "skills\$SkillName"

if (-not $CodexHome -or $CodexHome.Trim() -eq "") {
  $CodexHome = Join-Path $env:USERPROFILE ".codex"
}

$skillsRoot = Join-Path $CodexHome "skills"
$target = Join-Path $skillsRoot $SkillName

function Assert-FileExists {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    throw "Required file not found: $Path"
  }
}

function Assert-DirectoryExists {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path -PathType Container)) {
    throw "Required directory not found: $Path"
  }
}

Assert-DirectoryExists $source
Assert-FileExists (Join-Path $source "SKILL.md")

New-Item -ItemType Directory -Force -Path $skillsRoot | Out-Null

if (Test-Path -LiteralPath $target) {
  if (-not $NoBackup) {
    $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $backup = Join-Path $skillsRoot "$SkillName.backup-$stamp"
    Move-Item -LiteralPath $target -Destination $backup
    Write-Host "Backed up existing skill to: $backup"
  } else {
    Remove-Item -LiteralPath $target -Recurse -Force
    Write-Host "Removed existing skill: $target"
  }
}

Copy-Item -LiteralPath $source -Destination $skillsRoot -Recurse

Assert-FileExists (Join-Path $target "SKILL.md")
if (Test-Path -LiteralPath (Join-Path $source "agents") -PathType Container) {
  Assert-DirectoryExists (Join-Path $target "agents")
}
if (Test-Path -LiteralPath (Join-Path $source "references") -PathType Container) {
  Assert-DirectoryExists (Join-Path $target "references")
}

Write-Host ""
Write-Host "Installed Codex skill: $SkillName"
Write-Host "Target: $target"
Write-Host ""
Write-Host "Test in a new Codex thread with:"
Write-Host "Use `$$SkillName."
Write-Host ""
