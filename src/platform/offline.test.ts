import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash, webcrypto } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import { mergeOfflineCandidateState, mergeOfflineProgress, mergeOfflineRecoveryState, mergeOfflineSnapshot, offlineRegistrationLocation, recoverOfflineUpdate, validateOfflineManifest, validWorkerSnapshot } from './offline';
import type { OfflineManifest, OfflineState, WorkerSnapshot } from './offline';

const version = 'a'.repeat(64);
const state: OfflineState = { version, ready: false, done: 1, total: 3, bytes: 5, totalBytes: 15,
  supported: true, downloading: false, error: '', updateAvailable: false, online: true };
const sha = (value: Buffer | string) => createHash('sha256').update(value).digest('hex');

describe('offline protocol', () => {
  it('does not mark a partial pack ready or apply another worker version', () => {
    expect(validWorkerSnapshot({ ...state, ready: true })).toBe(false);
    expect(mergeOfflineSnapshot(state, { ...state, ready: true })).toBe(state);
    expect(mergeOfflineSnapshot(state, { ...state, version: 'b'.repeat(64) })).toBe(state);
    const complete: WorkerSnapshot = { version, ready: true, done: 3, total: 3, bytes: 15, totalBytes: 15 };
    expect(mergeOfflineSnapshot(state, complete).ready).toBe(true);
  });
  it('updates staged-download counts without declaring the running pack ready', () => {
    const progress = { version: 'b'.repeat(64), ready: true, done: 4, total: 4, bytes: 20, totalBytes: 20 };
    const updated = mergeOfflineProgress(state, progress, progress.version);
    expect(updated.version).toBe(version);
    expect(updated.ready).toBe(false);
    expect(updated.downloading).toBe(true);
    expect(updated.done).toBe(4);
    expect(mergeOfflineProgress(state, progress, version)).toBe(state);
  });
  it('preserves the paused current download when a newly installed update has only its core files', () => {
    const paused = { ...state, paused: true, downloading: false };
    const candidate: WorkerSnapshot = { version: 'b'.repeat(64), ready: false, done: 2, total: 4, bytes: 8, totalBytes: 20, paused: false, downloading: false };
    const checked = mergeOfflineCandidateState(paused, candidate, false);
    expect(checked).toEqual({ ...paused, updateAvailable: false });
    expect(mergeOfflineCandidateState(paused, { ...candidate, ready: true, done: 4, bytes: 20 }, false)).toEqual({ ...paused, updateAvailable: true });
    expect(mergeOfflineCandidateState({ ...state, downloading: true }, candidate, false).downloading).toBe(true);
  });
  it('shows a paused staged download when the current pack is already complete', () => {
    const complete = { ...state, ready: true, done: 3, total: 3, bytes: 15, totalBytes: 15 };
    const candidate: WorkerSnapshot = { version: 'b'.repeat(64), ready: false, done: 2, total: 4, bytes: 8, totalBytes: 20, paused: true, downloading: false };
    const checked = mergeOfflineCandidateState(complete, candidate, true);
    expect(checked).toMatchObject({ version, ready: true, paused: true, downloading: false, updateAvailable: false });
  });
  it('stages a recovered future pack without falsely completing the open game', () => {
    const complete: WorkerSnapshot = { version: 'b'.repeat(64), ready: true, done: 4, total: 4, bytes: 20, totalBytes: 20, paused: false, downloading: false };
    expect(mergeOfflineRecoveryState(state, complete)).toMatchObject({ version, ready: false, updateAvailable: true, done: 4, total: 4, bytes: 20, totalBytes: 20, error: '' });
    expect(mergeOfflineRecoveryState(state, { ...complete, version })).toBe(state);
  });
  it('does not retry the same unavailable version and retains actionable candidate failures', async () => {
    let retries = 0;
    expect(await recoverOfflineUpdate(version, async () => state, async () => { retries += 1; return state; })).toBeNull();
    expect(retries).toBe(0);
    const newer = { ...state, version: 'b'.repeat(64) };
    await expect(recoverOfflineUpdate(version, async () => newer, async () => { throw new Error('裝置儲存空間不足'); })).rejects.toThrow('裝置儲存空間不足');
    await expect(recoverOfflineUpdate(version, async () => newer, async () => state)).rejects.toThrow('新版離線素材尚未完整下載');
  });
  it('rejects nonlocal, duplicate or incorrectly totalled pack files', () => {
    const valid: OfflineManifest = { schemaVersion: 1, version, totalBytes: 2,
      files: [{ url: '/index.html', hash: version, size: 2, core: true }] };
    expect(validateOfflineManifest(valid)).toBe(true);
    expect(validateOfflineManifest({ ...valid, totalBytes: 1 })).toBe(false);
    expect(validateOfflineManifest({ ...valid, files: [...valid.files, ...valid.files], totalBytes: 4 })).toBe(false);
    expect(validateOfflineManifest({ ...valid, files: [{ ...valid.files[0], url: '//remote.example/asset' }] })).toBe(false);
    expect(validateOfflineManifest({ ...valid, files: [{ ...valid.files[0], url: '/../index.html' }] })).toBe(false);
    expect(validateOfflineManifest({ ...valid, files: [{ ...valid.files[0], url: '/%2e%2e/index.html' }] })).toBe(false);
  });
  it('registers a worker in the account root or the current GitHub Pages project', () => {
    expect(offlineRegistrationLocation('./', 'https://owner.github.io/ethics-game/#welcome')).toEqual({
      script: 'https://owner.github.io/ethics-game/sw.js', scope: 'https://owner.github.io/ethics-game/',
    });
    expect(offlineRegistrationLocation('/ethics-game/', 'https://owner.github.io/ethics-game/index.html')).toEqual({
      script: 'https://owner.github.io/ethics-game/sw.js', scope: 'https://owner.github.io/ethics-game/',
    });
    expect(offlineRegistrationLocation('./', 'https://owner.github.io/?from=home')).toEqual({
      script: 'https://owner.github.io/sw.js', scope: 'https://owner.github.io/',
    });
  });
  it('rejects conflicting or malformed download status', () => {
    expect(validWorkerSnapshot({ ...state, paused: true, downloading: true })).toBe(false);
    expect(validWorkerSnapshot({ ...state, paused: 'yes' })).toBe(false);
    expect(validWorkerSnapshot({ ...state, paused: true, downloading: false })).toBe(true);
  });
});

