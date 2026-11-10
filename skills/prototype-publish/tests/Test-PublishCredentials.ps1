$ErrorActionPreference = 'Stop'
$script = Join-Path $PSScriptRoot '../scripts/Invoke-PrototypePublish.ps1'
$temporary = Join-Path ([IO.Path]::GetTempPath()) ('prd-credentials-' + [Guid]::NewGuid().ToString('N'))
try {
  function Assert-ConfigurationBlocked([string]$ExpectedReason) {
    $failure = $null
    try { & $script -Action Publish -Mode Html -OutputDirectory (Join-Path $temporary 'source') -ConfigDirectory $temporary }
    catch { $failure = $_.Exception.Message }
    if (-not $failure -or -not $failure.Contains('本次未发布') -or -not $failure.Contains($ExpectedReason) -or -not $failure.Contains('-Action Configure') -or -not $failure.Contains('-Action Check')) {
      throw "Expected actionable configuration failure: $failure"
    }
    if (Test-Path (Join-Path $temporary 'source/.prototype-publication.json')) { throw 'Unconfigured publish changed source state' }
  }
  Assert-ConfigurationBlocked '尚未配置服务器'
  New-Item -ItemType Directory -Force -Path $temporary | Out-Null
  '{}' | Set-Content (Join-Path $temporary 'server.json') -Encoding UTF8
  Assert-ConfigurationBlocked 'host'
  '{invalid json' | Set-Content (Join-Path $temporary 'server.json') -Encoding UTF8
  Assert-ConfigurationBlocked '有效 JSON'
  $password = ConvertTo-SecureString 'test-中文-secret-123' -AsPlainText -Force
  & $script -Action Configure -ServerAddress 'example.test' -Username 'tester' -Password $password -ConfigDirectory $temporary
  $raw = Get-Content (Join-Path $temporary 'server.json') -Raw -Encoding UTF8
  if ($raw.Contains('test-中文-secret-123')) { throw 'Password stored in plaintext' }
  $config = $raw | ConvertFrom-Json
  $credential = New-Object Management.Automation.PSCredential('tester', (ConvertTo-SecureString $config.encryptedPassword))
  if ($credential.GetNetworkCredential().Password -cne 'test-中文-secret-123') { throw 'Password roundtrip failed' }
  if ($config.webPort -ne 8080 -or $config.sshPort -ne 22) { throw 'Wrong defaults' }
  if ($config.remoteRoot -ne '/var/www/_tmp/prototypes' -or $config.baseUrl -ne 'http://example.test:8080/_tmp/prototypes') { throw 'Temporary path defaults missing' }
  $config.host = ' '
  $config | ConvertTo-Json | Set-Content (Join-Path $temporary 'server.json') -Encoding UTF8
  Assert-ConfigurationBlocked 'host'
  & $script -Action Configure -ServerAddress 'example.test' -Username 'tester' -Password $password -WebPort 8081 -ConfigDirectory $temporary
  if ((Get-Content (Join-Path $temporary 'server.json') -Raw | ConvertFrom-Json).webPort -ne 8081) { throw 'Configuration update failed' }
  Write-Output 'PASS: missing/empty/corrupt configuration blocks publish with setup guidance; DPAPI roundtrip, plaintext exclusion, persistence/update.'
} finally {
  $resolved = [IO.Path]::GetFullPath($temporary)
  $tempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
  if ($resolved.StartsWith($tempRoot, [StringComparison]::OrdinalIgnoreCase) -and (Split-Path $resolved -Leaf).StartsWith('prd-credentials-')) {
    Remove-Item -LiteralPath $resolved -Recurse -Force -ErrorAction SilentlyContinue
  }
}
