param(
    [string]$FlutterRoot = (Join-Path $PSScriptRoot '../../mobile/thoidai_work_flutter'),
    [string]$Dist = (Join-Path $PSScriptRoot '../../dist'),
    [string]$FlutterCommand = 'flutter'
)
$ErrorActionPreference = 'Stop'
$source = (Resolve-Path -LiteralPath $FlutterRoot).Path
$output = [IO.Path]::GetFullPath($Dist)
if (!(Test-Path -LiteralPath (Join-Path $source 'android/key.properties'))) { throw 'Release requires android/key.properties.' }
$pubspec = Get-Content -Raw -LiteralPath (Join-Path $source 'pubspec.yaml')
if ($pubspec -notmatch '(?m)^version:\s*([0-9]+\.[0-9]+\.[0-9]+)\+([0-9]+)\s*$') { throw 'Invalid pubspec version.' }
$version = $Matches[1]
$versionCode = [int]$Matches[2]
$fileName = "thoidai-work-$version.apk"
$destination = Join-Path $output $fileName
if (Test-Path -LiteralPath $destination) { throw 'APK already exists. Choose a new version or output directory.' }
Push-Location $source
try {
    & $FlutterCommand pub get
    if ($LASTEXITCODE -ne 0) { throw 'flutter pub get failed.' }
    & $FlutterCommand build apk --release --dart-define=API_BASE_URL=https://thoidai.online
    if ($LASTEXITCODE -ne 0) { throw 'Flutter release build failed.' }
    New-Item -ItemType Directory -Force -Path $output | Out-Null
    Copy-Item -LiteralPath 'build/app/outputs/flutter-apk/app-release.apk' -Destination $destination
    $manifest = [ordered]@{
        version = $version
        versionCode = $versionCode
        fileName = $fileName
        size = (Get-Item -LiteralPath $destination).Length
        sha256 = (Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash.ToLowerInvariant()
        publishedAt = [DateTime]::UtcNow.ToString('o')
    }
    # BOM-free JSON is consumed directly by JSON.parse in the server helper.
    $json = $manifest | ConvertTo-Json
    $manifestPath = Join-Path $output 'latest.json'
    [IO.File]::WriteAllText("$manifestPath.tmp", $json, (New-Object Text.UTF8Encoding($false)))
    Move-Item -LiteralPath "$manifestPath.tmp" -Destination $manifestPath -Force
    Write-Output "Built $fileName ($($manifest.size) bytes); SHA-256: $($manifest.sha256)"
} finally { Pop-Location }