type StoredCaches = Map<string, Map<string, Response>>;
function mockCaches(store: StoredCaches) {
  const key = (input: string | Request) => new URL(typeof input === 'string' ? input : input.url, 'https://school.test').pathname;
  return {
    keys: async () => [...store.keys()],
    delete: async (name: string) => store.delete(name),
    open: async (name: string) => {
      if (!store.has(name)) store.set(name, new Map());
      const cache = store.get(name)!;
      return {
        put: async (input: string | Request, response: Response) => { cache.set(key(input), response.clone()); },
        match: async (input: string | Request) => cache.get(key(input))?.clone(),
        delete: async (input: string | Request) => cache.delete(key(input)),
      };
    },
  };
}
type EventData = { data?: unknown; ports?: { postMessage(data: unknown): void }[]; source?: { id: string }; request?: Request; clientId?: string; waitUntil(promise: Promise<unknown>): void; respondWith?(promise: Promise<Response>): void };
function workerHarness(source: string, assets: Map<string, Buffer>, store: StoredCaches = new Map(), scope = '/') {
  const listeners = new Map<string, (event: EventData) => void>();
  const calls: string[] = [];
  let skipCount = 0;
  let corruptUrl = '';
  let openClients: { id: string }[] = [];
  let delay = 0;
  let activeRequests = 0;
  let peakRequests = 0;
  let offline = false;
  const pendingCalls: { count: number; resolve: () => void }[] = [];
  const context = {
    Response, Request, Headers, URL, AbortController, setTimeout, clearTimeout, crypto: webcrypto,
    caches: mockCaches(store),
    fetch: async (input: string | Request) => {
      const url = typeof input === 'string' ? input : new URL(input.url).pathname;
      calls.push(url);
      for (const item of pendingCalls) if (calls.length >= item.count) item.resolve();
      if (offline) throw new TypeError('No network');
      activeRequests += 1; peakRequests = Math.max(peakRequests, activeRequests);
      if (delay) await new Promise((done) => setTimeout(done, delay));
      activeRequests -= 1;
      const asset = assets.get(url);
      if (!asset) return new Response('missing', { status: 404 });
      return new Response(url === corruptUrl ? new Uint8Array([0, 1, 2]) : new Uint8Array(asset));
    },
    self: {
      location: { origin: 'https://school.test' },
      registration: { scope: 'https://school.test' + scope },
      clients: { claim: async () => {}, matchAll: async () => openClients },
      skipWaiting: async () => { skipCount += 1; },
      addEventListener: (type: string, handler: (event: EventData) => void) => { listeners.set(type, handler); },
    },
  };
  runInNewContext(source, context);
  const dispatch = async (type: string, extra: Partial<EventData> = {}) => {
    let pending: Promise<unknown> | undefined;
    let response: Promise<Response> | undefined;
    listeners.get(type)!({ waitUntil: (promise) => { pending = promise; }, respondWith: (promise) => { response = promise; }, ...extra });
    await pending;
    return response;
  };
  const message = async (type: string, requestedVersion?: string) => {
    const replies: Record<string, unknown>[] = [];
    await dispatch('message', { data: { type, version: requestedVersion }, ports: [{ postMessage: (data) => { replies.push(data as Record<string, unknown>); } }] });
    return replies;
  };
  return { dispatch, message, calls, store, corrupt: (url: string) => { corruptUrl = url; }, skips: () => skipCount,
    clients: (values: { id: string }[]) => { openClients = values; }, latency: (ms: number) => { delay = ms; }, peak: () => peakRequests,
    disconnect: () => { offline = true; },
    untilFetchCount: (count: number) => calls.length >= count ? Promise.resolve() : new Promise<void>((done) => pendingCalls.push({ count, resolve: done })) };
}

