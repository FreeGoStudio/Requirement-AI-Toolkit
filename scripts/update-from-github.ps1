param(
  [string]$Branch = 'codex/html-prototype-output',
  [string]$CodexHome = $env:CODEX_HOME,
  [switch]$NoBackup
)

$ErrorActionPreference = 'Stop'
if ([string]::IsNullOrWhiteSpace($Branch)) { throw 'Branch is required.' }
if (-not $CodexHome) { $CodexHome = Join-Path $env:USERPROFILE '.codex' }
# Unique staging directory: never reset or delete a user's existing checkout.
$staging = Join-Path ([IO.Path]::GetTempPath()) ('requirement-toolkit-update-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $staging | Out-Null
try {
  [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
  $branchPath = [Uri]::EscapeDataString($Branch)
  $archiveUrl = "https://codeload.github.com/FreeGoStudio/Requirement-AI-Toolkit/zip/refs/heads/$branchPath"
  $archive = Join-Path $staging 'source.zip'
  $expanded = Join-Path $staging 'source'
  Write-Host "Downloading branch: $Branch"
  Invoke-WebRequest -UseBasicParsing -Uri $archiveUrl -OutFile $archive
  Expand-Archive -LiteralPath $archive -DestinationPath $expanded
  $roots = @(Get-ChildItem -LiteralPath $expanded -Directory)
  if ($roots.Count -ne 1) { throw 'Unexpected GitHub archive structure.' }
  $repoRoot = $roots[0].FullName
  $installer = Join-Path $repoRoot 'scripts/install-skill.ps1'
  foreach ($relative in @('scripts/install-skill.ps1', 'skills/prd/SKILL.md', 'skills/prd-setup/SKILL.md', 'skills/prototype-publish/SKILL.md')) {
    if (-not (Test-Path -LiteralPath (Join-Path $repoRoot $relative) -PathType Leaf)) {
      throw "Branch is missing required file: $relative. No skills have been installed."
    }
  }
  # prd installs/updates prototype-publish first using the same options.
  & $installer -SkillName prd -CodexHome $CodexHome -NoBackup:$NoBackup
  & $installer -SkillName prd-setup -CodexHome $CodexHome -NoBackup:$NoBackup
  Write-Host "Updated prd, prd-setup and prototype-publish from $Branch."
  Write-Host 'Start a new Codex chat to load the updated skills. Server configuration is unchanged.'
} finally {
  $resolved = [IO.Path]::GetFullPath($staging)
  $tempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\', '/') + [IO.Path]::DirectorySeparatorChar
  if ($resolved.StartsWith($tempRoot, [StringComparison]::OrdinalIgnoreCase) -and (Split-Path $resolved -Leaf).StartsWith('requirement-toolkit-update-')) {
    Remove-Item -LiteralPath $resolved -Recurse -Force -ErrorAction SilentlyContinue
  }
}
