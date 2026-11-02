param([string]$ConfigPath, [string[]]$LoadingRoots, [string]$FormalPath)
$arguments = @("$PSScriptRoot/skill_maintenance.py", 'inventory')
if ($ConfigPath) { $arguments += @('--config', $ConfigPath) }
foreach ($root in $LoadingRoots) { $arguments += @('--root', $root) }
if ($FormalPath) { $arguments += @('--formal', $FormalPath) }
& python @arguments
exit $LASTEXITCODE
