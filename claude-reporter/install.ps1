# Registers a Task Scheduler task that runs the Claude reporter every 5 minutes,
# hidden, as the current user. Run again to update it; remove it with:
#   Unregister-ScheduledTask -TaskName KindleDashClaudeReporter -Confirm:$false
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not (Test-Path "$dir\config.json")) { throw "Create $dir\config.json from config.example.json first" }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw "node is not on PATH" }

$action = New-ScheduledTaskAction -Execute 'wscript.exe' -Argument "`"$dir\run-hidden.vbs`""
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 5)
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 4) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName 'KindleDashClaudeReporter' -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null
Start-ScheduledTask -TaskName 'KindleDashClaudeReporter'
Write-Host "Installed. Output of each run: $dir\last-run.log"
