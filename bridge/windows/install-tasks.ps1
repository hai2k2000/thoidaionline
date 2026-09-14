$ErrorActionPreference = "Stop"
$launcher = "C:\Python314\pythonw.exe"
$script = "C:\WiseEyeOn39\bridge\attendance-bridge.ps1"
$workingDirectory = "C:\WiseEyeOn39\bridge"
$hiddenRunner = "C:\WiseEyeOn39\bridge\run-attendance-hidden.pyw"
$watchdog = "C:\WiseEyeOn39\bridge\run-attendance-watchdog.pyw"
$realtimeScript = "C:\WiseEyeOn39\bridge\attendance-realtime.ps1"

# pythonw creates the 32-bit PowerShell child with CREATE_NO_WINDOW.
$pollAction = New-ScheduledTaskAction -Execute $launcher -Argument "`"$hiddenRunner`" `"$script`" -Once" -WorkingDirectory $workingDirectory
$dailyAction = New-ScheduledTaskAction -Execute $launcher -Argument "`"$hiddenRunner`" `"$script`" -Daily" -WorkingDirectory $workingDirectory
$realtimeAction = New-ScheduledTaskAction -Execute $launcher -Argument "`"$hiddenRunner`" `"$realtimeScript`"" -WorkingDirectory $workingDirectory
Set-ScheduledTask -TaskName "WiseEye Attendance Bridge Poll" -Action $pollAction | Out-Null
Set-ScheduledTask -TaskName "WiseEye Attendance Daily Sync" -Action $dailyAction | Out-Null
$hiddenSettings = New-ScheduledTaskSettingsSet -Hidden
Set-ScheduledTask -TaskName "WiseEye Attendance Bridge Poll" -Settings $hiddenSettings | Out-Null
Set-ScheduledTask -TaskName "WiseEye Attendance Daily Sync" -Settings $hiddenSettings | Out-Null

# Keep realtime running after user logon and recover it silently if it exits.
$realtimeTrigger = New-ScheduledTaskTrigger -AtLogOn
$realtimeSettings = New-ScheduledTaskSettingsSet -Hidden -MultipleInstances IgnoreNew -RestartCount 20 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero)
$realtimePrincipal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Highest
try {
    Register-ScheduledTask -TaskName "WiseEye Attendance Realtime" -Action $realtimeAction -Trigger $realtimeTrigger -Settings $realtimeSettings -Principal $realtimePrincipal -Force | Out-Null
} catch {
    # Non-admin sessions can still start the hidden bridge through the user's Run key.
    $runCommand = "`"$launcher`" `"$watchdog`" `"$realtimeScript`""
    New-Item -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run" -Force | Out-Null
    Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run" -Name "WiseEye Attendance Realtime" -Value $runCommand
}

# Realtime covers attendance windows; disabling minute polling avoids COM console flashes.
Disable-ScheduledTask -TaskName "WiseEye Attendance Bridge Poll" | Out-Null
