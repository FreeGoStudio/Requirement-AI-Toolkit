param(
  [Parameter(Mandatory = $true)]
  [string]$ManifestPath,

  [string]$PrototypeSpecPath,

  [ValidateSet("preflight", "postwrite")]
  [string]$Phase = "preflight"
)

$ErrorActionPreference = "Stop"

function Read-JsonFile {
  param([string]$Path, [string]$Label)
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    throw "$Label not found: $Path"
  }
  try {
    return Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json
  } catch {
    throw "$Label is not valid JSON: $Path. $($_.Exception.Message)"
  }
}

function Test-NonEmptyString {
  param($Value)
  return $null -ne $Value -and $Value -is [string] -and -not [string]::IsNullOrWhiteSpace($Value)
}

function Add-RequiredStringError {
  param([System.Collections.Generic.List[string]]$Errors, [string]$Path, $Value)
  if (-not (Test-NonEmptyString $Value)) {
    $Errors.Add("Missing required string: $Path")
  }
}

function Get-ApprovedIds {
  param($Items, [string]$IdProperty)
  $set = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
  foreach ($item in @($Items)) {
    if ($item.status -eq "approved" -and (Test-NonEmptyString $item.$IdProperty)) {
      [void]$set.Add([string]$item.$IdProperty)
    }
  }
  return $set
}

$manifest = Read-JsonFile -Path $ManifestPath -Label "FigmaDesignManifest"
$errors = [System.Collections.Generic.List[string]]::new()

Add-RequiredStringError $errors "designFile.fileId" $manifest.designFile.fileId
Add-RequiredStringError $errors "designFile.fileName" $manifest.designFile.fileName
Add-RequiredStringError $errors "designFile.productDomain" $manifest.designFile.productDomain

$pageFields = @(
  "foundationsPageId",
  "componentsPageId",
  "patternsPageId",
  "viewTemplatesPageId"
)
$pageIds = [System.Collections.Generic.List[string]]::new()
foreach ($field in $pageFields) {
  $value = $manifest.pageRegistry.$field
  Add-RequiredStringError $errors "pageRegistry.$field" $value
  if (Test-NonEmptyString $value) { $pageIds.Add([string]$value) }
}
if (($pageIds | Select-Object -Unique).Count -ne $pageIds.Count) {
  $errors.Add("Standard foundation page IDs must be unique")
}

$validDesignSystemStatuses = @("absent", "initialized", "candidate", "approved")
if ($manifest.designSystem.status -notin $validDesignSystemStatuses) {
  $errors.Add("Invalid designSystem.status: $($manifest.designSystem.status)")
}

$flowIds = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
$flowPageIds = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
foreach ($flow in @($manifest.flows)) {
  if (-not (Test-NonEmptyString $flow.flowId)) {
    $errors.Add("Every flow requires flowId")
    continue
  }
  if (-not $flowIds.Add([string]$flow.flowId)) {
    $errors.Add("Duplicate flowId: $($flow.flowId)")
  }
  foreach ($pair in @(
    @{ fidelity = "low"; value = $flow.pages.lowFidelityPageId },
    @{ fidelity = "high"; value = $flow.pages.highFidelityPageId }
  )) {
    if (Test-NonEmptyString $pair.value) {
      $key = "$($flow.flowId)|$($pair.fidelity)"
      if (-not $flowPageIds.Add([string]$pair.value)) {
        $errors.Add("A Flow Page ID is reused by multiple flow/fidelity entries: $($pair.value)")
      }
      if ($pageIds -contains $pair.value) {
        $errors.Add("Flow Page cannot reuse a standard foundation Page ID: $key")
      }
    }
  }
}

$validMigrationStatuses = @("not-applicable", "pending-confirmation", "approved", "complete")
if ($manifest.legacyMigration.status -notin $validMigrationStatuses) {
  $errors.Add("Invalid legacyMigration.status: $($manifest.legacyMigration.status)")
}
if ($manifest.legacyMigration.status -eq "pending-confirmation") {
  foreach ($move in @($manifest.legacyMigration.moves)) {
    if ($move.executed -eq $true) {
      $errors.Add("Legacy migration move executed before confirmation: $($move.sourceNodeId)")
    }
  }
}

