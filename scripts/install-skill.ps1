param(
  [ValidatePattern('^[a-z0-9][a-z0-9-]*$')][string]$SkillName = 'prd',
  [string]$CodexHome = $env:CODEX_HOME,
  [string]$Revision = 'HEAD',
  [string]$BaselineRevision,
  [string]$InventoryConfig,
  [switch]$NoBackup
)
$ErrorActionPreference = 'Stop'
if ($NoBackup) { throw '-NoBackup is retired; recovery archives are always retained outside loading roots.' }
if (-not $CodexHome) { $CodexHome = Join-Path $env:USERPROFILE '.codex' }
$arguments = @("$PSScriptRoot/skill_maintenance.py", 'install', '--skill', $SkillName, '--codex-home', $CodexHome, '--revision', $Revision)
if ($BaselineRevision) { $arguments += @('--baseline', $BaselineRevision) }
if ($InventoryConfig) { $arguments += @('--config', $InventoryConfig) }
& python @arguments
if ($LASTEXITCODE -ne 0) { throw "Installation failed ($LASTEXITCODE); see state and recovery details above." }
