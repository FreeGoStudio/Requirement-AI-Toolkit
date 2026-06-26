param(
  [string]$CodexHome = $env:CODEX_HOME,
  [switch]$NoBackup
)

$ErrorActionPreference = "Stop"

$scriptPath = $MyInvocation.MyCommand.Path
$scriptDir = Split-Path -Parent $scriptPath
$repoRoot = Split-Path -Parent $scriptDir
$skillName = "product-requirement-prototyping"
$aliasSkillName = "prd"
$source = Join-Path $repoRoot "skills\$skillName"
$aliasSource = Join-Path $repoRoot "skills\$aliasSkillName"

if (-not $CodexHome -or $CodexHome.Trim() -eq "") {
  $CodexHome = Join-Path $env:USERPROFILE ".codex"
}

$skillsRoot = Join-Path $CodexHome "skills"
$target = Join-Path $skillsRoot $skillName
$aliasTarget = Join-Path $skillsRoot $aliasSkillName

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
Assert-DirectoryExists $aliasSource
Assert-FileExists (Join-Path $aliasSource "SKILL.md")
Assert-FileExists (Join-Path $aliasSource "agents\openai.yaml")

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

if (Test-Path -LiteralPath $aliasTarget) {
  if (-not $NoBackup) {
    $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $backup = Join-Path $skillsRoot "$aliasSkillName.backup-$stamp"
    Move-Item -LiteralPath $aliasTarget -Destination $backup
    Write-Host "Backed up existing alias skill to: $backup"
  } else {
    Remove-Item -LiteralPath $aliasTarget -Recurse -Force
    Write-Host "Removed existing alias skill: $aliasTarget"
  }
}

Copy-Item -LiteralPath $source -Destination $skillsRoot -Recurse
Copy-Item -LiteralPath $aliasSource -Destination $skillsRoot -Recurse

Assert-FileExists (Join-Path $target "SKILL.md")
Assert-FileExists (Join-Path $target "agents\openai.yaml")
Assert-FileExists (Join-Path $target "references\prototype-spec.md")
Assert-FileExists (Join-Path $target "references\figma-console-mcp.md")
Assert-FileExists (Join-Path $target "references\output-artifacts.md")
Assert-FileExists (Join-Path $aliasTarget "SKILL.md")
Assert-FileExists (Join-Path $aliasTarget "agents\openai.yaml")

Write-Host ""
Write-Host "Installed Codex skill: $skillName"
Write-Host "Target: $target"
Write-Host "Installed alias skill: $aliasSkillName"
Write-Host "Alias target: $aliasTarget"
Write-Host ""
Write-Host "Test in a new Codex thread with:"
Write-Host "Use `$prd."
Write-Host "Or say in Chinese: use the product requirement tool."
Write-Host ""