if (Test-NonEmptyString $PrototypeSpecPath) {
  $spec = Read-JsonFile -Path $PrototypeSpecPath -Label "PrototypeSpec"
  Add-RequiredStringError $errors "flowIdentity.flowId" $spec.flowIdentity.flowId
  Add-RequiredStringError $errors "flowIdentity.flowName" $spec.flowIdentity.flowName
  Add-RequiredStringError $errors "flowIdentity.objective" $spec.flowIdentity.objective
  Add-RequiredStringError $errors "figmaPageStrategy.pageName" $spec.figmaPageStrategy.pageName

  $expectedFidelity = if ($spec.mode -eq "low-fidelity") { "low" } elseif ($spec.mode -eq "high-fidelity") { "high" } else { "" }
  if (-not $expectedFidelity) { $errors.Add("Invalid mode: $($spec.mode)") }
  if ($spec.flowIdentity.fidelity -ne $expectedFidelity) {
    $errors.Add("flowIdentity.fidelity must match mode")
  }
  if ($spec.flowIdentity.changeType -notin @("new-flow", "fix", "iteration", "redesign")) {
    $errors.Add("Invalid flowIdentity.changeType: $($spec.flowIdentity.changeType)")
  }
  if ($spec.designFile.fileId -ne $manifest.designFile.fileId) {
    $errors.Add("PrototypeSpec designFile.fileId does not match manifest")
  }

  $manifestFlow = @($manifest.flows) | Where-Object { $_.flowId -eq $spec.flowIdentity.flowId } | Select-Object -First 1
  $expectedPageId = if ($expectedFidelity -eq "low") { $manifestFlow.pages.lowFidelityPageId } else { $manifestFlow.pages.highFidelityPageId }
  $action = $spec.figmaPageStrategy.action
  if ($action -notin @("create-new-page", "update-existing-page", "archive-and-create-replacement")) {
    $errors.Add("Invalid figmaPageStrategy.action: $action")
  }
  if ($spec.flowIdentity.changeType -in @("fix", "iteration") -and $action -ne "update-existing-page") {
    $errors.Add("fix/iteration must use update-existing-page")
  }
  if ($action -eq "update-existing-page") {
    Add-RequiredStringError $errors "figmaPageStrategy.targetPageId" $spec.figmaPageStrategy.targetPageId
    if ((Test-NonEmptyString $expectedPageId) -and $spec.figmaPageStrategy.targetPageId -ne $expectedPageId) {
      $errors.Add("update-existing-page targetPageId does not match manifest")
    }
  }
  if ($action -eq "create-new-page" -and $Phase -eq "preflight" -and (Test-NonEmptyString $expectedPageId)) {
    $errors.Add("create-new-page would duplicate an existing flowId + fidelity Page")
  }
  if ($action -eq "create-new-page" -and $Phase -eq "postwrite") {
    Add-RequiredStringError $errors "figmaPageStrategy.targetPageId after write" $spec.figmaPageStrategy.targetPageId
    if ($spec.figmaPageStrategy.targetPageId -ne $expectedPageId) {
      $errors.Add("Created Page ID does not match manifest after write")
    }
  }
  if ($action -eq "archive-and-create-replacement" -and $spec.flowIdentity.changeType -ne "redesign") {
    $errors.Add("archive-and-create-replacement requires changeType=redesign")
  }
  if ($action -eq "archive-and-create-replacement") {
    Add-RequiredStringError $errors "figmaPageStrategy.targetPageId" $spec.figmaPageStrategy.targetPageId
    if ((Test-NonEmptyString $expectedPageId) -and $spec.figmaPageStrategy.targetPageId -ne $expectedPageId) {
      $errors.Add("Archived targetPageId does not match manifest")
    }
  }

  if ($spec.mode -eq "high-fidelity") {
    if ($manifest.designSystem.status -ne "approved") {
      $errors.Add("High fidelity requires designSystem.status=approved")
    }
    if ($spec.designSystemDependency.status -ne "approved") {
      $errors.Add("High fidelity requires designSystemDependency.status=approved")
    }

    $approved = @{
      token = Get-ApprovedIds $manifest.designSystem.tokenCollections "collectionId"
      component = Get-ApprovedIds $manifest.designSystem.components "componentId"
      pattern = Get-ApprovedIds $manifest.designSystem.patterns "patternId"
      view = Get-ApprovedIds $manifest.designSystem.viewTemplates "viewTemplateId"
    }
    foreach ($id in @($spec.designSystemDependency.tokenCollectionIds)) {
      if (-not $approved.token.Contains([string]$id)) { $errors.Add("Unapproved token collection dependency: $id") }
    }
    foreach ($id in @($spec.designSystemDependency.componentIds)) {
      if (-not $approved.component.Contains([string]$id)) { $errors.Add("Unapproved component dependency: $id") }
    }
    foreach ($id in @($spec.designSystemDependency.patternIds)) {
      if (-not $approved.pattern.Contains([string]$id)) { $errors.Add("Unapproved pattern dependency: $id") }
    }
    foreach ($id in @($spec.designSystemDependency.viewTemplateIds)) {
      if (-not $approved.view.Contains([string]$id)) { $errors.Add("Unapproved view template dependency: $id") }
    }
    foreach ($asset in @($spec.assetResolution)) {
      if ($asset.status -ne "approved") { $errors.Add("Asset resolution is not approved: $($asset.assetId)") }
      if ($asset.createdBeforeFlowInstance -ne $true) { $errors.Add("Asset was not created before Flow instance: $($asset.assetId)") }
      $expectedTarget = switch ($asset.assetType) {
        "token-collection" { $manifest.pageRegistry.foundationsPageId }
        "component" { $manifest.pageRegistry.componentsPageId }
        "pattern" { $manifest.pageRegistry.patternsPageId }
        "view-template" { $manifest.pageRegistry.viewTemplatesPageId }
        default { $null }
      }
      if (-not $expectedTarget) { $errors.Add("Invalid assetType: $($asset.assetType)") }
      elseif ($asset.targetPageId -ne $expectedTarget) { $errors.Add("Asset target Page mismatch: $($asset.assetId)") }
      $approvedSet = switch ($asset.assetType) {
        "token-collection" { $approved.token }
        "component" { $approved.component }
        "pattern" { $approved.pattern }
        "view-template" { $approved.view }
        default { $null }
      }
      if ($approvedSet -and -not $approvedSet.Contains([string]$asset.assetId)) {
        $errors.Add("Asset resolution is not registered as approved: $($asset.assetId)")
      }
    }
    foreach ($counter in @("rawStyleCount", "unexplainedDetachedInstanceCount", "unregisteredLocalComponentCount")) {
      if ($spec.conformanceRequirements.$counter -ne 0) {
        $errors.Add("conformanceRequirements.$counter must be 0")
      }
    }
  }
}

if ($errors.Count -gt 0) {
  throw "Design governance validation failed:`n- $($errors -join "`n- ")"
}

Write-Output "Design governance validation passed."
