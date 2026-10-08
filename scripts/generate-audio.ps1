param(
  [int]$Concurrency=4,
  [string]$PythonPath='',
  [string]$FfmpegPath='',
  [switch]$Force,
  [switch]$SkipPrune
)
$ErrorActionPreference='Stop'
$projectRoot=Split-Path -Parent $PSScriptRoot
$workRoot=Join-Path $projectRoot '.audio-work'
$runtimeRoot=Join-Path $workRoot 'tts-runtime'
if ($Concurrency -lt 1 -or $Concurrency -gt 6) { throw 'Concurrency must be between 1 and 6.' }
if (-not $PythonPath) { $PythonPath=(Get-Command python -ErrorAction Stop).Source }
if (-not $FfmpegPath) { $FfmpegPath=$env:AI_GAME_FFMPEG }
if (-not $FfmpegPath) { $FfmpegPath=(Get-Command ffmpeg -ErrorAction Stop).Source }
if (-not (Test-Path -LiteralPath $FfmpegPath -PathType Leaf)) { throw 'FFmpeg executable was not found.' }
New-Item -ItemType Directory -Path $workRoot -Force | Out-Null
if (-not (Test-Path -LiteralPath (Join-Path $runtimeRoot 'edge_tts/__init__.py'))) {
  & $PythonPath -m pip install --target $runtimeRoot 'edge-tts==7.2.7' 'truststore==0.10.4'
  if ($LASTEXITCODE -ne 0) { throw 'Unable to install the isolated neural narration generator.' }
}
Push-Location $projectRoot
try {
  & npx tsx scripts/audio-manifest.ts --stage
  if ($LASTEXITCODE -ne 0) { throw 'Unable to stage the narration manifest.' }
  $generator=@'
import asyncio, hashlib, json, os, pathlib, re, shutil, subprocess, sys, time
root = pathlib.Path(sys.argv[1]).resolve()
work = root / '.audio-work'
sys.path.insert(0, str(work / 'tts-runtime'))
import truststore
truststore.inject_into_ssl()
import edge_tts
VOICE, RATE, PITCH = 'zh-TW-HsiaoChenNeural', '-6%', '-2Hz'
PROFILE = 'zh-TW-HsiaoChenNeural-rate-6-pitch-2-v2'
pool_size, ffmpeg, force = int(sys.argv[2]), sys.argv[3], sys.argv[4] == 'force'
staging = work / PROFILE
staging.mkdir(exist_ok=True)
items = json.loads((work / 'utterances.json').read_text(encoding='utf-8'))
index = json.loads((work / 'neural-index.json').read_text(encoding='utf-8'))
if len(items) != len({row['file'] for row in items}):
    raise RuntimeError('Duplicate narration filenames.')
if {path.removeprefix('/audio/') for path in index.values()} != {row['file'] for row in items}:
    raise RuntimeError('Staged index and utterances do not match.')
for row in items:
    if not re.fullmatch(r'[a-f0-9]{20}\.mp3', row['file']):
        raise RuntimeError('Unsafe narration filename.')
    digest = hashlib.sha256((PROFILE + ':' + row['text']).encode()).hexdigest()[:20] + '.mp3'
    if digest != row['file']:
        raise RuntimeError('Voice profile does not match the filename identity.')

def normalize(text):
    text = re.sub(r'\s+', ' ', text).strip()
    text = re.sub(r'(?<=[\u4e00-\u9fff]) +(?=[\u4e00-\u9fff])', '', text)
    return re.sub(r'([\u3002\uff01\uff1f!?])[\u3002]+', r'\1', text)

def validate(path):
    if not path.is_file() or path.stat().st_size < 500:
        raise RuntimeError('Missing or incomplete narration: ' + path.name)
    result = subprocess.run([ffmpeg, '-hide_banner', '-loglevel', 'error', '-i', str(path), '-f', 'null', '-'],
                            stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, timeout=30)
    if result.returncode:
        raise RuntimeError('Invalid MP3: ' + path.name)

generated, reused, begin = 0, 0, time.monotonic()
semaphore = asyncio.Semaphore(pool_size)
failures = []

async def one(row):
    global generated, reused
    async with semaphore:
        if len(failures) >= pool_size:
            return  # A persistent outage must not cause hundreds of doomed requests.
        target = staging / row['file']
        previous = root / 'public' / 'audio' / row['file']
        if not force and not target.is_file() and previous.is_file() and previous.stat().st_size > 500:
            try:
                await asyncio.to_thread(validate, previous)
                shutil.copyfile(previous, target)
            except Exception:
                pass
        if not force and target.is_file() and target.stat().st_size > 500:
            try:
                await asyncio.to_thread(validate, target)
                reused += 1
                return
            except Exception:
                pass
        temporary = staging / (row['file'] + '.download')
        for attempt in range(4):
            try:
                speaker = edge_tts.Communicate(normalize(row['text']), VOICE, rate=RATE, pitch=PITCH,
                                               connect_timeout=15, receive_timeout=30)
                await asyncio.wait_for(speaker.save(str(temporary)), timeout=60)
                await asyncio.to_thread(validate, temporary)
                os.replace(temporary, target)
                generated += 1
                if generated % 25 == 0:
                    print(f'Neural narration: {generated} generated, {reused} reused / {len(items)}; {time.monotonic()-begin:.0f}s', flush=True)
                return
            except Exception as error:
                if attempt == 3:
                    failures.append({'file': row['file'], 'errorType': type(error).__name__})
                else:
                    await asyncio.sleep(2 ** attempt + .5)

async def main():
    await asyncio.gather(*(one(row) for row in items))
    if failures:
        (work / 'neural-failures.json').write_text(json.dumps(failures, indent=2), encoding='utf-8')
        raise RuntimeError(f'{len(failures)} clips failed; previous public pack retained. Retry to resume staged clips.')
    records = []
    for row in items:
        path = staging / row['file']
        data = path.read_bytes()
        records.append({'file': row['file'], 'sha256': hashlib.sha256(data).hexdigest(),
                        'bytes': len(data), 'textSha256': hashlib.sha256(normalize(row['text']).encode()).hexdigest()})
    report = {'profile': PROFILE, 'voice': VOICE, 'locale': 'zh-TW', 'rate': RATE, 'pitch': PITCH,
              'generator': 'edge-tts 7.2.7', 'clips': len(records), 'keys': len(index),
              'bytes': sum(row['bytes'] for row in records), 'decodePassed': True, 'files': records}
    (work / 'neural-audio-audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    audio_root = root / 'public' / 'audio'
    audio_root.mkdir(exist_ok=True)
    for record in records:
        destination = audio_root / record['file']
        # Preserve verified existing clips and their timestamps during incremental generation.
        if not destination.is_file() or hashlib.sha256(destination.read_bytes()).hexdigest() != record['sha256']:
            destination.write_bytes((staging / record['file']).read_bytes())
        if hashlib.sha256(destination.read_bytes()).hexdigest() != record['sha256']:
            raise RuntimeError('Promoted file did not match its staged hash.')
    temporary_index = audio_root / 'index.neural.tmp'
    temporary_index.write_text(json.dumps(index, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    os.replace(temporary_index, audio_root / 'index.json')
    (audio_root / 'generation.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8', newline='\n')
    print(f'COMPLETE: {len(records)} decoded neural clips; {report["bytes"]:,} bytes; {time.monotonic()-begin:.0f}s.', flush=True)

asyncio.run(main())
'@
  $generatorPath=Join-Path $workRoot 'generate-neural-audio.py'
  [IO.File]::WriteAllText($generatorPath,$generator,(New-Object Text.UTF8Encoding($false)))
  $forceArgument=if ($Force) { 'force' } else { 'resume' }
  & $PythonPath $generatorPath $projectRoot $Concurrency $FfmpegPath $forceArgument
  if ($LASTEXITCODE -ne 0) { throw 'Neural narration generation failed; the earlier public pack was retained.' }
  if (-not $SkipPrune) {
    & node scripts/prune-audio.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Narration pruning failed.' }
  }
} finally { Pop-Location }
