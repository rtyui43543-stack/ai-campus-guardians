$ErrorActionPreference='Stop'
$taskProjectRoot=[IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$taskReleaseRoot=[IO.Path]::GetFullPath((Join-Path $taskProjectRoot 'release'))
if (-not $taskReleaseRoot.StartsWith($taskProjectRoot+[IO.Path]::DirectorySeparatorChar)) { throw 'Release directory must stay inside project.' }
$taskManifest=Get-Content -LiteralPath (Join-Path $taskProjectRoot 'dist/offline-manifest.json') -Raw -Encoding utf8 | ConvertFrom-Json
$taskVersion=([string]$taskManifest.version).Substring(0,12)
$taskName='AI-Campus-Guardians-Windows-'+$taskVersion
$taskTarget=Join-Path $taskReleaseRoot $taskName
if (Test-Path -LiteralPath $taskTarget) { throw ('Release folder already exists: '+$taskTarget) }
foreach($taskRequired in @('dist/index.html','runtime/node.exe','runtime/LICENSE-Node.txt','scripts/serve.mjs')) {
  if (-not (Test-Path -LiteralPath (Join-Path $taskProjectRoot $taskRequired) -PathType Leaf)) { throw ('Missing release file: '+$taskRequired) }
}
foreach($taskAsset in $taskManifest.files) {
  $taskAssetPath=[IO.Path]::GetFullPath((Join-Path (Join-Path $taskProjectRoot 'dist') ([string]$taskAsset.url).TrimStart('/')))
  if (-not $taskAssetPath.StartsWith((Join-Path $taskProjectRoot 'dist')+[IO.Path]::DirectorySeparatorChar)) { throw 'Invalid manifest path.' }
  if ((Get-FileHash -LiteralPath $taskAssetPath -Algorithm SHA256).Hash.ToLowerInvariant() -ne $taskAsset.hash) { throw ('Asset hash mismatch: '+$taskAsset.url) }
}
New-Item -ItemType Directory -Path $taskTarget -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $taskTarget 'scripts') -Force | Out-Null
foreach($taskDirectory in @('dist','runtime','docs')) { Copy-Item -LiteralPath (Join-Path $taskProjectRoot $taskDirectory) -Destination $taskTarget -Recurse }
Copy-Item -LiteralPath (Join-Path $taskProjectRoot 'scripts/serve.mjs') -Destination (Join-Path $taskTarget 'scripts/serve.mjs')
Copy-Item -LiteralPath (Join-Path $taskProjectRoot 'README.md') -Destination $taskTarget
$taskLauncher=Get-ChildItem -LiteralPath $taskProjectRoot -File -Filter '*.cmd'
if ($taskLauncher.Count -ne 1) { throw 'Expected exactly one game launcher.' }
Copy-Item -LiteralPath $taskLauncher.FullName -Destination $taskTarget
$taskArchive=Join-Path $taskReleaseRoot ($taskName+'.zip')
Compress-Archive -LiteralPath $taskTarget -DestinationPath $taskArchive -CompressionLevel Optimal
$taskDigest=(Get-FileHash -LiteralPath $taskArchive -Algorithm SHA256).Hash.ToLowerInvariant()
[IO.File]::WriteAllText($taskArchive+'.sha256',$taskDigest+'  '+[IO.Path]::GetFileName($taskArchive)+[Environment]::NewLine)
Write-Output ('Portable Windows game: '+$taskArchive)
Write-Output ('ZIP size: '+[Math]::Round((Get-Item -LiteralPath $taskArchive).Length/1MB,1)+' MB')
Write-Output ('SHA256: '+$taskDigest)
