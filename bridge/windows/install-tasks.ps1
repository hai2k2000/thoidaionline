$ErrorActionPreference = "Stop"
$launcher = "C:\Python314\pythonw.exe"
$script = "C:\WiseEyeOn39\bridge\attendance-bridge.ps1"
$workingDirectory = "C:\WiseEyeOn39\bridge"
$hiddenRunner = "C:\WiseEyeOn39\bridge\run-attendance-hidden.pyw"

# pythonw creates the 32-bit PowerShell child with CREATE_NO_WINDOW.
$pollAction = New-ScheduledTaskAction -Execute $launcher -Argument "`"$hiddenRunner`" `"$script`" -Once" -WorkingDirectory $workingDirectory
$dailyAction = New-ScheduledTaskAction -Execute $launcher -Argument "`"$hiddenRunner`" `"$script`" -Daily" -WorkingDirectory $workingDirectory
Set-ScheduledTask -TaskName "WiseEye Attendance Bridge Poll" -Action $pollAction | Out-Null
Set-ScheduledTask -TaskName "WiseEye Attendance Daily Sync" -Action $dailyAction | Out-Null
$hiddenSettings = New-ScheduledTaskSettingsSet -Hidden
Set-ScheduledTask -TaskName "WiseEye Attendance Bridge Poll" -Settings $hiddenSettings | Out-Null
Set-ScheduledTask -TaskName "WiseEye Attendance Daily Sync" -Settings $hiddenSettings | Out-Null

# Realtime covers attendance windows; disabling minute polling avoids COM console flashes.
Disable-ScheduledTask -TaskName "WiseEye Attendance Bridge Poll" | Out-Null
