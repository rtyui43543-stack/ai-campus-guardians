import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const generated = new Set(['sw.js', 'offline-manifest.json']);
// Teacher preparation files remain online; the student pack never downloads them.
const teacherAsset = (name) => name === 'teacher' || name.startsWith('teacher/');
const audioPattern = /\.(?:mp3|wav|ogg|m4a|aac|flac|opus|webm)$/i;
const versionMeta = /<meta name="offline-build-version" content="[a-f0-9]+">\n?/g;

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? listFiles(path) : entry.isFile() ? [path] : [];
  }));
  return nested.flat();
}

export async function buildOffline(outputDirectory = 'dist') {
  const root = resolve(outputDirectory);
  const indexPath = resolve(root, 'index.html');
  const originalIndex = (await readFile(indexPath, 'utf8')).replace(versionMeta, '');
  await writeFile(indexPath, originalIndex, 'utf8');
  const paths = (await listFiles(root)).filter((path) => {
    const name = relative(root, path).split(sep).join('/');
    return !generated.has(name) && !teacherAsset(name);
  });
  const collect = async () => Promise.all(paths.map(async (path) => {
    const name = relative(root, path).split(sep).join('/');
    const content = await readFile(path);
    return { url: '/' + name.split('/').map(encodeURIComponent).join('/'), hash: sha256(content), size: content.length, core: !audioPattern.test(name) };
  }));
  const baseFiles = (await collect()).sort((a, b) => a.url < b.url ? -1 : a.url > b.url ? 1 : 0);
  const version = sha256(JSON.stringify(baseFiles));
  // The version identifies the original build graph. Hash the final, tagged index separately.
  const taggedIndex = originalIndex.includes('</head>')
    ? originalIndex.replace('</head>', '<meta name="offline-build-version" content="' + version + '">\n</head>')
    : '<meta name="offline-build-version" content="' + version + '">\n' + originalIndex;
  await writeFile(indexPath, taggedIndex, 'utf8');
  const files = (await collect()).sort((a, b) => a.url < b.url ? -1 : a.url > b.url ? 1 : 0);
  if (!files.some((file) => file.url === '/index.html')) throw new Error('Offline pack requires index.html.');
  const manifest = { schemaVersion: 1, version, files, totalBytes: files.reduce((sum, file) => sum + file.size, 0) };
  await writeFile(resolve(root, 'offline-manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  await writeFile(resolve(root, 'sw.js'), 'const MANIFEST = ' + JSON.stringify(manifest) + ';\n' + workerSource, 'utf8');
  return manifest;
}

const workerSource = String.raw`
'use strict';
// Manifest URLs name files inside this deployment, never the site's root.
const SCOPE = new URL(self.registration.scope);
const NAMESPACE = SCOPE.pathname === '/' ? '' : encodeURIComponent(SCOPE.pathname) + '-';
const PREFIX = 'ai-campus-guardians-pack-' + NAMESPACE;
const META = 'ai-campus-guardians-control' + (NAMESPACE ? '-' + NAMESPACE : '');
const scoped = (path) => SCOPE.pathname + path.replace(/^\//, '');
const MANIFEST_KEY = scoped('/__offline-pack-manifest');
const ACTIVE_KEY = scoped('/__offline-serving-version');
const CLIENT_KEY = scoped('/__offline-client/');
const PAUSED_KEY = scoped('/__offline-paused/');
const downloads = new Map();
const packName = (version) => PREFIX + version;
const hex = (buffer) => Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, '0')).join('');

async function saveManifest(manifest) {
  const cache = await caches.open(packName(manifest.version));
  await cache.put(MANIFEST_KEY, new Response(JSON.stringify(manifest), { headers: { 'Content-Type': 'application/json' } }));
}
async function getManifest(version = MANIFEST.version) {
  if (typeof version !== 'string' || !/^[a-f0-9]{64}$/.test(version)) throw new Error('離線版本格式不正確。');
  if (version === MANIFEST.version) return MANIFEST;
  const saved = await (await caches.open(packName(version))).match(MANIFEST_KEY);
  if (!saved) throw new Error('找不到舊版離線清單，請下載目前版本。');
  return saved.json();
}
async function validCached(cache, file) {
  const response = await cache.match(scoped(file.url));
  return response && response.headers.get('X-Offline-SHA256') === file.hash
    && Number(response.headers.get('Content-Length')) === file.size ? response : null;
}
async function inspect(manifest) {
  const cache = await caches.open(packName(manifest.version));
  const results = await Promise.all(manifest.files.map(async (file) => await validCached(cache, file) ? file : null));
  const present = results.filter(Boolean);
  const bytes = present.reduce((sum, file) => sum + file.size, 0);
  const ready = present.length === manifest.files.length;
  const downloading = downloads.has(manifest.version);
  const paused = !ready && !downloading && Boolean(await (await caches.open(META)).match(PAUSED_KEY + manifest.version));
  return { version: manifest.version, ready, done: present.length,
    total: manifest.files.length, bytes, totalBytes: manifest.totalBytes, downloading, paused };
}
async function fetchVerified(file, cache) {
  if (await validCached(cache, file)) return;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch(scoped(file.url), { cache: 'no-store', credentials: 'same-origin', signal: controller.signal });
    if (!response.ok || response.type === 'opaque') throw new Error('無法下載 ' + file.url);
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength !== file.size || hex(await crypto.subtle.digest('SHA-256', bytes)) !== file.hash) {
      throw new Error('檔案版本不一致：' + file.url + '。請重新檢查更新後再試。');
    }
    const headers = new Headers(response.headers);
    headers.delete('Content-Encoding');
    headers.delete('Transfer-Encoding');
    headers.set('Content-Length', String(bytes.byteLength));
    headers.set('X-Offline-SHA256', file.hash);
    await cache.put(scoped(file.url), new Response(bytes, { status: 200, headers }));
  } finally { clearTimeout(timeout); }
}
async function pool(files, work, shouldStop = () => false) {
  let next = 0;
  const failures = [];
  await Promise.all(Array.from({ length: Math.min(6, files.length) }, async () => {
    while (next < files.length && !failures.length && !shouldStop()) {
      const file = files[next++];
      try { await work(file); } catch (error) { failures.push(error); }
    }
  }));
  if (failures.length) throw failures[0];
}
async function installCore() {
  await saveManifest(MANIFEST);
  const cache = await caches.open(packName(MANIFEST.version));
  await pool(MANIFEST.files.filter((file) => file.core), (file) => fetchVerified(file, cache));
}
function send(port, value) { try { port.postMessage(value); } catch { /* A closed page does not cancel other downloads. */ } }
function explainError(error) {
  if (error && error.name === 'QuotaExceededError') return '裝置儲存空間不足。請釋出空間後重試；已下載的部分會保留。';
  if (error && error.name === 'AbortError') return '下載逾時。請確認連線後重試；已下載的部分會保留。';
  if (error && error.name === 'TypeError') return '無法取得素材。請確認連線後重試；已下載的部分會保留。';
  return error instanceof Error ? error.message : '離線操作失敗，請重試。';
}
async function download(manifest, port) {
  let job = downloads.get(manifest.version);
  if (job) { job.ports.add(port); send(port, { type: 'PROGRESS', ...job.progress }); return job.promise; }
  job = { ports: new Set([port]), progress: { version: manifest.version, ready: false, done: 0,
    total: manifest.files.length, bytes: 0, totalBytes: manifest.totalBytes, downloading: true, paused: false }, promise: null, paused: false };
  downloads.set(manifest.version, job);
  const notify = (value) => job.ports.forEach((listener) => send(listener, value));
  job.promise = (async () => {
    try {
      await (await caches.open(META)).delete(PAUSED_KEY + manifest.version);
      job.progress = await inspect(manifest);
      await saveManifest(manifest);
      const cache = await caches.open(packName(manifest.version));
      const pending = [];
      for (const file of manifest.files) if (!await validCached(cache, file)) pending.push(file);
      notify({ type: 'PROGRESS', ...job.progress });
      await pool(pending, async (file) => {
        await fetchVerified(file, cache);
        job.progress.done += 1;
        job.progress.bytes += file.size;
        notify({ type: 'PROGRESS', ...job.progress });
      }, () => job.paused);
      if (job.paused) {
        await (await caches.open(META)).put(PAUSED_KEY + manifest.version, new Response('paused'));
        downloads.delete(manifest.version);
        const state = await inspect(manifest);
        notify({ type: state.ready ? 'COMPLETE' : 'PAUSED', state });
        return state;
      }
      const state = { ...await inspect(manifest), downloading: false, paused: false };
      if (!state.ready) throw new Error('完整性檢查尚未通過，請重試下載。');
      notify({ type: 'COMPLETE', state });
      return state;
    } catch (error) {
      if (job.paused) {
        await (await caches.open(META)).put(PAUSED_KEY + manifest.version, new Response('paused'));
        downloads.delete(manifest.version);
        const state = await inspect(manifest);
        notify({ type: state.ready ? 'COMPLETE' : 'PAUSED', state });
        return state;
      }
      const state = { ...await inspect(manifest), downloading: false };
      notify({ type: 'ERROR', message: explainError(error), state });
      return state;
    } finally { downloads.delete(manifest.version); }
  })();
  return job.promise;
}
async function activeVersion() {
  const saved = await (await caches.open(META)).match(ACTIVE_KEY);
  return saved ? saved.text() : MANIFEST.version;
}
async function boundVersion(clientId) {
  if (!clientId) return null;
  const saved = await (await caches.open(META)).match(CLIENT_KEY + clientId);
  return saved ? saved.text() : null;
}
async function switchServingVersion() {
  const state = await inspect(MANIFEST);
  if (!state.ready) throw new Error('請先完成新版全部素材下載。');
  const control = await caches.open(META);
  await control.put(ACTIVE_KEY, new Response(MANIFEST.version));
  return state;
}
async function activate() {
  const previous = await activeVersion();
  const state = await inspect(MANIFEST);
  if (state.ready || previous === MANIFEST.version) {
    await (await caches.open(META)).put(ACTIVE_KEY, new Response(MANIFEST.version));
  }
  await self.clients.claim();
  // Keep the previous pack and every pack still used by an open page. Never clear a playable pack for a partial update.
  if (state.ready) {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const preserve = new Set([MANIFEST.version, previous]);
    for (const client of clients) { const version = await boundVersion(client.id); if (version) preserve.add(version); }
    for (const name of await caches.keys()) {
      const version = name.startsWith(PREFIX) ? name.slice(PREFIX.length) : '';
      if (/^[a-f0-9]{64}$/.test(version) && !preserve.has(version)) await caches.delete(name);
    }
  }
}
self.addEventListener('install', (event) => { event.waitUntil(installCore()); });
self.addEventListener('activate', (event) => { event.waitUntil(activate()); });
self.addEventListener('message', (event) => {
  const data = event.data || {};
  const port = event.ports && event.ports[0];
  if (data.type === 'BIND' && event.source && typeof data.version === 'string' && /^[a-f0-9]{64}$/.test(data.version)) {
    event.waitUntil(caches.open(META).then((cache) => cache.put(CLIENT_KEY + event.source.id, new Response(data.version))));
    return;
  }
  if (!port) return;
  event.waitUntil((async () => {
    try {
      if (data.type === 'CHECK') send(port, { type: 'STATE', state: await inspect(await getManifest(data.version)) });
      else if (data.type === 'DOWNLOAD') await download(await getManifest(data.version), port);
      else if (data.type === 'PAUSE') {
        const manifest = await getManifest(data.version);
        const job = downloads.get(manifest.version);
        if (job) { job.paused = true; await job.promise; }
        else if (!(await inspect(manifest)).ready) await (await caches.open(META)).put(PAUSED_KEY + manifest.version, new Response('paused'));
        send(port, { type: 'STATE', state: await inspect(manifest) });
      }
      else if (data.type === 'ACTIVATE') {
        const state = await switchServingVersion();
        send(port, { type: 'COMPLETE', state });
        await self.skipWaiting();
      } else send(port, { type: 'ERROR', message: '無法辨識離線操作。' });
    } catch (error) { send(port, { type: 'ERROR', message: explainError(error) }); }
  })());
});
async function cachedResponse(cached, request) {
  const range = request.headers && request.headers.get('Range');
  if (!range) return cached;
  const bytes = await cached.arrayBuffer();
  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  let start = 0, end = bytes.byteLength - 1;
  if (!match || (!match[1] && !match[2])) {
    return new Response(null, {status:416,headers:{'Content-Range':'bytes */'+bytes.byteLength}});
  }
  if (!match[1]) start = Math.max(0, bytes.byteLength - Number(match[2]));
  else { start=Number(match[1]); if(match[2]) end=Math.min(end,Number(match[2])); }
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start < 0
    || start >= bytes.byteLength || (!match[1] && Number(match[2]) === 0)) {
    return new Response(null, {status:416,headers:{'Content-Range':'bytes */'+bytes.byteLength}});
  }
  const headers = new Headers(cached.headers);
  headers.set('Accept-Ranges','bytes');
  headers.set('Content-Range','bytes '+start+'-'+end+'/'+bytes.byteLength);
  headers.set('Content-Length',String(end-start+1));
  return new Response(bytes.slice(start,end+1),{status:206,headers});
}
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith(SCOPE.pathname)) return;
  if (url.pathname === scoped('/sw.js') || url.pathname === scoped('/offline-manifest.json')) return;
  // A teacher URL is an independent online page, never the student shell or an old cached answer file.
  let relativePath;
  try { relativePath = decodeURIComponent(url.pathname.slice(SCOPE.pathname.length)); }
  catch { return; }
  if (relativePath === 'teacher' || relativePath.startsWith('teacher/')) return;
  event.respondWith((async () => {
    const version = request.mode === 'navigate' ? await activeVersion()
      : await boundVersion(event.clientId) || await activeVersion();
    const cache = await caches.open(packName(version));
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cachedResponse(cached, request);
    if (request.mode === 'navigate') {
      const shell = await cache.match(scoped('/index.html'));
      if (shell) return shell;
    }
    try { return await fetch(request); }
    catch (error) {
      if (request.mode === 'navigate') {
        const fallback = await (await caches.open(packName(MANIFEST.version))).match(scoped('/index.html'));
        if (fallback) return fallback;
      }
      throw error;
    }
  })());
});
`;

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const manifest = await buildOffline(process.argv[2] || 'dist');
  const audioCount = manifest.files.filter((file) => !file.core).length;
  console.log('Offline pack ' + manifest.version.slice(0, 12) + ': ' + manifest.files.length + ' files, ' + audioCount + ' audio, ' + Math.round(manifest.totalBytes / 1024 / 1024 * 10) / 10 + ' MB');
}
