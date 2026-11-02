$ErrorActionPreference = "Stop"

# A local checkout must use its reviewed installer, not silently fetch an older main.
if ($PSScriptRoot -and (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'install-skill.ps1'))) {
  & (Join-Path $PSScriptRoot 'install-skill.ps1') -SkillName 'prd-setup'
  return
}

$installerUrl = "https://raw.githubusercontent.com/FreeGoStudio/Requirement-AI-Toolkit/main/scripts/install-from-git.ps1"
$installerSource = (Invoke-WebRequest -UseBasicParsing -Uri $installerUrl).Content
& ([scriptblock]::Create($installerSource)) -SkillName "prd-setup"
