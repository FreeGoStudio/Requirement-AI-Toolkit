$ErrorActionPreference = 'Stop'
$validator = Join-Path $PSScriptRoot '../scripts/Test-DesignGovernance.ps1'
$fixtures = Join-Path $PSScriptRoot 'fixtures'
$tempRoot = Join-Path ([IO.Path]::GetTempPath()) ('prd-html-tests-' + [guid]::NewGuid())
New-Item -ItemType Directory -Path $tempRoot | Out-Null
Copy-Item -Path "$fixtures/*.json" -Destination $tempRoot
$mPath = Join-Path $tempRoot 'valid-manifest.json'
$lPath = Join-Path $tempRoot 'valid-low-fidelity-spec.json'
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
& $validator -ManifestPath $mPath -PrototypeSpecPath $lPath
& $validator -ManifestPath $mPath -PrototypeSpecPath $hPath
$m = Read-Fixture 'valid-manifest.json'
$m.flows += $m.flows[0]
$bad = Join-Path $tempRoot 'bad.json'
Save-Json $m $bad
Expect-Failure 'duplicate flow' { & $validator -ManifestPath $bad } 'Duplicate flowId'
$s = Read-Fixture 'valid-low-fidelity-spec.json'
$s.htmlStrategy.entryPath = '../outside.html'
Save-Json $s $bad
Expect-Failure 'path traversal' { & $validator -ManifestPath $mPath -PrototypeSpecPath $bad } 'Non-canonical path'
$s = Read-Fixture 'valid-low-fidelity-spec.json'
$s.htmlStrategy.action = 'create'
Save-Json $s $bad
Expect-Failure 'iteration cannot create' { & $validator -ManifestPath $mPath -PrototypeSpecPath $bad } 'must update'
$s.flowIdentity.changeType = 'new-flow'
Save-Json $s $bad
Expect-Failure 'duplicate entry creation' { & $validator -ManifestPath $mPath -PrototypeSpecPath $bad } 'duplicate flow/fidelity'
$s.flowIdentity.flowId = 'reset'
$s.htmlStrategy.entryPath = 'prototypes/low/reset.html'
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
Expect-Failure 'postwrite requires real files' { & $validator -ManifestPath $mPath -PrototypeSpecPath $lPath -Phase postwrite } 'Missing output file'
foreach ($path in @('design-system/tokens.css', 'design-system/components.css', 'prototypes/low/login.html', 'prototypes/high/login.html', '02-reference-decision.html')) {
  $full = Join-Path $tempRoot $path
  New-Item -ItemType Directory -Force -Path (Split-Path $full -Parent) | Out-Null
  Set-Content -LiteralPath $full -Value '<!doctype html><html lang="zh-CN"><title>Fixture</title><body>Fixture</body></html>' -Encoding UTF8
}
& $validator -ManifestPath $mPath -PrototypeSpecPath $lPath -Phase postwrite
& $validator -ManifestPath $mPath -PrototypeSpecPath $hPath -Phase postwrite
$s = Read-Fixture 'valid-low-fidelity-spec.json'
$s.flowIdentity.flowId = 'missing'
$s.htmlStrategy.entryPath = 'prototypes/low/missing.html'
Save-Json $s $bad
Expect-Failure 'update requires registered entry' { & $validator -ManifestPath $mPath -PrototypeSpecPath $bad } 'must match manifest'
Write-Host "All HTML governance tests passed. Temporary fixtures: $tempRoot"
