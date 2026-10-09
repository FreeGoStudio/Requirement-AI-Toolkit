$ErrorActionPreference = "Stop"

$installerUrl = "https://raw.githubusercontent.com/FreeGoStudio/Requirement-AI-Toolkit/main/scripts/install-from-git.ps1"
$installerSource = (Invoke-WebRequest -UseBasicParsing -Uri $installerUrl).Content
& ([scriptblock]::Create($installerSource)) -SkillName "prd-setup"
