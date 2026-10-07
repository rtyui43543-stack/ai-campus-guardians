import { readFile, stat, readdir, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, relative, extname, sep, dirname } from 'node:path';

const root = resolve(process.argv[2] ?? 'dist');
const mount = 'https://pages.example.test/ai-campus-guardians/';
const failures = [];
const teacherAsset = (name) => name === 'teacher' || name.startsWith('teacher/');
let references = 0;
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const checkURL = async (raw, parent, label, allowExternal = false) => {
  if (!raw || raw.startsWith('#') || raw.startsWith('data:') || raw.startsWith('blob:')) return;
  if (/^(?:https?:)?\/\//i.test(raw)) {
    if (!allowExternal) failures.push(label + ': 外部素材 ' + raw);
    return;
  }
  if (raw.startsWith('/')) { failures.push(label + ': 素材不可從網域根目錄讀取 ' + raw); return; }
  const url = new URL(raw, new URL(parent, mount));
  if (url.origin !== new URL(mount).origin || !url.pathname.startsWith(new URL(mount).pathname)) {
    failures.push(label + ': 素材超出專案路徑 ' + raw); return;
  }
  const name = decodeURIComponent(url.pathname.slice(new URL(mount).pathname.length));
  try {
    let target = resolve(root, name || 'index.html');
    let info = await stat(target);
    if (info.isDirectory()) { target = resolve(target, 'index.html'); info = await stat(target); }
    if (!info.isFile()) throw new Error('not a file');
    references += 1;
  } catch { failures.push(label + ': 素材不存在 ' + raw); }
};
const walk = async (folder) => {
  const entries = await readdir(folder, { withFileTypes: true });
  return (await Promise.all(entries.map((entry) => entry.isDirectory()
    ? walk(resolve(folder, entry.name)) : entry.isFile() ? [resolve(folder, entry.name)] : []))).flat();
};

