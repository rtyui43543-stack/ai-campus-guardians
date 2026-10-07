param([int]$Shard=0, [int]$TotalShards=1, [string]$FfmpegPath='')
$ErrorActionPreference='Stop'
$projectRoot=Split-Path -Parent $PSScriptRoot
$workRoot=Join-Path $projectRoot '.audio-work'
$audioRoot=Join-Path $projectRoot 'public/audio'
if (-not $FfmpegPath) {
  $FfmpegPath=$env:AI_GAME_FFMPEG
}
if (-not $FfmpegPath) {
  $FfmpegPath=(Get-Command ffmpeg -ErrorAction Stop).Source
}
Add-Type -AssemblyName System.Speech
$speaker=New-Object System.Speech.Synthesis.SpeechSynthesizer
$speaker.SelectVoice('Microsoft Hanhan Desktop')
$speaker.Rate=0
$items=Get-Content -LiteralPath (Join-Path $workRoot 'utterances.json') -Raw -Encoding utf8 | ConvertFrom-Json
$count=0
try {
  for ($i=$Shard; $i -lt $items.Count; $i+=$TotalShards) {
    $item=$items[$i]
    $target=Join-Path $audioRoot $item.file
    if ((Test-Path -LiteralPath $target) -and (Get-Item -LiteralPath $target).Length -gt 500) { continue }
    $wave=Join-Path $workRoot ($item.file + '.wav')
    $speaker.SetOutputToWaveFile($wave)
    $speaker.Speak([string]$item.text)
    $speaker.SetOutputToNull()
    & $FfmpegPath -hide_banner -loglevel error -y -i $wave -ac 1 -ar 24000 -codec:a libmp3lame -b:a 48k $target
    if ($LASTEXITCODE -ne 0) { throw ('Audio encoding failed: ' + $item.file) }
    Remove-Item -LiteralPath $wave
    $count++
    if ($count % 50 -eq 0) { Write-Output ('Audio worker ' + $Shard + ': generated ' + $count + ' clips') }
  }
} finally { $speaker.Dispose() }
Write-Output ('Audio worker ' + $Shard + ' complete: generated ' + $count + ' clips')
