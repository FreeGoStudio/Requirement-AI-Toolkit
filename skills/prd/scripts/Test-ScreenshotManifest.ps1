param(
  [Parameter(Mandatory = $true)][string]$KnowledgeRoot,
  [Parameter(Mandatory = $true)][string]$ManifestPath
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$manifestFile = if ([IO.Path]::IsPathRooted($ManifestPath)) { $ManifestPath } else { Join-Path $KnowledgeRoot $ManifestPath }
if (-not (Test-Path -LiteralPath $manifestFile -PathType Leaf)) { throw "Manifest not found: $manifestFile" }

$manifest = Get-Content -LiteralPath $manifestFile -Raw -Encoding UTF8 | ConvertFrom-Json
$screenshotRoot = Join-Path $KnowledgeRoot $manifest.screenshotDirectory
$errors = [Collections.Generic.List[string]]::new()
$ids = @{}
$paths = @{}

foreach ($screen in $manifest.screens) {
  if ([string]::IsNullOrWhiteSpace($screen.semantic.screenId)) { $errors.Add("Missing screenId: $($screen.file)") }
  elseif ($ids.ContainsKey($screen.semantic.screenId)) { $errors.Add("Duplicate screenId: $($screen.semantic.screenId)") }
  else { $ids[$screen.semantic.screenId] = $true }

  if ($paths.ContainsKey($screen.file)) { $errors.Add("Duplicate file: $($screen.file)") } else { $paths[$screen.file] = $true }
  $file = Join-Path $screenshotRoot $screen.file
  if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { $errors.Add("Missing screenshot: $file"); continue }

  $image = [Drawing.Image]::FromFile($file)
  try {
    if ($screen.automatic.width -ne $image.Width -or $screen.automatic.height -ne $image.Height) {
      $errors.Add("Dimension mismatch: $($screen.file), manifest=$($screen.automatic.width)x$($screen.automatic.height), actual=$($image.Width)x$($image.Height)")
    }
  } finally { $image.Dispose() }
  if ($screen.automatic.sizeBytes -ne (Get-Item -LiteralPath $file).Length) { $errors.Add("Size mismatch: $($screen.file)") }
  if ([string]::IsNullOrWhiteSpace($screen.automatic.lastModifiedUtc)) { $errors.Add("Missing lastModifiedUtc: $($screen.file)") }
}

foreach ($screen in $manifest.screens) {
  $base = $screen.semantic.baseScreenId
  if ($base -and -not $ids.ContainsKey($base)) { $errors.Add("Invalid baseScreenId: $($screen.semantic.screenId) -> $base") }
}

$actualFiles = @(Get-ChildItem -LiteralPath $screenshotRoot -File -Filter *.png)
foreach ($file in $actualFiles) { if (-not $paths.ContainsKey($file.Name)) { $errors.Add("Unindexed screenshot: $($file.Name)") } }

if ($errors.Count -gt 0) { $errors | ForEach-Object { Write-Error $_ }; throw "Manifest validation failed with $($errors.Count) error(s)." }
Write-Host "Manifest valid: $($manifest.screens.Count) entries, $($actualFiles.Count) PNG files."
