param(
  [Parameter(Mandatory = $true)][string]$ProductId,
  [Parameter(Mandatory = $true)][string]$WorkspaceRoot,
  [string]$ConfigPath = (Join-Path (Split-Path -Parent $PSScriptRoot) "references\knowledge-bases.json")
)

$ErrorActionPreference = "Stop"

function Resolve-FullPath {
  param([string]$Path)
  if ([string]::IsNullOrWhiteSpace($Path)) { return $null }
  try { return [IO.Path]::GetFullPath($Path) } catch { return $null }
}

if (-not (Test-Path -LiteralPath $ConfigPath -PathType Leaf)) { throw "Knowledge-base config not found: $ConfigPath" }
$config = Get-Content -LiteralPath $ConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json
if ($config.workspaceRelativeRoot -ne "Knowledge") { throw "workspaceRelativeRoot must be fixed to 'Knowledge'." }
$product = $config.products | Where-Object { $_.productId -eq $ProductId } | Select-Object -First 1
if (-not $product) { throw "Unknown productId: $ProductId" }

$resolvedWorkspaceRoot = Resolve-FullPath $WorkspaceRoot
if (-not $resolvedWorkspaceRoot) { throw "Invalid WorkspaceRoot: $WorkspaceRoot" }

$knowledgeRoot = Join-Path $resolvedWorkspaceRoot "Knowledge"
$manifestPath = Join-Path $knowledgeRoot $product.manifest
$screenshotPath = Join-Path $knowledgeRoot $product.screenshotDirectory
$manifestExists = Test-Path -LiteralPath $manifestPath -PathType Leaf
$screenshotExists = Test-Path -LiteralPath $screenshotPath -PathType Container
$checks = @([pscustomobject]@{
  root = $knowledgeRoot
  resolvedBy = "workspace"
  manifestPath = $manifestPath
  screenshotPath = $screenshotPath
  manifestExists = $manifestExists
  screenshotDirectoryExists = $screenshotExists
})

if ($manifestExists -and $screenshotExists) {
  [pscustomobject]@{
    productId = $ProductId
    status = "available"
    resolvedBy = "workspace"
    root = $knowledgeRoot
    manifestPath = $manifestPath
    screenshotPath = $screenshotPath
    checks = $checks
  } | ConvertTo-Json -Depth 6
  return
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