describe('generated complete offline pack', () => {
  let folder = '';
  let manifest: OfflineManifest;
  let assets: Map<string, Buffer>;
  let source = '';
  const build = () => {
    const result = spawnSync(process.execPath, ['scripts/build-offline.mjs', folder], { cwd: process.cwd(), encoding: 'utf8' });
    if (result.status !== 0) throw new Error(result.stderr || result.stdout);
    manifest = JSON.parse(readFileSync(resolve(folder, 'offline-manifest.json'), 'utf8')) as OfflineManifest;
    source = readFileSync(resolve(folder, 'sw.js'), 'utf8');
    assets = new Map(manifest.files.map((file) => [file.url, readFileSync(resolve(folder, decodeURIComponent(file.url.slice(1))))]));
  };
  beforeEach(() => {
    folder = mkdtempSync(resolve(tmpdir(), 'campus-offline-test-'));
    mkdirSync(resolve(folder, 'assets'));
    mkdirSync(resolve(folder, 'audio'));
    writeFileSync(resolve(folder, 'index.html'), '<html><head>\n</head><body>守護隊</body></html>');
    writeFileSync(resolve(folder, 'assets', 'app.js'), 'console.log("school")');
    writeFileSync(resolve(folder, 'assets', 'font.woff2'), new Uint8Array([1, 2, 3]));
    writeFileSync(resolve(folder, 'audio', '朗讀.mp3'), new Uint8Array([4, 5, 6, 7]));
    writeFileSync(resolve(folder, 'manifest.webmanifest'), '{"name":"AI 校園守護隊"}');
    build();
  });
  afterEach(() => {
    const path = resolve(folder);
    if (!path.startsWith(resolve(tmpdir()) + sep)) throw new Error('Unexpected cleanup path.');
    rmSync(path, { recursive: true, force: true });
  });
  it('hashes every asset, excludes generated files and is stable on repeat builds', () => {
    expect(validateOfflineManifest(manifest)).toBe(true);
    expect(manifest.files).toHaveLength(5);
    const audio = manifest.files.find((file) => file.url.endsWith('.mp3'))!;
    expect(audio.core).toBe(false);
    expect(audio.url).toContain('%');
    expect(manifest.files.every((file) => file.hash === sha(assets.get(file.url)!))).toBe(true);
    expect(readFileSync(resolve(folder, 'index.html'), 'utf8')).toContain(manifest.version);
    const before = JSON.stringify(manifest);
    build();
    expect(JSON.stringify(manifest)).toBe(before);
  });
  it('keeps teacher preparation files online and rejects them in the student offline manifest', () => {
    mkdirSync(resolve(folder, 'teacher'));
    writeFileSync(resolve(folder, 'teacher', 'index.html'), '<a href="./question-list.csv">下載題庫</a><a href="../">學生遊戲</a>');
    for (const name of ['question-list.csv', 'question-list.html', 'question-list.md', 'question-bank.json']) {
      writeFileSync(resolve(folder, 'teacher', name), 'teacher answers');
    }
    writeFileSync(resolve(folder, 'manifest.webmanifest'), '{"name":"AI 校園守護隊","start_url":"./","scope":"./"}');
    build();
    const studentVersion = manifest.version;
    expect(manifest.files).toHaveLength(5);
    expect(manifest.files.some((file) => file.url.startsWith('/teacher/'))).toBe(false);
    expect(manifest.files.find((file) => file.url.endsWith('.mp3'))).toBeDefined();
    expect(readFileSync(resolve(folder, 'teacher', 'question-list.csv'), 'utf8')).toBe('teacher answers');
    writeFileSync(resolve(folder, 'teacher', 'question-list.csv'), 'revised teacher answers');
    build();
    expect(manifest.version).toBe(studentVersion);
    const checked = spawnSync(process.execPath, ['scripts/check-pages.mjs', folder], { cwd: process.cwd(), encoding: 'utf8' });
    expect(checked.status, checked.stderr).toBe(0);
    expect(JSON.parse(checked.stdout)).toMatchObject({ teacherFilesOnline: 5, teacherFilesOffline: 0 });
    const teacherBytes = readFileSync(resolve(folder, 'teacher', 'question-list.csv'));
    manifest.files.push({ url: '/teacher/question-list.csv', hash: sha(teacherBytes), size: teacherBytes.length, core: true });
    manifest.totalBytes += teacherBytes.length;
    writeFileSync(resolve(folder, 'offline-manifest.json'), JSON.stringify(manifest));
    const rejected = spawnSync(process.execPath, ['scripts/check-pages.mjs', folder], { cwd: process.cwd(), encoding: 'utf8' });
    expect(rejected.status).toBe(1);
    expect(rejected.stderr).toContain('學生離線清單不得收錄教師教材');
  });
  it('leaves teacher pages to the network without serving an old cached answer or the student shell', async () => {
    for (const scope of ['/', '/ethics-game/']) {
      const scopedAssets = new Map([...assets].map(([url, bytes]) => [scope + url.slice(1), bytes]));
      const worker = workerHarness(source, scopedAssets, new Map(), scope);
      await worker.dispatch('install'); await worker.message('DOWNLOAD'); await worker.dispatch('activate');
      const oldPack = [...worker.store.entries()].find(([name]) => name.startsWith('ai-campus-guardians-pack-'))![1];
      oldPack.set(scope + 'teacher/question-list.csv', new Response('old cached answer key'));
      worker.disconnect();
      for (const path of ['teacher', 'teacher/', 'teacher/index.html', 'teacher/question-list.csv', '%74eacher/question-bank.json']) {
        const request = { url: 'https://school.test' + scope + path, method: 'GET', mode: 'navigate', headers: new Headers() } as Request;
        expect(await worker.dispatch('fetch', { request })).toBeUndefined();
      }
      const student = await worker.dispatch('fetch', { request: { url: 'https://school.test' + scope, method: 'GET', mode: 'navigate', headers: new Headers() } as Request });
      expect(await student!.text()).toContain('守護隊');
      expect((await worker.message('CHECK')).at(-1)!.state).toMatchObject({ ready: true });
    }
  });
  it('installs the shell without audio, then downloads and verifies the whole pack', async () => {
    const worker = workerHarness(source, assets);
    await worker.dispatch('install');
    expect(worker.calls.some((url) => url.endsWith('.mp3'))).toBe(false);
    const initial = (await worker.message('CHECK')).at(-1)!;
    expect((initial.state as WorkerSnapshot).ready).toBe(false);
    const complete = await worker.message('DOWNLOAD');
    expect(complete.some((reply) => reply.type === 'PROGRESS')).toBe(true);
    expect((complete.at(-1)!.state as WorkerSnapshot).ready).toBe(true);
    const cachedCalls = worker.calls.length;
    await worker.message('DOWNLOAD');
    expect(worker.calls).toHaveLength(cachedCalls);
    const pack = worker.store.get('ai-campus-guardians-pack-' + manifest.version)!;
    pack.delete(manifest.files.find((file) => !file.core)!.url);
    const missing = (await worker.message('CHECK')).at(-1)!;
    expect((missing.state as WorkerSnapshot).ready).toBe(false);
  });
  it('rejects an old or corrupt audio response, preserves partial files and retries', async () => {
    const worker = workerHarness(source, assets);
    await worker.dispatch('install');
    worker.corrupt(manifest.files.find((file) => !file.core)!.url);
    const failure = (await worker.message('DOWNLOAD')).at(-1)!;
    expect(failure.type).toBe('ERROR');
    expect((failure.state as WorkerSnapshot).ready).toBe(false);
    expect(worker.store.get('ai-campus-guardians-pack-' + manifest.version)!.size).toBeGreaterThan(1);
    worker.corrupt('');
    const retry = (await worker.message('DOWNLOAD')).at(-1)!;
    expect(retry.type).toBe('COMPLETE');
    expect((retry.state as WorkerSnapshot).ready).toBe(true);
  });
  it('blocks activation until a new pack is complete and retains the old playable pack', async () => {
    const oldVersion = manifest.version;
    const oldWorker = workerHarness(source, assets);
    await oldWorker.dispatch('install');
    await oldWorker.message('DOWNLOAD');
    await oldWorker.dispatch('activate');
    writeFileSync(resolve(folder, 'assets', 'app.js'), 'console.log("new school")');
    build();
    expect(manifest.version).not.toBe(oldVersion);
    const update = workerHarness(source, assets, oldWorker.store);
    await update.dispatch('install');
    expect((await update.message('ACTIVATE')).at(-1)!.type).toBe('ERROR');
    expect(update.skips()).toBe(0);
    expect(update.store.has('ai-campus-guardians-pack-' + oldVersion)).toBe(true);
    await update.message('DOWNLOAD');
    expect((await update.message('ACTIVATE')).at(-1)!.type).toBe('COMPLETE');
    expect(update.skips()).toBe(1);
    expect(update.store.has('ai-campus-guardians-pack-' + oldVersion)).toBe(true);
  });
  it('recovers an incomplete old pack after deployment removed its uncached audio, then waits for explicit activation', async () => {
    const oldVersion = manifest.version;
    const oldAssets = new Map(assets);
    const oldWorker = workerHarness(source, oldAssets);
    await oldWorker.dispatch('install'); await oldWorker.dispatch('activate');
    await oldWorker.message('PAUSE');
    await oldWorker.dispatch('message', { data: { type: 'BIND', version: oldVersion }, source: { id: 'open-old-game' } });
    rmSync(resolve(folder, 'audio', '朗讀.mp3'));
    writeFileSync(resolve(folder, 'audio', '新版朗讀.mp3'), new Uint8Array([8, 9, 10, 11]));
    writeFileSync(resolve(folder, 'assets', 'app.js'), 'console.log("new deployed school")');
    build();
    oldAssets.clear(); for (const [url, bytes] of assets) oldAssets.set(url, bytes);
    const update = workerHarness(source, assets, oldWorker.store);
    await update.dispatch('install');
    const failure = (await oldWorker.message('DOWNLOAD', oldVersion)).at(-1)!;
    expect(failure.type).toBe('ERROR');
    expect(String(failure.message)).toContain('無法下載');
    const recovered = await recoverOfflineUpdate(oldVersion,
      async () => (await update.message('CHECK')).at(-1)!.state as WorkerSnapshot,
      async () => (await update.message('DOWNLOAD')).at(-1)!.state as WorkerSnapshot);
    expect(recovered).toMatchObject({ version: manifest.version, ready: true });
    const ui = mergeOfflineRecoveryState({ ...state, version: oldVersion }, recovered!);
    expect(ui).toMatchObject({ version: oldVersion, ready: false, updateAvailable: true, done: manifest.files.length, bytes: manifest.totalBytes });
    expect((await oldWorker.message('CHECK', oldVersion)).at(-1)!.state).toMatchObject({ ready: false });
    expect(update.skips()).toBe(0);
    const retainedScript = await update.dispatch('fetch', { request: new Request('https://school.test/assets/app.js'), clientId: 'open-old-game' });
    expect(await retainedScript!.text()).toBe('console.log("school")');
    expect((await update.message('ACTIVATE')).at(-1)!.type).toBe('COMPLETE');
    expect(update.skips()).toBe(1);
    update.disconnect();
    const reopened = await update.dispatch('fetch', { request: { url: 'https://school.test/', method: 'GET', mode: 'navigate', headers: new Headers() } as Request });
    expect(await reopened!.text()).toContain(manifest.version);
  });
  it('keeps an open game on its original audio after a complete update', async () => {
    const oldVersion = manifest.version;
    const oldAudio = manifest.files.find((file) => !file.core)!.url;
    const oldWorker = workerHarness(source, assets);
    await oldWorker.dispatch('install');
    await oldWorker.message('DOWNLOAD');
    await oldWorker.dispatch('activate');
    await oldWorker.dispatch('message', { data: { type: 'BIND', version: oldVersion }, source: { id: 'running-game' } });
    writeFileSync(resolve(folder, 'audio', '朗讀.mp3'), new Uint8Array([9, 8, 7, 6]));
    build();
    const update = workerHarness(source, assets, oldWorker.store);
    update.clients([{ id: 'running-game' }]);
    await update.dispatch('install');
    await update.message('DOWNLOAD');
    await update.message('ACTIVATE');
    await update.dispatch('activate');
    const response = await update.dispatch('fetch', { request: new Request('https://school.test' + oldAudio), clientId: 'running-game' });
    expect([...new Uint8Array(await response!.arrayBuffer())]).toEqual([4, 5, 6, 7]);
    expect(update.store.has('ai-campus-guardians-pack-' + oldVersion)).toBe(true);
  });
  it('downloads large packs with at most six concurrent network requests', async () => {
    for (let index = 0; index < 15; index += 1) writeFileSync(resolve(folder, 'audio', 'take-' + index + '.mp3'), new Uint8Array([index]));
    build();
    const worker = workerHarness(source, assets);
    worker.latency(2);
    await worker.dispatch('install');
    const complete = (await worker.message('DOWNLOAD')).at(-1)!;
    expect((complete.state as WorkerSnapshot).ready).toBe(true);
    expect(worker.peak()).toBeGreaterThan(1);
    expect(worker.peak()).toBeLessThanOrEqual(6);
  });
  it('serves offline audio byte ranges while keeping the full verified asset', async () => {
    const worker = workerHarness(source, assets);
    await worker.dispatch('install'); await worker.message('DOWNLOAD'); await worker.dispatch('activate');
    const audio = manifest.files.find(file => !file.core)!;
    const partial = await worker.dispatch('fetch', {request:new Request('https://school.test'+audio.url,{headers:{Range:'bytes=1-2'}})});
    expect(partial!.status).toBe(206);
    expect(partial!.headers.get('Content-Range')).toBe('bytes 1-2/4');
    expect(partial!.headers.get('Content-Length')).toBe('2');
    expect([...new Uint8Array(await partial!.arrayBuffer())]).toEqual([5,6]);
    const suffix = await worker.dispatch('fetch', {request:new Request('https://school.test'+audio.url,{headers:{Range:'bytes=-2'}})});
    expect([...new Uint8Array(await suffix!.arrayBuffer())]).toEqual([6,7]);
    const full = await worker.dispatch('fetch', {request:new Request('https://school.test'+audio.url)});
    expect(full!.status).toBe(200);
    expect([...new Uint8Array(await full!.arrayBuffer())]).toEqual([4,5,6,7]);
    expect((await worker.message('CHECK')).at(-1)!.state).toMatchObject({ready:true});
  });
  it('rejects out-of-bounds and malformed audio ranges without losing the cached clip', async () => {
    const worker = workerHarness(source, assets);
    await worker.dispatch('install'); await worker.message('DOWNLOAD'); await worker.dispatch('activate');
    const audio = manifest.files.find(file => !file.core)!;
    for (const range of ['bytes=9-12','bytes=2-1','bytes=-0','bytes=0-1,2-3']) {
      const response = await worker.dispatch('fetch', {request:new Request('https://school.test'+audio.url,{headers:{Range:range}})});
      expect(response!.status).toBe(416);
      expect(response!.headers.get('Content-Range')).toBe('bytes */4');
    }
    expect((await worker.message('CHECK')).at(-1)!.state).toMatchObject({ready:true});
  });
  it('downloads from the project subpath and reopens the game and ranged audio without a network', async () => {
    const scope = '/ethics-game/';
    const scopedAssets = new Map([...assets].map(([url, bytes]) => [scope + url.slice(1), bytes]));
    const worker = workerHarness(source, scopedAssets, new Map(), scope);
    await worker.dispatch('install'); await worker.message('DOWNLOAD'); await worker.dispatch('activate');
    expect(worker.calls.every((url) => url.startsWith(scope))).toBe(true);
    worker.disconnect();
    const response = await worker.dispatch('fetch', { request: { url: 'https://school.test/ethics-game/?from=homescreen', method: 'GET', mode: 'navigate', headers: new Headers() } as Request });
    expect(await response!.text()).toContain('守護隊');
    const audio = manifest.files.find((file) => !file.core)!;
    const ranged = await worker.dispatch('fetch', { request: new Request('https://school.test' + scope + audio.url.slice(1), { headers: { Range: 'bytes=1-2' } }) });
    expect(ranged!.status).toBe(206);
    expect([...new Uint8Array(await ranged!.arrayBuffer())]).toEqual([5, 6]);
    expect((await worker.message('CHECK')).at(-1)!.state).toMatchObject({ ready: true, done: manifest.files.length, bytes: manifest.totalBytes });
    expect(await worker.dispatch('fetch', { request: new Request('https://school.test/another-project/assets/app.js') })).toBeUndefined();
    expect(await worker.dispatch('fetch', { request: new Request('https://school.test/ethics-game/offline-manifest.json') })).toBeUndefined();
  });
  it('keeps independent packs and serving versions for two projects sharing an origin', async () => {
    const store: StoredCaches = new Map();
    const project = (scope: string) => workerHarness(source, new Map([...assets].map(([url, bytes]) => [scope + url.slice(1), bytes])), store, scope);
    const first = project('/one/'); const second = project('/two/');
    await first.dispatch('install'); await first.message('DOWNLOAD'); await first.dispatch('activate');
    await second.dispatch('install'); await second.message('DOWNLOAD'); await second.dispatch('activate');
    const originalNames = [...store.keys()];
    expect(originalNames.filter((name) => name.startsWith('ai-campus-guardians-pack-'))).toHaveLength(2);
    writeFileSync(resolve(folder, 'assets', 'app.js'), 'console.log("updated one")'); build();
    const firstUpdate = project('/one/');
    await firstUpdate.dispatch('install'); await firstUpdate.message('DOWNLOAD'); await firstUpdate.message('ACTIVATE'); await firstUpdate.dispatch('activate');
    expect((await second.message('CHECK')).at(-1)!.state).toMatchObject({ ready: true });
    expect(originalNames.filter((name) => name.includes('%2Ftwo%2F')).every((name) => store.has(name))).toBe(true);
    second.disconnect();
    const oldScript = await second.dispatch('fetch', { request: new Request('https://school.test/two/assets/app.js') });
    expect(await oldScript!.text()).toBe('console.log("school")');
  });
  it('does not let an account-root worker delete a sibling project cache during cleanup', async () => {
    const store: StoredCaches = new Map();
    const project = workerHarness(source, new Map([...assets].map(([url, bytes]) => ['/school/' + url.slice(1), bytes])), store, '/school/');
    await project.dispatch('install'); await project.message('DOWNLOAD'); await project.dispatch('activate');
    const projectNames = [...store.keys()];
    const root = workerHarness(source, assets, store);
    await root.dispatch('install'); await root.message('DOWNLOAD'); await root.dispatch('activate');
    expect(projectNames.every((name) => store.has(name))).toBe(true);
    expect((await project.message('CHECK')).at(-1)!.state).toMatchObject({ ready: true });
  });
  it('pauses, retains verified files across a worker restart, and resumes only missing files', async () => {
    for (let index = 0; index < 18; index += 1) writeFileSync(resolve(folder, 'audio', 'take-' + index + '.mp3'), new Uint8Array([index]));
    build();
    const worker = workerHarness(source, assets);
    await worker.dispatch('install');
    const installed = worker.calls.length;
    worker.latency(35);
    const firstDownload = worker.message('DOWNLOAD');
    await worker.untilFetchCount(installed + 1);
    const pause = (await worker.message('PAUSE')).at(-1)!;
    const replies = await firstDownload;
    expect(replies.at(-1)!.type).toBe('PAUSED');
    const paused = pause.state as WorkerSnapshot;
    expect(paused).toMatchObject({ paused: true, downloading: false, ready: false });
    expect(paused.done).toBeGreaterThan(installed);
    expect(paused.done).toBeLessThan(paused.total);
    expect(worker.calls.length - installed).toBeLessThanOrEqual(6);
    const retained = new Set(worker.calls);
    const restarted = workerHarness(source, assets, worker.store);
    expect((await restarted.message('CHECK')).at(-1)!.state).toEqual(paused);
    expect(restarted.calls).toHaveLength(0);
    const completed = (await restarted.message('DOWNLOAD')).at(-1)!;
    expect(completed.type).toBe('COMPLETE');
    expect(completed.state).toMatchObject({ paused: false, downloading: false, ready: true, bytes: manifest.totalBytes });
    expect(restarted.calls.every((url) => !retained.has(url))).toBe(true);
  });
  it('joins a download after page reload instead of starting a duplicate network job', async () => {
    for (let index = 0; index < 12; index += 1) writeFileSync(resolve(folder, 'audio', 'take-' + index + '.mp3'), new Uint8Array([index]));
    build();
    const worker = workerHarness(source, assets);
    await worker.dispatch('install'); worker.latency(15);
    const firstDownload = worker.message('DOWNLOAD');
    await worker.untilFetchCount(worker.calls.length + 1);
    expect((await worker.message('CHECK')).at(-1)!.state).toMatchObject({ downloading: true, paused: false });
    const secondDownload = worker.message('DOWNLOAD');
    const [first, second] = await Promise.all([firstDownload, secondDownload]);
    expect(first.at(-1)!.type).toBe('COMPLETE'); expect(second.at(-1)!.type).toBe('COMPLETE');
    expect(new Set(worker.calls).size).toBe(worker.calls.length);
    expect((first.at(-1)!.state as WorkerSnapshot).bytes).toBe(manifest.totalBytes);
  });
});
