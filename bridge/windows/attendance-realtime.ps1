param([string]$ConfigPath = "C:\WiseEyeOn39\bridge\config.json")
$ErrorActionPreference = "Stop"
$apiBase = "https://www.thoidai.online"; $deviceId = "wise-eye-on-39-machine-1"; $deviceIp = "192.168.79.201"; $devicePort = 4370; $machineNumber = 1
$statePath = "C:\WiseEyeOn39\bridge\realtime-seen.json"; $spoolPath = "C:\WiseEyeOn39\bridge\realtime-spool.jsonl"; $deferredSpoolPath = "C:\WiseEyeOn39\bridge\realtime-deferred.jsonl"
$config = Get-Content $ConfigPath -Raw | ConvertFrom-Json; $headers = @{ "x-attendance-bridge-token" = [string]$config.bridgeToken }
$instanceMutex = [System.Threading.Mutex]::new($false, "Global\WiseEyeOn39AttendanceRealtime")
if (-not $instanceMutex.WaitOne(0)) { exit 0 }
$seen = @{}; if (Test-Path $statePath) { (Get-Content $statePath -Raw | ConvertFrom-Json).psobject.Properties | ForEach-Object { $seen[$_.Name] = $true } }
function Invoke-BridgeApi([string]$Path, [string]$Method = "GET", $Body = $null) {
  $params = @{ Uri = "$apiBase$Path"; Method = $Method; Headers = $headers; ContentType = "application/json" }
  if ($null -ne $Body) { $params.Body = ($Body | ConvertTo-Json -Depth 8 -Compress) }
  Invoke-RestMethod @params
}
function Punch-Key($row) { return "$($row.enroll_number)|$($row.punched_at)" }
function Get-SpoolRows {
  if (-not (Test-Path $spoolPath)) { return @() }
  $rows = @(); $keys = @{}
  foreach ($line in @(Get-Content $spoolPath)) {
    try {
      $row = $line | ConvertFrom-Json; $key = Punch-Key $row
      if ($row.enroll_number -and $row.punched_at -and -not $keys.ContainsKey($key)) { $keys[$key] = $true; $rows += $row }
    } catch { }
  }
  return $rows
}
function Add-ToSpool($row) {
  $key = Punch-Key $row
  if (-not (Get-SpoolRows | Where-Object { (Punch-Key $_) -eq $key })) {
    Add-Content -Path $spoolPath -Value ($row | ConvertTo-Json -Compress)
  }
}
function Add-ToDeferredSpool($row) {
  $key = Punch-Key $row
  $exists = if (Test-Path $deferredSpoolPath) { @(Get-Content $deferredSpoolPath | Where-Object { try { (Punch-Key ($_ | ConvertFrom-Json)) -eq $key } catch { $false } }).Count -gt 0 } else { $false }
  if (-not $exists) { Add-Content -Path $deferredSpoolPath -Value ($row | ConvertTo-Json -Compress) }
}
function Write-SpoolRows([string]$Path, $rows) {
  $tempPath = "$Path.tmp.$PID"
  try {
    if ($rows.Count) { $rows | ForEach-Object { $_ | ConvertTo-Json -Compress } | Set-Content -Path $tempPath }
    else { Set-Content -Path $tempPath -Value "" }
    Move-Item -LiteralPath $tempPath -Destination $Path -Force
  } finally {
    if (Test-Path $tempPath) { Remove-Item -LiteralPath $tempPath -Force -ErrorAction SilentlyContinue }
  }
}
function Send-PunchCore($row) {
  try {
    $response = Invoke-RestMethod -Uri "$apiBase/api/attendance/sync/realtime" -Method POST -Headers $headers -ContentType "application/json" -Body ($row | ConvertTo-Json -Compress)
    if ($response.skipped -eq $true) { return $false }
    return $true
  } catch { return $false }
}
function Send-Punch($row) {
  if (Send-PunchCore $row) { return $true }
  Add-ToSpool $row
  return $false
}
function Replay-Spool {
  $rows = @(Get-SpoolRows); if (-not $rows.Count) { return }
  $remaining = @()
  foreach ($row in $rows) {
    if (Test-RecentPunch $row) {
      if (Send-PunchCore $row) { $seen[(Punch-Key $row)] = $true }
      else { $remaining += $row }
    }
    else { Add-ToDeferredSpool $row }
  }
  Write-SpoolRows $spoolPath $remaining
}
function Test-RecentPunch($row) { try { $instant = [datetimeoffset]::Parse([string]$row.punched_at); $now = [datetimeoffset]::Now; return $instant -ge $now.AddMinutes(-10) -and $instant -le $now.AddMinutes(10) } catch { return $false } }
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
function Complete-PendingRequest {
  $pending = Invoke-BridgeApi "/api/attendance/sync/pending"
  if (-not $pending -or -not $pending.request) { return $false }
  try {
    $punches = @(Read-DeviceData)
    $rangeStart = [string]$pending.request.result.range_start
    $rangeEnd = [string]$pending.request.result.range_end
    if ($rangeStart -and $rangeEnd) {
      $punches = @($punches | Where-Object {
        $date = ([datetimeoffset]::Parse($_.punched_at)).ToString("yyyy-MM-dd")
        $date -ge $rangeStart -and $date -le $rangeEnd
      })
    }
    Invoke-BridgeApi "/api/attendance/sync/complete" "POST" @{ request_id = $pending.request.id; device_id = $deviceId; punches = $punches } | Out-Null
  } catch {
    try { Invoke-BridgeApi "/api/attendance/sync/fail" "POST" @{ request_id = $pending.request.id; error = $_.Exception.Message } | Out-Null } catch { }
  }
  return $true
}
function Test-RealtimeWindow {
  $now = Get-Date
  $morningStart = $now.Date.AddHours(7.5)
  $morningEnd = $now.Date.AddHours(9.5)
  $afternoonStart = $now.Date.AddHours(16.5)
  $afternoonEnd = $now.Date.AddHours(18.5)
  return ($now -ge $morningStart -and $now -le $morningEnd) -or ($now -ge $afternoonStart -and $now -le $afternoonEnd)
}
while ($true) {
  try { $handledRequest = Complete-PendingRequest } catch { $handledRequest = $false }
  if ($handledRequest) {
    Start-Sleep -Seconds 5
    continue
  }
  # Keep the bridge alive, but avoid opening Wise Eye outside realtime windows.
  if (-not (Test-RealtimeWindow)) {
    Start-Sleep -Seconds 30
    continue
  }
  try { Replay-Spool } catch { }
  try {
    foreach ($row in @(Read-DeviceData)) {
      $key = "$($row.enroll_number)|$($row.punched_at)"
      if (Test-RecentPunch $row -and -not $seen.ContainsKey($key)) { if (Send-Punch $row) { $seen[$key] = $true } }
    }
    $snapshot = [ordered]@{}; $seen.Keys | Select-Object -Last 5000 | ForEach-Object { $snapshot[$_] = $true }
    $snapshot | ConvertTo-Json -Compress | Set-Content $statePath
  } catch { }
  Start-Sleep -Seconds 5
}
