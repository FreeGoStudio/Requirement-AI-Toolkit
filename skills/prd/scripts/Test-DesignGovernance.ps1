param(
  [Parameter(Mandatory = $true)][string]$ManifestPath,
  [string]$PrototypeSpecPath,
  [ValidateSet('preflight', 'postwrite')][string]$Phase = 'preflight'
)
$ErrorActionPreference = 'Stop'
function Require($Condition, [string]$Message) {
  if (-not $Condition) { throw "HTML governance: $Message" }
}
function Read-Json([string]$Path) {
  Require (Test-Path -LiteralPath $Path -PathType Leaf) "Missing JSON: $Path"
  Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json
}
function Has-Text($Value) { return $Value -is [string] -and -not [string]::IsNullOrWhiteSpace($Value) }
$manifest = Read-Json $ManifestPath
$root = Split-Path -Parent ([IO.Path]::GetFullPath($ManifestPath))
function Check-Path($Path, [bool]$MustExist) {
  Require (Has-Text $Path) 'Missing relative file path'
  Require ($Path -notmatch '[:\\?#]' -and -not [IO.Path]::IsPathRooted($Path)) "Not a portable relative path: $Path"
  Require ($Path.Split('/') -notcontains '..' -and $Path.Split('/') -notcontains '.' -and $Path.Split('/') -notcontains '') "Non-canonical path: $Path"
  $full = [IO.Path]::GetFullPath((Join-Path $root $Path))
  Require ($full.StartsWith($root + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) "Path outside output directory: $Path"
  if ($MustExist) { Require (Test-Path -LiteralPath $full -PathType Leaf) "Missing output file: $Path" }
}
Require ($manifest.schemaVersion -eq 1) 'Unsupported schemaVersion'
Require (Has-Text $manifest.productDomain) 'Missing productDomain'
Require ($manifest.designSystem.status -in @('absent', 'candidate', 'approved')) 'Invalid design system status'
$assetMap = @{}
foreach ($asset in @($manifest.designSystem.assets)) {
  Require (Has-Text $asset.id) 'Missing asset id'
  Require (-not $assetMap.ContainsKey($asset.id)) "Duplicate asset: $($asset.id)"
  Require ($asset.type -in @('tokens', 'component', 'pattern', 'view-template')) 'Invalid asset type'
  Require ($asset.status -in @('candidate', 'approved', 'deprecated')) 'Invalid asset status'
  Require (Has-Text $asset.selector) 'Missing asset selector'
  Check-Path $asset.path ($Phase -eq 'postwrite')
  $assetMap[$asset.id] = $asset
}
$flowMap = @{}
$paths = @{}
foreach ($flow in @($manifest.flows)) {
  Require ($flow.flowId -cmatch '^[a-z0-9]+(?:-[a-z0-9]+)*$') 'Invalid flowId'
  Require (Has-Text $flow.flowName) 'Missing flowName'
  Require (-not $flowMap.ContainsKey($flow.flowId)) "Duplicate flowId: $($flow.flowId)"
  $flowMap[$flow.flowId] = $flow
  foreach ($fidelity in @('low', 'high')) {
    $path = $flow.entries.$fidelity
    if (Has-Text $path) {
      Check-Path $path ($Phase -eq 'postwrite')
      Require ($path -ceq "prototypes/$fidelity/$($flow.flowId).html") "Unexpected flow entry: $path"
      Require (-not $paths.ContainsKey($path)) "Duplicate entry: $path"
      $paths[$path] = $true
    }
  }
}
if (Has-Text $PrototypeSpecPath) {
  $spec = Read-Json $PrototypeSpecPath
  $id = $spec.flowIdentity.flowId
  $fidelity = $spec.flowIdentity.fidelity
  Require ($id -cmatch '^[a-z0-9]+(?:-[a-z0-9]+)*$') 'Invalid spec flowId'
  Require (Has-Text $spec.flowIdentity.flowName) 'Missing spec flowName'
  Require (Has-Text $spec.flowIdentity.objective) 'Missing flow objective'
  Require ($fidelity -in @('low', 'high') -and $spec.mode -eq "$fidelity-fidelity") 'Mode/fidelity mismatch'
  Require ($spec.productDomain -eq $manifest.productDomain) 'Product domain mismatch'
  Require ($spec.flowIdentity.changeType -in @('new-flow', 'fix', 'iteration', 'redesign')) 'Invalid changeType'
  Require ($spec.prototypeReferenceGate.userDecision -in @('provided-reference', 'use-existing-prototype', 'continue-without-reference')) 'Reference decision pending or invalid'
  Check-Path $spec.prototypeReferenceGate.evidence ($Phase -eq 'postwrite')
  $path = $spec.htmlStrategy.entryPath
  Check-Path $path ($Phase -eq 'postwrite')
  Require ($path -ceq "prototypes/$fidelity/$id.html") 'Entry does not match flow/fidelity'
  $existing = if ($flowMap.ContainsKey($id)) { $flowMap[$id].entries.$fidelity } else { $null }
  $action = $spec.htmlStrategy.action
  Require ($action -in @('create', 'update')) 'Invalid HTML action'
  if ($spec.flowIdentity.changeType -in @('fix', 'iteration')) { Require ($action -eq 'update') 'Fix/iteration must update existing entry' }
  if ($action -eq 'update' -or $Phase -eq 'postwrite') {
    Require ((Has-Text $existing) -and $existing -ceq $path) 'Entry must match manifest'
  } elseif ($action -eq 'create') {
    Require (-not (Has-Text $existing)) 'Create would duplicate flow/fidelity'
    Require (-not (Test-Path -LiteralPath (Join-Path $root $path))) 'Unregistered existing file would be overwritten'
  }
  Require (@($spec.screens).Count -gt 0) 'At least one screen is required'
  $screens = @{}
  foreach ($screen in @($spec.screens)) {
    Require (Has-Text $screen.screenId) 'Missing screenId'
    Require (-not $screens.ContainsKey($screen.screenId)) 'Duplicate screenId'
    Require (@($screen.states).Count -gt 0) 'Screen requires states'
    $screens[$screen.screenId] = $true
  }
  if ($fidelity -eq 'high') {
    Require ($manifest.designSystem.status -eq 'approved' -and $spec.designSystemDependency.status -eq 'approved') 'High fidelity requires approved design system'
    $types = @()
    foreach ($assetId in @($spec.designSystemDependency.assetIds)) {
      Require ($assetMap.ContainsKey($assetId) -and $assetMap[$assetId].status -eq 'approved') "Unapproved asset dependency: $assetId"
      $types += $assetMap[$assetId].type
    }
    Require ($types -contains 'tokens' -and $types -contains 'component') 'High fidelity requires tokens and component dependencies'
  }
}
Write-Output 'HTML design governance validation passed (browser verification is separate).'