const manifest = JSON.parse(await readFile(resolve(root, 'manifest.webmanifest'), 'utf8'));
// Omitted id defaults to the full start_url, preserving separate project identities.
for (const property of ['start_url', 'scope']) {
  const value = manifest[property];
  if (typeof value !== 'string' || value.startsWith('/') || /^(?:https?:)?\/\//i.test(value)) {
    failures.push('webmanifest.' + property + ' 必須使用專案相對路徑。');
  } else {
    const url = new URL(value, mount);
    if (url.href !== mount) failures.push('webmanifest.' + property + ' 未對應專案首頁。');
  }
}
if (manifest.id !== undefined) {
  const identity = new URL(manifest.id, new URL(mount).origin);
  if (identity.href !== mount) failures.push('webmanifest.id 未對應完整專案路徑；建議省略以採用 start_url。');
}
for (const icon of manifest.icons ?? []) await checkURL(icon.src, 'manifest.webmanifest', 'PWA icon');
const html = await readFile(resolve(root, 'index.html'), 'utf8');
for (const match of html.matchAll(/<(?:link|script|img)\b[^>]*(?:src|href)=["']([^"']+)["'][^>]*>/gi)) {
  await checkURL(match[1], 'index.html', 'index.html');
}
const paths = await walk(root);
const teacherFiles = paths.filter((path) => teacherAsset(relative(root, path).split(sep).join('/')));
for (const name of ['index.html', 'question-list.csv', 'question-list.html', 'question-list.md', 'question-bank.json']) {
  if (!teacherFiles.includes(resolve(root, 'teacher', name))) failures.push('教師備課檔案缺漏 teacher/' + name);
}
try {
  const teacherHTML = await readFile(resolve(root, 'teacher', 'index.html'), 'utf8');
  for (const match of teacherHTML.matchAll(/<(?:link|script|img)\b[^>]*(?:src|href)=["']([^"']+)["'][^>]*>/gi)) {
    await checkURL(match[1], 'teacher/index.html', '教師頁素材');
  }
  for (const match of teacherHTML.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi)) {
    await checkURL(match[1], 'teacher/index.html', '教師頁連結', true);
  }
} catch { failures.push('教師入口 teacher/index.html 無法讀取。'); }
for (const path of paths.filter((path) => extname(path) === '.css')) {
  const name = relative(root, path).split(sep).join('/');
  const css = await readFile(path, 'utf8');
  for (const match of css.matchAll(/url\(\s*["']?([^"')\s]+)["']?\s*\)/g)) {
    await checkURL(match[1], name, name);
  }
}
const offline = JSON.parse(await readFile(resolve(root, 'offline-manifest.json'), 'utf8'));
let totalBytes = 0;
const urls = new Set();
for (const file of offline.files) {
  if (urls.has(file.url)) failures.push('離線清單重複檔案 ' + file.url);
  urls.add(file.url);
  if (!file.url.startsWith('/') || file.url.startsWith('//')) failures.push('離線檔案名稱無效 ' + file.url);
  const name = file.url.replace(/^\//, '').split('/').map(decodeURIComponent).join('/');
  if (teacherAsset(name)) failures.push('學生離線清單不得收錄教師教材 ' + file.url);
  if (name.split('/').some((part) => part === '..' || part.includes('\\'))) { failures.push('離線檔案跳脫 ' + file.url); continue; }
  try {
    const bytes = await readFile(resolve(root, name));
    totalBytes += bytes.byteLength;
    if (file.size !== bytes.byteLength || file.hash !== hash(bytes)) failures.push('離線雜湊或大小不符合 ' + file.url);
  } catch { failures.push('離線檔案不存在 ' + file.url); }
}
for (const path of paths) {
  const name = relative(root, path).split(sep).join('/');
  if (teacherAsset(name) || ['sw.js', 'offline-manifest.json'].includes(name)) continue;
  const url = '/' + name.split('/').map(encodeURIComponent).join('/');
  if (!urls.has(url)) failures.push('學生離線清單遺漏遊戲素材 ' + url);
}
if (offline.totalBytes !== totalBytes) failures.push('離線總容量不符合。');
const buildVersion = /<meta name="offline-build-version" content="([a-f0-9]{64})">/.exec(html)?.[1];
if (!buildVersion || buildVersion !== offline.version) failures.push('首頁與離線版本不一致。');
const worker = await readFile(resolve(root, 'sw.js'), 'utf8');
if (!worker.includes('self.registration.scope')) failures.push('Service worker 未依註冊範圍讀取素材。');
if (!worker.includes('fetch(scoped(file.url)')) failures.push('Service worker 素材下載未套用專案範圍。');
if (!worker.includes("cache.match(scoped('/index.html'))")) failures.push('Service worker 離線首頁未套用專案範圍。');
if (!worker.includes("if (relativePath === 'teacher' || relativePath.startsWith('teacher/')) return;")) failures.push('Service worker 未保留教師頁的獨立網路路徑。');
let checkedJSFiles = 0;
for (const path of paths.filter((path) => extname(path) === '.js' && path !== resolve(root, 'sw.js'))) {
  const source = await readFile(path, 'utf8');
  checkedJSFiles += 1;
  if (/\bfetch\(\s*["']\//.test(source)) failures.push(relative(root, path) + ': fetch 不可直指網域根目錄。');
}
const report = { status: failures.length ? 'FAIL' : 'PASS', version: offline.version,
  files: offline.files.length, totalBytes, verifiedHTMLCSSReferences: references, checkedJSFiles,
  teacherFilesOnline: teacherFiles.length, teacherFilesOffline: offline.files.filter((file) => teacherAsset(decodeURIComponent(file.url.slice(1)))).length,
  manifestIdentity: manifest.id ?? 'default-to-start_url', mountedAt: mount, failures };
if (process.argv[3]) {
  const reportPath = resolve(process.argv[3]); await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
}
if (failures.length) {
  console.error(failures.join('\n')); process.exitCode = 1;
} else {
  console.log(JSON.stringify(report, null, 2));
}
