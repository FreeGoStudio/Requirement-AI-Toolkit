param(
  [Parameter(Mandatory = $true)][string]$ProductId,
  [string]$WorkspaceRoot,
  [string]$UserRoot,
  [string]$ConfigPath = (Join-Path (Split-Path -Parent $PSScriptRoot) "references\knowledge-bases.json"),
  [string]$CurrentDirectory = (Get-Location).Path,
  [string]$FallbackRoot
)

$ErrorActionPreference = "Stop"

function Resolve-FullPath {
  param([string]$Path)
  if ([string]::IsNullOrWhiteSpace($Path)) { return $null }
  try { return [IO.Path]::GetFullPath($Path) } catch { return $null }
}

function Add-Candidate {
  param([Collections.Generic.List[object]]$List, [string]$Root, [string]$Source)
  $resolved = Resolve-FullPath $Root
  if (-not $resolved) { return }
  if ($List | Where-Object { $_.root -eq $resolved }) { return }
  $List.Add([pscustomobject]@{ root = $resolved; resolvedBy = $Source })
}

if (-not (Test-Path -LiteralPath $ConfigPath -PathType Leaf)) { throw "Knowledge-base config not found: $ConfigPath" }
$config = Get-Content -LiteralPath $ConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json
$product = $config.products | Where-Object { $_.productId -eq $ProductId } | Select-Object -First 1
if (-not $product) { throw "Unknown productId: $ProductId" }

$candidates = [Collections.Generic.List[object]]::new()
Add-Candidate $candidates $UserRoot "user"

$environmentRoot = [Environment]::GetEnvironmentVariable($config.environmentRootVariable)
Add-Candidate $candidates $environmentRoot "environment"

if (-not [string]::IsNullOrWhiteSpace($WorkspaceRoot)) {
  Add-Candidate $candidates (Join-Path $WorkspaceRoot $config.workspaceRelativeRoot) "workspace"
} else {
  $cursor = Resolve-FullPath $CurrentDirectory
  while ($cursor) {
    $knowledge = Join-Path $cursor $config.workspaceRelativeRoot
    if (Test-Path -LiteralPath $knowledge -PathType Container) {
      Add-Candidate $candidates $knowledge "workspace"
      break
    }
    $parent = [IO.Directory]::GetParent($cursor)
    if (-not $parent) { break }
    $cursor = $parent.FullName
  }
}

$effectiveFallbackRoot = if ($PSBoundParameters.ContainsKey("FallbackRoot")) { $FallbackRoot } else { $config.fallbackRoot }
Add-Candidate $candidates $effectiveFallbackRoot "fallback"

$checks = @()
foreach ($candidate in $candidates) {
  $manifestPath = Join-Path $candidate.root $product.manifest
  $screenshotPath = Join-Path $candidate.root $product.screenshotDirectory
  $manifestExists = Test-Path -LiteralPath $manifestPath -PathType Leaf
  $screenshotExists = Test-Path -LiteralPath $screenshotPath -PathType Container
  $checks += [pscustomobject]@{
    root = $candidate.root
    resolvedBy = $candidate.resolvedBy
    manifestPath = $manifestPath
    screenshotPath = $screenshotPath
    manifestExists = $manifestExists
    screenshotDirectoryExists = $screenshotExists
  }
  if ($manifestExists -and $screenshotExists) {
    [pscustomobject]@{
      productId = $ProductId
      status = "available"
      resolvedBy = $candidate.resolvedBy
      root = $candidate.root
      manifestPath = $manifestPath
      screenshotPath = $screenshotPath
      checks = $checks
    } | ConvertTo-Json -Depth 6
    return
  }
}

[pscustomobject]@{
  productId = $ProductId
  status = "blocked"
  resolvedBy = "none"
  root = $null
  manifestPath = $null
  screenshotPath = $null
  checks = $checks
} | ConvertTo-Json -Depth 6
