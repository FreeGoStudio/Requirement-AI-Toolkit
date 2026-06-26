param(
  [string]$CodexHome = $env:CODEX_HOME,
  [switch]$NoBackup
)

$ErrorActionPreference = "Stop"

$scriptPath = $MyInvocation.MyCommand.Path
$scriptDir = Split-Path -Parent $scriptPath
$repoRoot = Split-Path -Parent $scriptDir
$skillName = "product-requirement-prototyping"
$source = Join-Path $repoRoot "skills\$skillName"

if (-not $CodexHome -or $CodexHome.Trim() -eq "") {
  $CodexHome = Join-Path $env:USERPROFILE ".codex"
}

$skillsRoot = Join-Path $CodexHome "skills"
$target = Join-Path $skillsRoot $skillName

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
Assert-FileExists (Join-Path $source "agents\openai.yaml")
Assert-FileExists (Join-Path $source "references\prototype-spec.md")
Assert-FileExists (Join-Path $source "references\figma-console-mcp.md")
Assert-FileExists (Join-Path $source "references\output-artifacts.md")

New-Item -ItemType Directory -Force -Path $skillsRoot | Out-Null

if (Test-Path -LiteralPath $target) {
  if (-not $NoBackup) {
    $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $backup = Join-Path $skillsRoot "$skillName.backup-$stamp"
    Move-Item -LiteralPath $target -Destination $backup
    Write-Host "Backed up existing skill to: $backup"
  } else {
    Remove-Item -LiteralPath $target -Recurse -Force
    Write-Host "Removed existing skill: $target"
  }
}

Copy-Item -LiteralPath $source -Destination $skillsRoot -Recurse

Assert-FileExists (Join-Path $target "SKILL.md")
Assert-FileExists (Join-Path $target "agents\openai.yaml")
Assert-FileExists (Join-Path $target "references\prototype-spec.md")
Assert-FileExists (Join-Path $target "references\figma-console-mcp.md")
Assert-FileExists (Join-Path $target "references\output-artifacts.md")

Write-Host ""
Write-Host "Installed Codex skill: $skillName"
Write-Host "Target: $target"
Write-Host ""
Write-Host "Test in a new Codex thread with:"
Write-Host "Use `$product-requirement-prototyping."
Write-Host ""
