param([ValidateSet('all','source','static')][string]$Kind='all')

$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$taskProjectRoot=[IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$taskDistRoot=[IO.Path]::GetFullPath((Join-Path $taskProjectRoot 'dist'))
$taskReleaseRoot=[IO.Path]::GetFullPath((Join-Path $taskProjectRoot 'release'))
$taskUtf8=New-Object Text.UTF8Encoding($false)
function Get-TaskSha256([string]$Path) {
  $taskHasher=[Security.Cryptography.SHA256]::Create()
  $taskHashInput=[IO.File]::OpenRead($Path)
  try { return ([BitConverter]::ToString($taskHasher.ComputeHash($taskHashInput))).Replace('-','').ToLowerInvariant() }
  finally { $taskHashInput.Dispose(); $taskHasher.Dispose() }
}
function Assert-Within([string]$Root,[string]$Target) {
  $taskAbsolute=[IO.Path]::GetFullPath($Target)
  if (-not $taskAbsolute.StartsWith($Root+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)) { throw ('Path escapes package root: '+$Target) }
  return $taskAbsolute
}
Assert-Within $taskProjectRoot $taskReleaseRoot | Out-Null
if (-not (Test-Path -LiteralPath (Join-Path $taskDistRoot 'offline-manifest.json') -PathType Leaf)) { throw 'Run npm run build before packaging.' }
$taskManifest=Get-Content -LiteralPath (Join-Path $taskDistRoot 'offline-manifest.json') -Raw -Encoding utf8 | ConvertFrom-Json
if ([string]$taskManifest.version -notmatch '^[a-f0-9]{64}$') { throw 'Offline manifest version is invalid.' }
$taskVersion=([string]$taskManifest.version).Substring(0,12)
foreach($taskAsset in $taskManifest.files) {
  $taskAssetPath=Assert-Within $taskDistRoot (Join-Path $taskDistRoot ([string]$taskAsset.url).TrimStart('/'))
  if (-not (Test-Path -LiteralPath $taskAssetPath -PathType Leaf)) { throw ('Missing asset: '+$taskAsset.url) }
  if ((Get-Item -LiteralPath $taskAssetPath).Length -ne $taskAsset.size) { throw ('Asset size mismatch: '+$taskAsset.url) }
  if ((Get-TaskSha256 $taskAssetPath) -ne $taskAsset.hash) { throw ('Asset hash mismatch: '+$taskAsset.url) }
}
New-Item -ItemType Directory -Path $taskReleaseRoot -Force | Out-Null

function New-Package([string]$Name,[string]$Root,[object[]]$Files,[hashtable]$ExtraText) {
  $taskArchivePath=Assert-Within $taskReleaseRoot (Join-Path $taskReleaseRoot ($Name+'-'+$taskVersion+'.zip'))
  if (Test-Path -LiteralPath $taskArchivePath) { throw ('Package already exists: '+$taskArchivePath) }
  $taskStream=[IO.File]::Open($taskArchivePath,[IO.FileMode]::CreateNew)
  # The canonical UTF8 instance also sets the ZIP UTF-8 filename flag on Windows PowerShell's .NET Framework.
  $taskZip=New-Object IO.Compression.ZipArchive($taskStream,[IO.Compression.ZipArchiveMode]::Create,$false,[Text.Encoding]::UTF8)
  $taskRecords=@()
  try {
    foreach($taskFile in ($Files | Sort-Object FullName)) {
      $taskFilePath=Assert-Within $Root $taskFile.FullName
      if (($taskFile.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw ('Linked files cannot be packaged: '+$taskFilePath) }
      $taskEntryName=$taskFilePath.Substring($Root.Length+1).Replace('\','/')
      [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($taskZip,$taskFilePath,$taskEntryName,[IO.Compression.CompressionLevel]::Optimal) | Out-Null
      $taskRecords+=@{ path=$taskEntryName; bytes=$taskFile.Length; sha256=(Get-TaskSha256 $taskFilePath) }
    }
    $ExtraText['GITHUB-PACKAGE-CONTENTS.json']=(@{ gameVersion=$taskManifest.version; kind=$Name; files=$taskRecords } | ConvertTo-Json -Depth 6)
    foreach($taskExtraName in ($ExtraText.Keys | Sort-Object)) {
      $taskEntry=$taskZip.CreateEntry($taskExtraName,[IO.Compression.CompressionLevel]::Optimal)
      $taskWriter=New-Object IO.StreamWriter($taskEntry.Open(),$taskUtf8)
      try { $taskWriter.Write([string]$ExtraText[$taskExtraName]) } finally { $taskWriter.Dispose() }
    }
  } finally { $taskZip.Dispose(); $taskStream.Dispose() }
  $taskDigest=Get-TaskSha256 $taskArchivePath
  [IO.File]::WriteAllText($taskArchivePath+'.sha256',$taskDigest+'  '+[IO.Path]::GetFileName($taskArchivePath)+[Environment]::NewLine,$taskUtf8)
  Write-Output ('Package: '+$taskArchivePath)
  Write-Output ('Files: '+$taskRecords.Count+'; ZIP: '+[Math]::Round((Get-Item -LiteralPath $taskArchivePath).Length/1MB,1)+' MB; SHA256: '+$taskDigest)
}

if ($Kind -in @('all','source')) {
  $taskSourceFiles=@()
  foreach($taskDirectory in @('src','public','scripts','docs','.github')) {
    $taskSourceDirectory=Assert-Within $taskProjectRoot (Join-Path $taskProjectRoot $taskDirectory)
    if (-not (Test-Path -LiteralPath $taskSourceDirectory -PathType Container)) { throw ('Missing source directory: '+$taskDirectory) }
    $taskSourceFiles+=Get-ChildItem -LiteralPath $taskSourceDirectory -Recurse -File -Force
  }
  foreach($taskRootFile in @('README.md','package.json','package-lock.json','tsconfig.json','vite.config.ts','index.html','.gitignore','.gitattributes')) {
    $taskFilePath=Assert-Within $taskProjectRoot (Join-Path $taskProjectRoot $taskRootFile)
    if (-not (Test-Path -LiteralPath $taskFilePath -PathType Leaf)) { throw ('Missing source file: '+$taskRootFile) }
    $taskSourceFiles+=Get-Item -LiteralPath $taskFilePath -Force
  }
  $taskSourceFiles+=Get-ChildItem -LiteralPath $taskProjectRoot -File -Filter '*.cmd'
  New-Package 'AI-Campus-Guardians-GitHub-Source' $taskProjectRoot $taskSourceFiles @{}
}
if ($Kind -in @('all','static')) {
  $taskStaticFiles=@(Get-ChildItem -LiteralPath $taskDistRoot -Recurse -File -Force)
  $taskExtras=@{}
  if (-not (Test-Path -LiteralPath (Join-Path $taskDistRoot '.nojekyll'))) { $taskExtras['.nojekyll']='' }
  $taskExtras['README-GITHUB-PAGES.md']=[IO.File]::ReadAllText((Join-Path $taskProjectRoot 'docs/github-pages.md'),$taskUtf8)
  New-Package 'AI-Campus-Guardians-GitHub-Static' $taskDistRoot $taskStaticFiles $taskExtras
}
