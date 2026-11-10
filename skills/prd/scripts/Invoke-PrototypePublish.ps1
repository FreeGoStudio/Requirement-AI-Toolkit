param(
  [ValidateSet('Configure','InstallRuntime','Check','Initialize','Publish','SyncLinks')][string]$Action = 'Check',
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
  [switch]$LinksPending,
  [string]$TrustFingerprint,
  [string]$ConfigDirectory = (Join-Path $env:LOCALAPPDATA 'Requirement-AI-Toolkit')
)
$ErrorActionPreference = 'Stop'
$publisher = Join-Path $PSScriptRoot '../../prototype-publish/scripts/Invoke-PrototypePublish.ps1'
if (-not (Test-Path -LiteralPath $publisher)) { throw '发布能力已拆为独立技能，请先安装 prototype-publish。' }
& $publisher @PSBoundParameters
