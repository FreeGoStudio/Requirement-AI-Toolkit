$ErrorActionPreference = 'Stop'
$testRoot = Join-Path ([IO.Path]::GetTempPath()) ('prd-install-dependency-' + [Guid]::NewGuid().ToString('N'))
$fixture = Join-Path $testRoot 'repo'
$destination = Join-Path $testRoot 'codex'
$installer = Join-Path $fixture 'scripts/install-skill.ps1'
function Require($Condition, [string]$Message) { if (-not $Condition) { throw $Message } }
try {
  New-Item -ItemType Directory -Force -Path (Split-Path $installer -Parent) | Out-Null
  Copy-Item -LiteralPath (Join-Path $PSScriptRoot '../install-skill.ps1') -Destination $installer
  foreach ($name in @('prd','prototype-publish','prd-setup')) {
    $folder = Join-Path $fixture "skills/$name"
    New-Item -ItemType Directory -Force -Path $folder | Out-Null
    'version-one' | Set-Content (Join-Path $folder 'SKILL.md')
  }
  & $installer -SkillName prd -CodexHome $destination
  foreach ($name in @('prd','prototype-publish')) {
    Require (Test-Path (Join-Path $destination "skills/$name/SKILL.md")) "Missing installed $name"
    'version-two' | Set-Content (Join-Path $fixture "skills/$name/SKILL.md")
  }
  'preserve-local-configuration' | Set-Content (Join-Path $destination 'server.json')
  & $installer -SkillName prd -CodexHome $destination
  foreach ($name in @('prd','prototype-publish')) {
    Require ((Get-Content (Join-Path $destination "skills/$name/SKILL.md") -Raw).Trim() -eq 'version-two') "Dependency update failed: $name"
    $backups = @(Get-ChildItem (Join-Path $destination 'skills') -Directory -Filter "$name.backup-*")
    Require ($backups.Count -eq 1) "Expected one backup for $name"
    Require ((Get-Content (Join-Path $backups[0].FullName 'SKILL.md') -Raw).Trim() -eq 'version-one') "Wrong backup content: $name"
    'version-three' | Set-Content (Join-Path $fixture "skills/$name/SKILL.md")
  }
  & $installer -SkillName prd -CodexHome $destination -NoBackup
  foreach ($name in @('prd','prototype-publish')) {
    Require ((Get-Content (Join-Path $destination "skills/$name/SKILL.md") -Raw).Trim() -eq 'version-three') "NoBackup update failed: $name"
    Require (@(Get-ChildItem (Join-Path $destination 'skills') -Directory -Filter "$name.backup-*").Count -eq 1) "NoBackup was not forwarded: $name"
  }
  Require ((Get-Content (Join-Path $destination 'server.json') -Raw).Trim() -eq 'preserve-local-configuration') 'Local configuration changed'

  $standalone = Join-Path $testRoot 'standalone'
  & $installer -SkillName prototype-publish -CodexHome $standalone
  Require (-not (Test-Path (Join-Path $standalone 'skills/prd'))) 'Standalone publisher unexpectedly installed prd'
  $setupOnly = Join-Path $testRoot 'setup-only'
  & $installer -SkillName prd-setup -CodexHome $setupOnly
  Require (-not (Test-Path (Join-Path $setupOnly 'skills/prototype-publish'))) 'prd-setup unexpectedly installed dependency'

  Rename-Item -LiteralPath (Join-Path $fixture 'skills/prototype-publish/SKILL.md') -NewName 'SKILL.missing'
  'must-not-install' | Set-Content (Join-Path $fixture 'skills/prd/SKILL.md')
  $blocked = $false
  try { & $installer -SkillName prd -CodexHome $destination } catch { $blocked = $true }
  Require $blocked 'Missing dependency did not stop installation'
  Require ((Get-Content (Join-Path $destination 'skills/prd/SKILL.md') -Raw).Trim() -eq 'version-three') 'prd replaced despite missing dependency'
  Write-Output 'PASS: fresh install, dependency update, backup/NoBackup, custom home, standalone behavior, configuration preservation and missing dependency protection.'
} finally {
  $resolved = [IO.Path]::GetFullPath($testRoot)
  $tempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
  if ($resolved.StartsWith($tempRoot, [StringComparison]::OrdinalIgnoreCase) -and (Split-Path $resolved -Leaf).StartsWith('prd-install-dependency-')) {
    Remove-Item -LiteralPath $resolved -Recurse -Force -ErrorAction SilentlyContinue
  }
}
