param(
  [Parameter(Mandatory = $true)][string]$KnowledgeRoot,
  [Parameter(Mandatory = $true)][string]$ManifestPath
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing
$manifestFile = if ([IO.Path]::IsPathRooted($ManifestPath)) { $ManifestPath } else { Join-Path $KnowledgeRoot $ManifestPath }
if (-not (Test-Path -LiteralPath $manifestFile -PathType Leaf)) { throw "Manifest not found: $manifestFile" }
$manifest = Get-Content -LiteralPath $manifestFile -Raw -Encoding UTF8 | ConvertFrom-Json
$root = Join-Path $KnowledgeRoot $manifest.screenshotDirectory
$known = @{}
foreach ($screen in $manifest.screens) { $known[$screen.file] = $screen.semantic }
$screens = @()
foreach ($file in Get-ChildItem -LiteralPath $root -File -Filter *.png | Sort-Object Name) {
  if (-not $known.ContainsKey($file.Name)) { throw "Add semantic metadata before syncing new screenshot: $($file.Name)" }
  $image = [Drawing.Image]::FromFile($file.FullName)
  try {
    $screens += [ordered]@{
      file = $file.Name
      automatic = [ordered]@{
        width = $image.Width
        height = $image.Height
        lastModifiedUtc = $file.LastWriteTimeUtc.ToString("o")
        sizeBytes = $file.Length
      }
      semantic = $known[$file.Name]
    }
  } finally { $image.Dispose() }
}
if ($screens.Count -ne $manifest.screens.Count) { throw "Manifest contains entries that do not map to PNG files." }
$manifest.generatedAtUtc = [DateTime]::UtcNow.ToString("o")
$manifest.screens = $screens
$json = $manifest | ConvertTo-Json -Depth 12
[IO.File]::WriteAllText($manifestFile, $json + [Environment]::NewLine, [Text.UTF8Encoding]::new($false))
Write-Host "Manifest synchronized: $($screens.Count) entries. Manual semantic metadata preserved."
