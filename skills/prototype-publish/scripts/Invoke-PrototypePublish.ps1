param(
  [ValidateSet('Configure','InstallRuntime','Check','Initialize','Publish')][string]$Action = 'Check',
  [string]$ServerAddress,
  [int]$SshPort = 22,
  [string]$Username,
  [Security.SecureString]$Password,
  [int]$WebPort = 8080,
  [string]$RemoteRoot = '/var/www/_tmp/prototypes',
  [string]$BaseUrl,
  [string]$OutputDirectory,
  [ValidateSet('Auto','Prd','Html')][string]$Mode = 'Auto',
  [string]$EntryPath,
  [string]$TrustFingerprint,
  [string]$ConfigDirectory = (Join-Path $env:LOCALAPPDATA 'Requirement-AI-Toolkit')
)
$ErrorActionPreference = 'Stop'
if ($env:OS -ne 'Windows_NT') { throw '配置凭据需要 Windows 当前用户加密。' }
$configPath = Join-Path $ConfigDirectory 'server.json'
$python = Join-Path $ConfigDirectory 'runtime/Scripts/python.exe'
$worker = Join-Path $PSScriptRoot 'prototype_publish.py'
if ($Action -eq 'Configure') {
  if (-not $ServerAddress -or -not $Username) { throw '需要 ServerAddress 和 Username。' }
  if ($SshPort -lt 1 -or $SshPort -gt 65535 -or $WebPort -lt 1024 -or $WebPort -gt 65535) { throw 'SSH 端口需为 1–65535，网站端口需为 1024–65535。' }
  if ($ServerAddress -notmatch '^[a-zA-Z0-9][a-zA-Z0-9.:-]*$' -or $Username -notmatch '^[a-z_][a-z0-9_-]*[$]?$') { throw '服务器地址或 Linux 用户名格式不正确。' }
  if ($RemoteRoot -notmatch '^/(?:[a-zA-Z0-9_-]+/)+[a-zA-Z0-9_-]+$') { throw 'RemoteRoot 需要专用绝对目录（至少两层，不含空格或 ..）。' }
  if (-not $BaseUrl) {
    $urlHost = if ($ServerAddress.Contains(':')) { "[$ServerAddress]" } else { $ServerAddress }
    $BaseUrl = "http://${urlHost}:$WebPort/_tmp/prototypes"
  }
  $uri = [Uri]$BaseUrl
  if (-not $uri.IsAbsoluteUri -or $uri.Scheme -ne 'http' -or $uri.UserInfo -or $uri.Query -or $uri.Fragment -or $BaseUrl -cnotmatch '^http://[^/?#]+(?:/[A-Za-z0-9_-]+)*/?$') { throw 'BaseUrl 需要 HTTP 地址，可含仅由字母、数字、下划线或连字符组成的路径段，不含账号、查询参数或片段。' }
  if (-not $Password) { $Password = Read-Host 'SSH 密码' -AsSecureString }
  if ($Password.Length -eq 0) { throw '密码不能为空。' }
  New-Item -ItemType Directory -Force -Path $ConfigDirectory | Out-Null
  $config = [ordered]@{ schemaVersion=1; host=$ServerAddress; sshPort=$SshPort; username=$Username; encryptedPassword=($Password | ConvertFrom-SecureString); webPort=$WebPort; remoteRoot=$RemoteRoot; baseUrl=$BaseUrl.TrimEnd('/') }
  $temporary = "$configPath.$([Guid]::NewGuid().ToString('N')).tmp"
  $config | ConvertTo-Json | Set-Content -LiteralPath $temporary -Encoding UTF8
  Move-Item -LiteralPath $temporary -Destination $configPath -Force
  Write-Output "已保存服务器配置：$configPath（密码仅当前 Windows 用户可解密）"
  return
}
if ($Action -eq 'InstallRuntime') {
  New-Item -ItemType Directory -Force -Path $ConfigDirectory | Out-Null
  if (-not (Test-Path -LiteralPath $python)) {
    & python -m venv (Join-Path $ConfigDirectory 'runtime')
    if ($LASTEXITCODE -ne 0) { throw '创建 Python 虚拟环境失败，需要可用的 Python 3.10+。' }
  }
  & $python -m pip install -r (Join-Path $PSScriptRoot 'publish-requirements.txt')
  if ($LASTEXITCODE -ne 0) { throw '安装 SSH 发布依赖失败。' }
  return
}
if (-not (Test-Path -LiteralPath $configPath)) {
  throw '尚未配置服务器，请先运行 Configure。'
}
if (-not (Test-Path -LiteralPath $python)) { throw '尚未安装发布运行时，请先运行 InstallRuntime。' }
if ($Action -eq 'Publish') {
  if (-not $OutputDirectory) { throw 'Publish 需要 OutputDirectory。' }
  if (Test-Path -LiteralPath $OutputDirectory -PathType Leaf) {
    if ($EntryPath) { throw '指定单个 HTML 文件时不要同时指定 EntryPath。' }
    $EntryPath = Split-Path -Leaf $OutputDirectory
    $OutputDirectory = Split-Path -Parent ([IO.Path]::GetFullPath($OutputDirectory))
  }
}
$config = Get-Content -LiteralPath $configPath -Raw -Encoding UTF8 | ConvertFrom-Json
$secure = ConvertTo-SecureString $config.encryptedPassword
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
  $request = @{ action=$Action.ToLowerInvariant(); config=$config; password=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer); configDirectory=$ConfigDirectory; outputDirectory=$OutputDirectory; trustFingerprint=$TrustFingerprint; mode=$Mode.ToLowerInvariant(); entryPath=$EntryPath }
  $request.config.PSObject.Properties.Remove('encryptedPassword')
  $start = New-Object Diagnostics.ProcessStartInfo
  $start.FileName = $python
  $start.Arguments = '"' + $worker + '"'
  $start.UseShellExecute = $false
  $start.CreateNoWindow = $true
  $start.RedirectStandardInput = $true
  $start.StandardInputEncoding = New-Object Text.UTF8Encoding($false)
  $start.EnvironmentVariables['PYTHONIOENCODING'] = 'utf-8'
  $process = [Diagnostics.Process]::Start($start)
  $process.StandardInput.WriteLine(($request | ConvertTo-Json -Depth 8 -Compress))
  $process.StandardInput.Close()
  $process.WaitForExit()
  if ($process.ExitCode -ne 0) { throw '远程操作失败，详见上方诊断；本次更新未发布。' }
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
  $request = $null
  $secure.Dispose()
}
