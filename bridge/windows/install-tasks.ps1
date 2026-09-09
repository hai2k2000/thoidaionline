$ErrorActionPreference = "Stop"
$ps = "$env:WINDIR\SysWOW64\WindowsPowerShell\v1.0\powershell.exe"
$script = "C:\WiseEyeOn39\bridge\attendance-bridge.ps1"
$workingDirectory = "C:\WiseEyeOn39\bridge"

# Keep scheduled bridge runs invisible while preserving the existing cadence.
$pollAction = New-ScheduledTaskAction -Execute $ps -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$script`" -Once" -WorkingDirectory $workingDirectory
$dailyAction = New-ScheduledTaskAction -Execute $ps -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$script`" -Daily" -WorkingDirectory $workingDirectory
Set-ScheduledTask -TaskName "WiseEye Attendance Bridge Poll" -Action $pollAction | Out-Null
Set-ScheduledTask -TaskName "WiseEye Attendance Daily Sync" -Action $dailyAction | Out-Null
