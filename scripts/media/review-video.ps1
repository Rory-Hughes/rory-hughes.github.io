[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [string]$InputPath,

    [ValidateRange(0, 20)]
    [int]$SampleCount = 5
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Resolve-MediaTools {
    $candidateDirectories = @()

    foreach ($toolName in @("ffmpeg", "ffprobe")) {
        $command = Get-Command $toolName -CommandType Application -ErrorAction SilentlyContinue |
            Select-Object -First 1
        if ($command) {
            $candidateDirectories += Split-Path -Parent $command.Source
        }
    }

    if ($env:LOCALAPPDATA) {
        $packagesRoot = Join-Path $env:LOCALAPPDATA "Microsoft\WinGet\Packages"
        $binPattern = Join-Path $packagesRoot "Gyan.FFmpeg_*\ffmpeg-*-full_build\bin"
        $candidateDirectories += @(
            Get-ChildItem -Path $binPattern -ErrorAction SilentlyContinue |
                Sort-Object -Property LastWriteTime -Descending |
                ForEach-Object { $_.FullName }
        )
    }

    foreach ($directory in ($candidateDirectories | Select-Object -Unique)) {
        $ffmpegPath = Join-Path $directory "ffmpeg.exe"
        $ffprobePath = Join-Path $directory "ffprobe.exe"
        if ((Test-Path -LiteralPath $ffmpegPath) -and (Test-Path -LiteralPath $ffprobePath)) {
            return [pscustomobject]@{
                FFmpeg = $ffmpegPath
                FFprobe = $ffprobePath
            }
        }
    }

    throw "FFmpeg and FFprobe were not found. Install the Windows build with: winget install --id Gyan.FFmpeg --exact"
}

$sourcePath = (Resolve-Path -LiteralPath $InputPath).Path
$sourceItem = Get-Item -LiteralPath $sourcePath
if ($sourceItem.PSIsContainer) {
    throw "InputPath must identify a video file."
}

$tools = Resolve-MediaTools
$probeArguments = @(
    "-v", "error",
    "-show_entries", "format=filename,format_name,duration:stream=index,codec_type,codec_name,width,height,r_frame_rate,sample_rate,channels,channel_layout",
    "-of", "json",
    $sourcePath
)

$probeLines = & $tools.FFprobe @probeArguments
if ($LASTEXITCODE -ne 0) {
    throw "FFprobe could not read the input video."
}

$probeData = ($probeLines -join [Environment]::NewLine) | ConvertFrom-Json
$videoStreams = @($probeData.streams | Where-Object { $_.codec_type -eq "video" })
if ($videoStreams.Count -eq 0) {
    throw "The input file has no readable video stream."
}

$durationSeconds = [double]::Parse(
    [string]$probeData.format.duration,
    [System.Globalization.CultureInfo]::InvariantCulture
)
if ([double]::IsNaN($durationSeconds) -or [double]::IsInfinity($durationSeconds) -or $durationSeconds -le 0) {
    throw "FFprobe did not report a usable video duration."
}

$framesDirectory = $null
$framePaths = @()
if ($SampleCount -gt 0) {
    if (-not $env:TEMP) {
        throw "The TEMP environment variable is unavailable; no review frames were written."
    }

    $reviewRoot = Join-Path $env:TEMP "portfolio-media-review"
    New-Item -ItemType Directory -Force -Path $reviewRoot | Out-Null

    $safeName = [System.IO.Path]::GetFileNameWithoutExtension($sourcePath) -replace "[^A-Za-z0-9._-]", "-"
    $runId = [guid]::NewGuid().ToString("N").Substring(0, 8)
    $framesDirectory = Join-Path $reviewRoot ($safeName + "-" + $runId)
    New-Item -ItemType Directory -Path $framesDirectory | Out-Null

    for ($index = 0; $index -lt $SampleCount; $index++) {
        $fraction = ($index + 1) / ($SampleCount + 1)
        $seconds = $durationSeconds * $fraction
        $timestamp = $seconds.ToString("0.000", [System.Globalization.CultureInfo]::InvariantCulture)
        $frameName = "frame-{0:D2}-{1}s.png" -f ($index + 1), $timestamp
        $framePath = Join-Path $framesDirectory $frameName
        $ffmpegArguments = @(
            "-hide_banner", "-loglevel", "error", "-nostdin",
            "-i", $sourcePath,
            "-ss", $timestamp,
            "-map", "0:v:0",
            "-frames:v", "1",
            $framePath
        )

        & $tools.FFmpeg @ffmpegArguments
        if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $framePath)) {
            throw "FFmpeg could not extract review frame $($index + 1)."
        }
        $framePaths += $framePath
    }
}

$fileHash = (Get-FileHash -LiteralPath $sourcePath -Algorithm SHA256).Hash
[pscustomobject][ordered]@{
    source = $sourcePath
    sha256 = $fileHash
    format = $probeData.format.format_name
    durationSeconds = [math]::Round($durationSeconds, 3)
    sizeBytes = $sourceItem.Length
    under100MiB = ($sourceItem.Length -lt (100 * 1024 * 1024))
    streams = @($probeData.streams)
    reviewFramesDirectory = $framesDirectory
    reviewFrames = @($framePaths)
} | ConvertTo-Json -Depth 6
