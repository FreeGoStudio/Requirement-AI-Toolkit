$ErrorActionPreference = 'Stop'
$validator = Join-Path $PSScriptRoot '../scripts/Test-DesignGovernance.ps1'
$fixtures = Join-Path $PSScriptRoot 'fixtures'
$tempRoot = Join-Path ([IO.Path]::GetTempPath()) ('prd-html-tests-' + [guid]::NewGuid())
New-Item -ItemType Directory -Path $tempRoot | Out-Null
& git -C $tempRoot init -q
$repoRoot = $tempRoot
$tempRoot = Join-Path $repoRoot 'working/demo'
New-Item -ItemType Directory -Path $tempRoot -Force | Out-Null
foreach ($rel in @('docs/requirements/demo/index.md', 'working/demo/08-bdd.md', 'working/demo/03-interface-baseline.json')) {
  $file = Join-Path $repoRoot $rel
  New-Item -ItemType Directory -Force -Path (Split-Path $file -Parent) | Out-Null
  Set-Content -LiteralPath $file -Value 'Fixture'
}
Copy-Item -Path "$fixtures/*.json" -Destination $tempRoot
$mPath = Join-Path $tempRoot 'valid-manifest.json'
$hPath = Join-Path $tempRoot 'valid-high-fidelity-spec.json'
function Read-Fixture($Name) { Get-Content (Join-Path $fixtures $Name) -Raw -Encoding UTF8 | ConvertFrom-Json }
function Save-Json($Value, $Path) { $Value | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $Path -Encoding UTF8 }
function Expect-Failure($Name, [scriptblock]$Action, $Pattern) {
  $failed = $false
  try { & $Action | Out-Null } catch {
    if ($_.Exception.Message -notmatch $Pattern) { throw }
    $failed = $true
  }
  if (-not $failed) { throw "Expected failure: $Name" }
  Write-Host "PASS: $Name"
}
& $validator -ManifestPath $mPath -PrototypeSpecPath $hPath
# New workflow: create and validate high fidelity without any low-fidelity entry or file.
$directRepo = Join-Path $repoRoot 'direct-high'
New-Item -ItemType Directory -Path $directRepo | Out-Null
& git -C $directRepo init -q
$directRoot = Join-Path $directRepo 'working/demo'
New-Item -ItemType Directory -Path $directRoot -Force | Out-Null
foreach ($rel in @('docs/requirements/demo/index.md', 'working/demo/08-bdd.md', 'working/demo/03-interface-baseline.json')) {
  $file = Join-Path $directRepo $rel
  New-Item -ItemType Directory -Force -Path (Split-Path $file -Parent) | Out-Null
  Set-Content -LiteralPath $file -Value 'Fixture'
}
$directManifest = Join-Path $directRoot 'manifest.json'
$directSpec = Join-Path $directRoot 'spec.json'
$directM = Read-Fixture 'valid-manifest.json'
$directM.flows[0].entries = [pscustomobject]@{ high = '' }
$directS = Read-Fixture 'valid-high-fidelity-spec.json'
$directS.flowIdentity.changeType = 'new-flow'
$directS.htmlStrategy.action = 'create'
Save-Json $directM $directManifest
Save-Json $directS $directSpec
& $validator -ManifestPath $directManifest -PrototypeSpecPath $directSpec
foreach ($path in @('design-system/tokens.css', 'design-system/components.css', 'prototypes/high/login.html', '02-reference-decision.md')) {
  $full = Join-Path $directRoot $path
  New-Item -ItemType Directory -Force -Path (Split-Path $full -Parent) | Out-Null
  Set-Content -LiteralPath $full -Value 'Fixture' -Encoding UTF8
}
$directM.flows[0].entries.high = 'working/demo/prototypes/high/login.html'
Save-Json $directM $directManifest
& $validator -ManifestPath $directManifest -PrototypeSpecPath $directSpec -Phase postwrite
if (Test-Path (Join-Path $directRoot 'prototypes/low')) { throw 'Direct high-fidelity test unexpectedly created low fidelity' }
Write-Host 'PASS: direct high fidelity without low-fidelity artifacts'
$legacy = Read-Fixture 'valid-manifest.json'
$legacy.flows[0].entries | Add-Member -NotePropertyName low -NotePropertyValue ''
$legacyPath = Join-Path $tempRoot 'legacy.json'
Save-Json $legacy $legacyPath
Expect-Failure 'legacy manifest requires explicit migration' { & $validator -ManifestPath $legacyPath } 'migrate'
$legacySpec = Read-Fixture 'valid-high-fidelity-spec.json'
$legacySpec.mode = 'low-fidelity'
$legacySpec.flowIdentity.fidelity = 'low'
Save-Json $legacySpec $legacyPath
Expect-Failure 'legacy spec requires explicit migration' { & $validator -ManifestPath $mPath -PrototypeSpecPath $legacyPath } 'migrate'
$m = Read-Fixture 'valid-manifest.json'
$m.flows += $m.flows[0]
$bad = Join-Path $tempRoot 'bad.json'
Save-Json $m $bad
Expect-Failure 'duplicate flow' { & $validator -ManifestPath $bad } 'Duplicate flowId'
$s = Read-Fixture 'valid-high-fidelity-spec.json'
$s.htmlStrategy.entryPath = '../outside.html'
Save-Json $s $bad
Expect-Failure 'path traversal' { & $validator -ManifestPath $mPath -PrototypeSpecPath $bad } 'Non-canonical path'
$s = Read-Fixture 'valid-high-fidelity-spec.json'
$s.htmlStrategy.action = 'create'
Save-Json $s $bad
Expect-Failure 'iteration cannot create' { & $validator -ManifestPath $mPath -PrototypeSpecPath $bad } 'must update'
$s.flowIdentity.changeType = 'new-flow'
Save-Json $s $bad
Expect-Failure 'duplicate entry creation' { & $validator -ManifestPath $mPath -PrototypeSpecPath $bad } 'duplicate flow/fidelity'
$s.flowIdentity.flowId = 'reset'
$s.htmlStrategy.entryPath = 'working/demo/prototypes/high/reset.html'
Save-Json $s $bad
& $validator -ManifestPath $mPath -PrototypeSpecPath $bad
$s.prototypeReferenceGate.userDecision = 'pending'
Save-Json $s $bad
Expect-Failure 'pending reference' { & $validator -ManifestPath $mPath -PrototypeSpecPath $bad } 'Reference decision'
$s = Read-Fixture 'valid-high-fidelity-spec.json'
$s.designSystemDependency.assetIds = @('unknown')
Save-Json $s $bad
Expect-Failure 'unregistered asset' { & $validator -ManifestPath $mPath -PrototypeSpecPath $bad } 'Unapproved asset'
$m = Read-Fixture 'valid-manifest.json'
$m.designSystem.status = 'candidate'
Save-Json $m $bad
Expect-Failure 'unapproved design system' { & $validator -ManifestPath $bad -PrototypeSpecPath $hPath } 'requires approved'
$m = Read-Fixture 'valid-manifest.json'
$m.designSystem.assets[1].status = 'candidate'
Save-Json $m $bad
Expect-Failure 'unapproved component' { & $validator -ManifestPath $bad -PrototypeSpecPath $hPath } 'Unapproved asset'
Expect-Failure 'postwrite requires real files' { & $validator -ManifestPath $mPath -PrototypeSpecPath $hPath -Phase postwrite } 'Missing output file'
foreach ($path in @('design-system/tokens.css', 'design-system/components.css', 'prototypes/high/login.html', '02-reference-decision.md')) {
  $full = Join-Path $tempRoot $path
  New-Item -ItemType Directory -Force -Path (Split-Path $full -Parent) | Out-Null
  Set-Content -LiteralPath $full -Value '<!doctype html><html lang="zh-CN"><title>Fixture</title><body>Fixture</body></html>' -Encoding UTF8
}
& $validator -ManifestPath $mPath -PrototypeSpecPath $hPath -Phase postwrite
$s = Read-Fixture 'valid-high-fidelity-spec.json'
$s.flowIdentity.flowId = 'missing'
$s.htmlStrategy.entryPath = 'working/demo/prototypes/high/missing.html'
Save-Json $s $bad
Expect-Failure 'update requires registered entry' { & $validator -ManifestPath $mPath -PrototypeSpecPath $bad } 'must match manifest'
$s = Read-Fixture 'valid-high-fidelity-spec.json'
$s.sourceArtifacts = @('docs/requirements/missing/index.md')
Save-Json $s $bad
Expect-Failure 'missing repository PRD reference' { & $validator -ManifestPath $mPath -PrototypeSpecPath $bad } 'Missing output file'
Write-Host "All HTML governance tests passed. Temporary fixtures: $tempRoot"
