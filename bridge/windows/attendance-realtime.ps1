param([string]$ConfigPath = "C:\WiseEyeOn39\bridge\config.json")
$ErrorActionPreference = "Stop"
$apiBase = "https://www.thoidai.online"; $deviceId = "wise-eye-on-39-machine-1"; $deviceIp = "192.168.79.201"; $devicePort = 4370; $machineNumber = 1
$statePath = "C:\WiseEyeOn39\bridge\realtime-seen.json"; $spoolPath = "C:\WiseEyeOn39\bridge\realtime-spool.jsonl"
$config = Get-Content $ConfigPath -Raw | ConvertFrom-Json; $headers = @{ "x-attendance-bridge-token" = [string]$config.bridgeToken }
$seen = @{}; if (Test-Path $statePath) { (Get-Content $statePath -Raw | ConvertFrom-Json).psobject.Properties | ForEach-Object { $seen[$_.Name] = $true } }
function Test-AttendanceWindow([datetime]$Time) {
  $minuteOfDay = ($Time.Hour * 60) + $Time.Minute
  return ($minuteOfDay -ge 450 -and $minuteOfDay -le 570) -or
    ($minuteOfDay -ge 990 -and $minuteOfDay -le 1110)
}
function Send-Punch($row) { try { Invoke-RestMethod -Uri "$apiBase/api/attendance/sync/realtime" -Method POST -Headers $headers -ContentType "application/json" -Body ($row | ConvertTo-Json -Compress) | Out-Null; return $true } catch { Add-Content -Path $spoolPath -Value ($row | ConvertTo-Json -Compress); return $false } }
function Read-DeviceData {
  $zk = New-Object -ComObject "zkemkeeper.ZKEM"; $connected = $false
  try {
    $connected = $zk.Connect_Net($deviceIp, $devicePort); if (-not $connected) { throw "Wise Eye device connection failed" }
    [void]$zk.ReadGeneralLogData($machineNumber); $rows = @()
    while ($true) {
      $pin=""; $verify=0; $inOut=0; $year=0; $month=0; $day=0; $hour=0; $minute=0; $second=0; $workCode=0
      if (-not $zk.SSR_GetGeneralLogData($machineNumber,[ref]$pin,[ref]$verify,[ref]$inOut,[ref]$year,[ref]$month,[ref]$day,[ref]$hour,[ref]$minute,[ref]$second,[ref]$workCode)) { break }
      $local = Get-Date -Year $year -Month $month -Day $day -Hour $hour -Minute $minute -Second $second
      $rows += [pscustomobject]@{ device_id=$deviceId; enroll_number=[string]$pin; punched_at=$local.ToString("yyyy-MM-ddTHH:mm:ss+07:00"); verify_mode=[int]$verify; in_out_mode=[int]$inOut; work_code=[int]$workCode }
    }
    return $rows
  } finally { if ($connected) { [void]$zk.Disconnect() } }
}
while ($true) {
  if (-not (Test-AttendanceWindow (Get-Date))) {
    Start-Sleep -Seconds 30
    continue
  }
  try {
    foreach ($row in @(Read-DeviceData)) {
      $key = "$($row.enroll_number)|$($row.punched_at)"
      if (-not $seen.ContainsKey($key)) { if (Send-Punch $row) { $seen[$key] = $true } }
    }
    $snapshot = [ordered]@{}; $seen.Keys | Select-Object -Last 5000 | ForEach-Object { $snapshot[$_] = $true }
    $snapshot | ConvertTo-Json -Compress | Set-Content $statePath
  } catch { }
  Start-Sleep -Seconds 5
}
