$ErrorActionPreference = "Stop"

$testRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$skillRoot = Split-Path -Parent $testRoot
$validator = Join-Path $skillRoot "scripts\Test-DesignGovernance.ps1"
$fixtures = Join-Path $testRoot "fixtures"
$manifestPath = Join-Path $fixtures "valid-manifest.json"
$lowSpecPath = Join-Path $fixtures "valid-low-fidelity-spec.json"
$highSpecPath = Join-Path $fixtures "valid-high-fidelity-spec.json"

function Invoke-ExpectedPass {
  param([string]$Name, [string]$Manifest, [string]$Spec)
  & $validator -ManifestPath $Manifest -PrototypeSpecPath $Spec | Out-Null
  Write-Host "PASS: $Name"
}

function Invoke-ExpectedFailure {
  param([string]$Name, [scriptblock]$Action)
  try {
    & $Action
    throw "Expected validation failure: $Name"
  } catch {
    if ($_.Exception.Message -eq "Expected validation failure: $Name") { throw }
    Write-Host "PASS: $Name"
  }
}

Invoke-ExpectedPass "valid low-fidelity fix" $manifestPath $lowSpecPath
Invoke-ExpectedPass "valid high-fidelity iteration" $manifestPath $highSpecPath

$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) "prd-design-governance-tests"
New-Item -ItemType Directory -Force -Path $tempRoot | Out-Null

$manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
$manifest.pageRegistry.componentsPageId = $manifest.pageRegistry.foundationsPageId
$invalidPages = Join-Path $tempRoot "invalid-pages.json"
$manifest | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $invalidPages -Encoding UTF8
Invoke-ExpectedFailure "duplicate standard Page IDs" { & $validator -ManifestPath $invalidPages }

$manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
$manifest.pageRegistry.patternsPageId = ""
$missingPage = Join-Path $tempRoot "missing-page.json"
$manifest | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $missingPage -Encoding UTF8
Invoke-ExpectedFailure "missing standard Page initialization" { & $validator -ManifestPath $missingPage }

$manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
$duplicateFlow = $manifest.flows[0] | ConvertTo-Json -Depth 10 | ConvertFrom-Json
$manifest.flows = @($manifest.flows[0], $duplicateFlow)
$invalidFlows = Join-Path $tempRoot "invalid-flows.json"
$manifest | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $invalidFlows -Encoding UTF8
Invoke-ExpectedFailure "duplicate flowId" { & $validator -ManifestPath $invalidFlows }

$manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
$manifest.flows += [pscustomobject]@{
  flowId = "package-management"
  flowName = "升级包管理"
  objective = "独立维护升级包"
  pages = [pscustomobject]@{lowFidelityPageId = "page-lf-upgrade"; highFidelityPageId = ""}
}
$sharedFlowPage = Join-Path $tempRoot "shared-flow-page.json"
$manifest | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $sharedFlowPage -Encoding UTF8
Invoke-ExpectedFailure "cross-flow Page reuse" { & $validator -ManifestPath $sharedFlowPage }

$spec = Get-Content -LiteralPath $lowSpecPath -Raw -Encoding UTF8 | ConvertFrom-Json
$spec.flowIdentity.flowId = "package-management"
$spec.flowIdentity.flowName = "升级包管理"
$spec.flowIdentity.objective = "独立维护升级包"
$spec.flowIdentity.changeType = "new-flow"
$spec.figmaPageStrategy.action = "create-new-page"
$spec.figmaPageStrategy.pageName = "10 LF · 升级包管理"
$spec.figmaPageStrategy.targetPageId = ""
$newFlowSpec = Join-Path $tempRoot "new-flow.json"
$spec | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $newFlowSpec -Encoding UTF8
Invoke-ExpectedPass "new flow creates a separate Page" $manifestPath $newFlowSpec

$spec = Get-Content -LiteralPath $lowSpecPath -Raw -Encoding UTF8 | ConvertFrom-Json
$spec.flowIdentity.changeType = "new-flow"
$spec.figmaPageStrategy.action = "create-new-page"
$spec.figmaPageStrategy.targetPageId = ""
$duplicatePageSpec = Join-Path $tempRoot "duplicate-page.json"
$spec | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $duplicatePageSpec -Encoding UTF8
Invoke-ExpectedFailure "create duplicate flow fidelity Page" { & $validator -ManifestPath $manifestPath -PrototypeSpecPath $duplicatePageSpec }

$spec = Get-Content -LiteralPath $highSpecPath -Raw -Encoding UTF8 | ConvertFrom-Json
$spec.flowIdentity.changeType = "redesign"
$spec.figmaPageStrategy.action = "archive-and-create-replacement"
$spec.figmaPageStrategy.reason = "根本重构并保留旧版"
$redesignSpec = Join-Path $tempRoot "redesign.json"
$spec | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $redesignSpec -Encoding UTF8
Invoke-ExpectedPass "redesign archives existing Page" $manifestPath $redesignSpec

$spec = Get-Content -LiteralPath $highSpecPath -Raw -Encoding UTF8 | ConvertFrom-Json
$spec.designSystemDependency.componentIds = @("component-unapproved")
$invalidDependency = Join-Path $tempRoot "invalid-dependency.json"
$spec | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $invalidDependency -Encoding UTF8
Invoke-ExpectedFailure "unapproved Design System dependency" { & $validator -ManifestPath $manifestPath -PrototypeSpecPath $invalidDependency }

$manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
$manifest.designSystem.status = "candidate"
$unapprovedSystem = Join-Path $tempRoot "unapproved-system.json"
$manifest | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $unapprovedSystem -Encoding UTF8
Invoke-ExpectedFailure "high fidelity before Design System approval" { & $validator -ManifestPath $unapprovedSystem -PrototypeSpecPath $highSpecPath }

$spec = Get-Content -LiteralPath $highSpecPath -Raw -Encoding UTF8 | ConvertFrom-Json
$spec.conformanceRequirements.unexplainedDetachedInstanceCount = 1
$invalidDetach = Join-Path $tempRoot "invalid-detach.json"
$spec | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $invalidDetach -Encoding UTF8
Invoke-ExpectedFailure "detached instance" { & $validator -ManifestPath $manifestPath -PrototypeSpecPath $invalidDetach }

$spec = Get-Content -LiteralPath $highSpecPath -Raw -Encoding UTF8 | ConvertFrom-Json
$spec.assetResolution[0].assetId = "tokens-unregistered"
$invalidAsset = Join-Path $tempRoot "invalid-asset.json"
$spec | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $invalidAsset -Encoding UTF8
Invoke-ExpectedFailure "unregistered asset resolution" { & $validator -ManifestPath $manifestPath -PrototypeSpecPath $invalidAsset }

$manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
$manifest.legacyMigration = [pscustomobject]@{
  required = $true
  status = "pending-confirmation"
  moves = @([pscustomobject]@{sourceNodeId = "legacy-component"; targetPageId = "page-components"; executed = $true})
}
$invalidMigration = Join-Path $tempRoot "invalid-migration.json"
$manifest | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $invalidMigration -Encoding UTF8
Invoke-ExpectedFailure "legacy migration before confirmation" { & $validator -ManifestPath $invalidMigration }

Write-Host "All design governance tests passed."
