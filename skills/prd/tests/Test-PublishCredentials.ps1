$ErrorActionPreference = 'Stop'
$script = Join-Path $PSScriptRoot '../scripts/Invoke-PrototypePublish.ps1'
$temporary = Join-Path ([IO.Path]::GetTempPath()) ('prd-credentials-' + [Guid]::NewGuid().ToString('N'))
try {
  $password = ConvertTo-SecureString 'test-中文-secret-123' -AsPlainText -Force
  & $script -Action Configure -ServerAddress 'example.test' -Username 'tester' -Password $password -ConfigDirectory $temporary
  $raw = Get-Content (Join-Path $temporary 'server.json') -Raw -Encoding UTF8
  if ($raw.Contains('test-中文-secret-123')) { throw 'Password stored in plaintext' }
  $config = $raw | ConvertFrom-Json
  $credential = New-Object Management.Automation.PSCredential('tester', (ConvertTo-SecureString $config.encryptedPassword))
  if ($credential.GetNetworkCredential().Password -cne 'test-中文-secret-123') { throw 'Password roundtrip failed' }
  if ($config.webPort -ne 8080 -or $config.sshPort -ne 22) { throw 'Wrong defaults' }
  & $script -Action Configure -ServerAddress 'example.test' -Username 'tester' -Password $password -WebPort 8081 -ConfigDirectory $temporary
  if ((Get-Content (Join-Path $temporary 'server.json') -Raw | ConvertFrom-Json).webPort -ne 8081) { throw 'Configuration update failed' }
  Write-Output 'PASS: Windows DPAPI password roundtrip, plaintext exclusion, configuration persistence/update.'
} finally {
  $resolved = [IO.Path]::GetFullPath($temporary)
  $tempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
  if ($resolved.StartsWith($tempRoot, [StringComparison]::OrdinalIgnoreCase) -and (Split-Path $resolved -Leaf).StartsWith('prd-credentials-')) {
    Remove-Item -LiteralPath $resolved -Recurse -Force -ErrorAction SilentlyContinue
  }
}
