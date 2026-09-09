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

if (-not (Test-Path $ConfigPath)) { throw "Missing bridge config: $ConfigPath" }
$config = Get-Content $ConfigPath -Raw | ConvertFrom-Json
if ([string]::IsNullOrWhiteSpace($config.bridgeToken)) { throw "bridgeToken is missing" }
$headers = @{ "x-attendance-bridge-token" = [string]$config.bridgeToken }

function Invoke-BridgeApi([string]$Path, [string]$Method = "GET", $Body = $null) {
  $params = @{ Uri = "$apiBase$Path"; Method = $Method; Headers = $headers; ContentType = "application/json" }
  if ($null -ne $Body) { $params.Body = ($Body | ConvertTo-Json -Depth 8 -Compress) }
  Invoke-RestMethod @params
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
    $punches = @(Read-DeviceData)
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
  [void](Invoke-BridgeApi "/api/attendance/sync/request" "POST" @{ device_id = $deviceId })
}

$pending = Invoke-BridgeApi "/api/attendance/sync/pending"
if ($pending -and $pending.request) { Complete-Request $pending.request }
