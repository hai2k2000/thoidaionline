param(
  [switch]$Daily,
  [switch]$Once,
  [string]$ConfigPath = "C:\WiseEyeOn39\bridge\config.json"
)

$ErrorActionPreference = "Stop"
$apiBase = "https://www.thoidai.online"
$deviceId = "wise-eye-on-39-machine-1"
$deviceIp = "192.168.79.201"
$devicePort = 4370
$machineNumber = 1

function Test-AttendanceWindow([datetime]$Time) {
  $minuteOfDay = ($Time.Hour * 60) + $Time.Minute
  return ($minuteOfDay -ge 450 -and $minuteOfDay -le 570) -or
    ($minuteOfDay -ge 990 -and $minuteOfDay -le 1110)
}

# The minute task stays registered, but does no API or device work outside attendance windows.
if (-not $Daily -and -not (Test-AttendanceWindow (Get-Date))) { exit 0 }

if (-not (Test-Path $ConfigPath)) { throw "Missing bridge config: $ConfigPath" }
$config = Get-Content $ConfigPath -Raw | ConvertFrom-Json
if ([string]::IsNullOrWhiteSpace($config.bridgeToken)) { throw "bridgeToken is missing" }
function New-BridgeHeaders([string]$Uri, [string]$Method, [string]$Body) {
  $timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds().ToString()
  $nonce = [Convert]::ToBase64String((1..16 | ForEach-Object { Get-Random -Maximum 256 }))
  $nonce = $nonce.TrimEnd('=').Replace('+','-').Replace('/','_')
  $sha = [Security.Cryptography.SHA256]::Create(); $bodyHash = ([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($Body))) -replace '-','').ToLowerInvariant(); $sha.Dispose()
  $path = ([Uri]$Uri).AbsolutePath
  $canonical = "$Method`n$path`n$timestamp`n$nonce`n$bodyHash"
  $hmac = [Security.Cryptography.HMACSHA256]::new([Text.Encoding]::UTF8.GetBytes([string]$config.bridgeToken)); $signature = ([BitConverter]::ToString($hmac.ComputeHash([Text.Encoding]::UTF8.GetBytes($canonical))) -replace '-','').ToLowerInvariant(); $hmac.Dispose()
  return @{ "x-attendance-bridge-timestamp" = $timestamp; "x-attendance-bridge-nonce" = $nonce; "x-attendance-bridge-signature" = $signature }
}

function Invoke-BridgeApi([string]$Path, [string]$Method = "GET", $Body = $null) {
  $bodyText = if ($null -ne $Body) { $Body | ConvertTo-Json -Depth 8 -Compress } else { "" }
  $params = @{ Uri = "$apiBase$Path"; Method = $Method; Headers = (New-BridgeHeaders "$apiBase$Path" $Method $bodyText); ContentType = "application/json" }
  if ($null -ne $Body) { $params.Body = $bodyText }
  Invoke-RestMethod @params
}

function Invoke-WithRetry([scriptblock]$Operation) {
  $delays = @(0, 10, 30, 60)
  $lastError = $null
  foreach ($delay in $delays) {
    if ($delay -gt 0) { Start-Sleep -Seconds $delay }
    try { return & $Operation } catch { $lastError = $_ }
  }
  throw $lastError
}

function Get-LookbackRange {
  $end = (Get-Date).Date
  $start = $end.AddDays(-2)
  return @{ start = $start.ToString("yyyy-MM-dd"); end = $end.ToString("yyyy-MM-dd") }
}

function Read-DeviceData {
  $zk = New-Object -ComObject "zkemkeeper.ZKEM"
  $connected = $false
  try {
    $connected = $zk.Connect_Net($deviceIp, $devicePort)
    if (-not $connected) { throw "Wise Eye device connection failed" }
    $users = @()
    [void]$zk.ReadAllUserID($machineNumber)
    while ($true) {
      $pin = ""; $name = ""; $password = ""; $privilege = 0; $enabled = $false
      if (-not $zk.SSR_GetAllUserInfo($machineNumber, [ref]$pin, [ref]$name, [ref]$password, [ref]$privilege, [ref]$enabled)) { break }
      $users += [pscustomobject]@{ enroll_number = [string]$pin; name = [string]$name; enabled = [bool]$enabled }
    }
    $allowed = @{}
    foreach ($user in $users) { $allowed[[string]$user.enroll_number] = $true }
    $punches = @()
    [void]$zk.ReadGeneralLogData($machineNumber)
    while ($true) {
      $pin = ""; $verify = 0; $inOut = 0; $year = 0; $month = 0; $day = 0; $hour = 0; $minute = 0; $second = 0; $workCode = 0
      if (-not $zk.SSR_GetGeneralLogData($machineNumber, [ref]$pin, [ref]$verify, [ref]$inOut, [ref]$year, [ref]$month, [ref]$day, [ref]$hour, [ref]$minute, [ref]$second, [ref]$workCode)) { break }
      if (-not $allowed.ContainsKey([string]$pin)) { continue }
      # Device timestamps are local Asia/Ho_Chi_Minh; preserve the offset for the API.
      $local = Get-Date -Year $year -Month $month -Day $day -Hour $hour -Minute $minute -Second $second
      $punches += [pscustomobject]@{
        enroll_number = [string]$pin
        punched_at = $local.ToString("yyyy-MM-ddTHH:mm:ss+07:00")
        verify_mode = [int]$verify
        in_out_mode = [int]$inOut
        work_code = [int]$workCode
      }
    }
    return $punches
  } finally {
    if ($connected) { [void]$zk.Disconnect() }
  }
}

function Complete-Request($request) {
  try {
    $punches = @(Invoke-WithRetry { Read-DeviceData })
    $rangeStart = [string]$request.result.range_start
    $rangeEnd = [string]$request.result.range_end
    if ($rangeStart -and $rangeEnd) {
      $punches = @($punches | Where-Object {
        $date = ([datetimeoffset]::Parse($_.punched_at)).ToString("yyyy-MM-dd")
        $date -ge $rangeStart -and $date -le $rangeEnd
      })
    }
    Invoke-BridgeApi "/api/attendance/sync/complete" "POST" @{ request_id = $request.id; device_id = $deviceId; punches = $punches }
  } catch {
    try { Invoke-BridgeApi "/api/attendance/sync/fail" "POST" @{ request_id = $request.id; error = $_.Exception.Message } | Out-Null } catch { }
    throw
  }
}

if ($Daily) {
  $range = Get-LookbackRange
  [void](Invoke-BridgeApi "/api/attendance/sync/request" "POST" @{ device_id = $deviceId; source = "daily"; period = "range"; range_start = $range.start; range_end = $range.end })
}

$pending = Invoke-BridgeApi "/api/attendance/sync/pending"
if ($pending -and $pending.request) { Complete-Request $pending.request }
