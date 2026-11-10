$ErrorActionPreference = 'Stop'
$root = Join-Path ([IO.Path]::GetTempPath()) ('toolkit-github-test-' + [Guid]::NewGuid().ToString('N'))
$fixture = Join-Path $root 'fixture/repo'
$homePath = Join-Path $root 'codex'
$observation = [pscustomobject]@{ url = $null; failDownload = $false }

function Invoke-WebRequest {
  param([switch]$UseBasicParsing, [string]$Uri, [string]$OutFile)
  $observation.url = $Uri
  if ($observation.failDownload) { throw 'Simulated download failure' }
  Copy-Item -LiteralPath (Join-Path $root 'fixture.zip') -Destination $OutFile
}
try {
  New-Item -ItemType Directory -Force -Path (Join-Path $fixture 'scripts') | Out-Null
  Copy-Item (Join-Path $PSScriptRoot '../install-skill.ps1') (Join-Path $fixture 'scripts/install-skill.ps1')
  foreach ($name in @('prd','prd-setup','prototype-publish')) {
    $folder = Join-Path $fixture "skills/$name"
    New-Item -ItemType Directory -Force -Path $folder | Out-Null
    'test-version' | Set-Content (Join-Path $folder 'SKILL.md')
  }
  Compress-Archive -LiteralPath $fixture -DestinationPath (Join-Path $root 'fixture.zip')
  & (Join-Path $PSScriptRoot '../update-from-github.ps1') -CodexHome $homePath
  if ($observation.url -notlike 'https://codeload.github.com/*/zip/refs/heads/codex%2Fhtml-prototype-output') { throw 'Wrong branch URL' }
  foreach ($name in @('prd','prd-setup','prototype-publish')) {
    if (-not (Test-Path (Join-Path $homePath "skills/$name/SKILL.md"))) { throw "Missing skill $name" }
  }
  $observation.failDownload = $true
  $failed = $false
  try { & (Join-Path $PSScriptRoot '../update-from-github.ps1') -CodexHome $homePath } catch { $failed = $true }
  if (-not $failed) { throw 'Download failure was ignored' }
  foreach ($name in @('prd','prd-setup','prototype-publish')) {
    if ((Get-Content (Join-Path $homePath "skills/$name/SKILL.md") -Raw).Trim() -ne 'test-version') { throw 'Existing install changed on download failure' }
  }
  Write-Output 'PASS: branch archive download, extraction, all three installations and download-failure protection.'
} finally {
  $resolved = [IO.Path]::GetFullPath($root)
  $tempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\','/') + [IO.Path]::DirectorySeparatorChar
  if ($resolved.StartsWith($tempRoot, [StringComparison]::OrdinalIgnoreCase) -and (Split-Path $resolved -Leaf).StartsWith('toolkit-github-test-')) {
    Remove-Item -LiteralPath $resolved -Recurse -Force -ErrorAction SilentlyContinue
  }
}
