param([string]$ConfigPath = "$PSScriptRoot/../config.local.json", [switch]$CheckOnly)
$ErrorActionPreference = 'Stop'
$configFile = (Resolve-Path -LiteralPath $ConfigPath).Path
$configuration = Get-Content -LiteralPath $configFile -Raw -Encoding UTF8 | ConvertFrom-Json
$codexCommand = Get-Command codex -CommandType Application -ErrorAction SilentlyContinue
$codexExecutable = if ($codexCommand) { $codexCommand.Source } else { $null }
if (-not $codexExecutable) {
  $codexExecutable = Get-AppxPackage -Name '*Codex*' | ForEach-Object { Join-Path $_.InstallLocation 'app/resources/codex.exe' } | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
}
if (-not $codexExecutable) { throw '未找到 Codex CLI，请先安装 Codex 或将其加入 PATH' }
if ($CheckOnly) { Write-Host '配置文件与 Codex CLI 检查通过；未读取或写入 API key。'; return }
$localDirectory = [IO.Path]::GetFullPath((Join-Path (Split-Path $configFile) '.local'))
New-Item -ItemType Directory -Path $localDirectory -Force | Out-Null
$keyFile = Join-Path $localDirectory 'codex-api-key.txt'
$secureKey = Read-Host '输入平台专用 OpenAI API key（不会显示）' -AsSecureString
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
try {
  $plainKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
  if ([string]::IsNullOrWhiteSpace($plainKey)) { throw 'API key 不能为空' }
  [IO.File]::WriteAllText($keyFile, $plainKey, [Text.UTF8Encoding]::new($false))
} finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer); $plainKey = $null }
$sid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
icacls $keyFile /inheritance:r /grant:r "*${sid}:(F)" '*S-1-5-18:(F)' | Out-Null
if ($LASTEXITCODE -ne 0) { throw '未能限制密钥文件访问权限，请检查文件 ACL' }
$settings = [pscustomobject]@{ provider='codex'; executable=$codexExecutable; api_key_file=$keyFile; timeout_ms=60000 }
$configuration | Add-Member -NotePropertyName conflict_service -NotePropertyValue $settings -Force
[IO.File]::WriteAllText($configFile, ($configuration | ConvertTo-Json -Depth 20), [Text.UTF8Encoding]::new($false))
Write-Host 'Codex API key 已保存在本机受限文件中。重启平台服务后生效；未输出密钥。'
