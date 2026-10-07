import { useCallback, useEffect, useRef, useState } from 'react';

export interface OfflineFile { url: string; hash: string; size: number; core: boolean }
export interface OfflineManifest { schemaVersion: 1; version: string; files: OfflineFile[]; totalBytes: number }
export interface WorkerSnapshot { version: string; ready: boolean; done: number; total: number; bytes: number; totalBytes: number; downloading?: boolean; paused?: boolean }
export interface OfflineState extends WorkerSnapshot {
  supported: boolean;
  downloading: boolean;
  error: string;
  updateAvailable: boolean;
  online: boolean;
}
export interface OfflineController {
  state: OfflineState;
  download(): Promise<void>;
  pause(): Promise<void>;
  check(): Promise<void>;
  applyUpdate(): Promise<void>;
  install(): Promise<void>;
  installable: boolean;
}
type WorkerReply = { type: 'STATE' | 'COMPLETE' | 'PAUSED'; state: WorkerSnapshot }
  | ({ type: 'PROGRESS' } & WorkerSnapshot)
  | { type: 'ERROR'; message: string; state?: WorkerSnapshot };
interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}
const hashPattern = /^[a-f0-9]{64}$/;
const finiteCount = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

export function validateOfflineManifest(value: unknown): value is OfflineManifest {
  if (!value || typeof value !== 'object') return false;
  const manifest = value as Partial<OfflineManifest>;
  if (manifest.schemaVersion !== 1 || !manifest.version || !hashPattern.test(manifest.version)
    || !Array.isArray(manifest.files) || !manifest.files.length || !finiteCount(manifest.totalBytes)) return false;
  const urls = new Set<string>();
  let bytes = 0;
  for (const file of manifest.files) {
    if (!file || typeof file.url !== 'string' || !file.url.startsWith('/') || file.url.startsWith('//')
      || /[\u0000-\u0020?#\\]/.test(file.url)
      || urls.has(file.url) || typeof file.hash !== 'string' || !hashPattern.test(file.hash)
      || !finiteCount(file.size) || typeof file.core !== 'boolean') return false;
    try {
      if (file.url.split('/').some((part) => {
        const decoded = decodeURIComponent(part);
        return decoded === '..' || decoded === '.' || /[\\/]/.test(decoded);
      })) return false;
    } catch { return false; }
    urls.add(file.url); bytes += file.size;
  }
  return urls.has('/index.html') && bytes === manifest.totalBytes;
}
export function validWorkerSnapshot(value: unknown): value is WorkerSnapshot {
  if (!value || typeof value !== 'object') return false;
  const state = value as Partial<WorkerSnapshot>;
  return typeof state.version === 'string' && hashPattern.test(state.version)
    && typeof state.ready === 'boolean' && finiteCount(state.done) && finiteCount(state.total) && state.total > 0
    && state.done <= state.total && finiteCount(state.bytes) && finiteCount(state.totalBytes) && state.bytes <= state.totalBytes
    && (state.downloading === undefined || typeof state.downloading === 'boolean')
    && (state.paused === undefined || typeof state.paused === 'boolean')
    && !(state.paused && state.downloading)
    && (!state.ready || (state.done === state.total && state.bytes === state.totalBytes));
}
/** An older worker or incomplete count must never falsely mark the current pack ready. */
export function mergeOfflineSnapshot(state: OfflineState, snapshot: unknown, expectedVersion = state.version): OfflineState {
  if (!validWorkerSnapshot(snapshot) || (expectedVersion && snapshot.version !== expectedVersion)) return state;
  return { ...state, ...snapshot };
}
export function mergeOfflineProgress(state: OfflineState, progress: unknown, expectedVersion: string): OfflineState {
  if (!validWorkerSnapshot(progress) || progress.version !== expectedVersion) return state;
  // A staged update is not the pack used by the already-open game.
  return { ...state, done: progress.done, total: progress.total, bytes: progress.bytes, totalBytes: progress.totalBytes, downloading: true, paused: false };
}

/** Checking a future update must not replace the running pack's persisted pause state. */
export function mergeOfflineCandidateState(state: OfflineState, snapshot: WorkerSnapshot, followCandidate: boolean): OfflineState {
  if (!followCandidate) return { ...state, updateAvailable: snapshot.ready };
  return { ...state, downloading: false, paused: snapshot.paused ?? false, updateAvailable: snapshot.ready };
}

/** A complete future pack is staged; the open game still belongs to its original version. */
export function mergeOfflineRecoveryState(state: OfflineState, snapshot: WorkerSnapshot): OfflineState {
  if (!validWorkerSnapshot(snapshot) || snapshot.version === state.version) return state;
  return { ...state, done: snapshot.done, total: snapshot.total, bytes: snapshot.bytes, totalBytes: snapshot.totalBytes,
    downloading: false, paused: snapshot.paused ?? false, updateAvailable: snapshot.ready, error: '' };
}

/** GitHub deployments can remove uncached old files; an explicit retry may fetch the latest complete pack. */
export async function recoverOfflineUpdate(currentVersion: string, inspectCandidate: () => Promise<WorkerSnapshot>, downloadCandidate: (snapshot: WorkerSnapshot) => Promise<WorkerSnapshot>): Promise<WorkerSnapshot | null> {
  const candidate = await inspectCandidate();
  if (!validWorkerSnapshot(candidate)) throw new Error('新版離線素材檢查結果不完整，請重試。');
  if (candidate.version === currentVersion) return null;
  const complete = candidate.ready ? candidate : await downloadCandidate(candidate);
  if (!validWorkerSnapshot(complete) || complete.version !== candidate.version || (!complete.ready && !complete.paused)) {
    throw new Error('新版離線素材尚未完整下載，請重試。');
  }
  return complete;
}

/** Vite's relative base remains portable between an account page and a project page. */
export function offlineRegistrationLocation(base: string, documentUrl: string) {
  const scope = new URL(base, documentUrl);
  if (!scope.pathname.endsWith('/')) scope.pathname += '/';
  scope.search = ''; scope.hash = '';
  return { script: new URL('sw.js', scope).href, scope: scope.href };
}

function requestWorker(worker: ServiceWorker, request: { type: string; version?: string }, onProgress?: (state: WorkerSnapshot) => void): Promise<WorkerSnapshot> {
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    let timeout: ReturnType<typeof setTimeout>;
    const finish = () => { clearTimeout(timeout); channel.port1.close(); };
    const reset = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => { finish(); reject(new Error('離線操作逾時，請確認連線後重試。')); }, 45000);
    };
    reset();
    channel.port1.onmessage = (event: MessageEvent<WorkerReply>) => {
      const reply = event.data;
      if (!reply || typeof reply !== 'object') return;
      reset();
      if (reply.type === 'PROGRESS') {
        if (validWorkerSnapshot(reply)) onProgress?.(reply);
      } else if (reply.type === 'STATE' || reply.type === 'COMPLETE' || reply.type === 'PAUSED') {
        finish();
        if (validWorkerSnapshot(reply.state)) resolve(reply.state);
        else reject(new Error('離線素材檢查結果不完整，請重試。'));
      } else if (reply.type === 'ERROR') {
        finish(); reject(new Error(typeof reply.message === 'string' ? reply.message : '離線操作失敗，請重試。'));
      }
    };
    try { worker.postMessage(request, [channel.port2]); }
    catch (error) { finish(); reject(error); }
  });
}
function currentPageVersion() {
  if (typeof document === 'undefined') return '';
  return document.querySelector<HTMLMetaElement>('meta[name="offline-build-version"]')?.content ?? '';
}
function initialState(): OfflineState {
  const browser = typeof window !== 'undefined' && typeof navigator !== 'undefined';
  const supported = browser && 'serviceWorker' in navigator && window.isSecureContext;
  return { supported, ready: false, downloading: false, paused: false, done: 0, total: 0, bytes: 0, totalBytes: 0,
    error: supported ? '' : '離線遊玩需要 HTTPS 安全連線與支援 Service Worker 的瀏覽器。電腦本機 localhost 也可使用；手機請用 HTTPS 網址。',
    updateAvailable: false, online: browser ? navigator.onLine : false, version: currentPageVersion() };
}

export function useOffline(): OfflineController {
  const [state, setState] = useState<OfflineState>(initialState);
  const [installable, setInstallable] = useState(false);
  const registration = useRef<ServiceWorkerRegistration | null>(null);
  const registerPromise = useRef<Promise<ServiceWorkerRegistration> | null>(null);
  const prompt = useRef<InstallPrompt | null>(null);
  const mounted = useRef(false);
  const pageVersion = useRef(currentPageVersion());
  const candidate = useRef<{ worker: ServiceWorker; version: string } | null>(null);
  const appliedVersion = useRef('');
  const operation = useRef<Promise<void> | null>(null);
  const downloadTarget = useRef<{ worker: ServiceWorker; version: string } | null>(null);
  const set = useCallback((update: (previous: OfflineState) => OfflineState) => {
    if (mounted.current) setState(update);
  }, []);
  const report = useCallback((error: unknown) => {
    set((previous) => ({ ...previous, downloading: false, error: error instanceof Error ? error.message : '離線操作失敗，請重試。' }));
  }, [set]);
  const getRegistration = useCallback(async () => {
    const existing = registration.current;
    if (existing?.active || existing?.installing || existing?.waiting) return existing;
    if (existing) { registration.current = null; registerPromise.current = null; }
    if (!('serviceWorker' in navigator) || !window.isSecureContext) throw new Error(initialState().error);
    if (!registerPromise.current) {
      const location = offlineRegistrationLocation(import.meta.env.BASE_URL, document.baseURI);
      registerPromise.current = navigator.serviceWorker.register(location.script, { scope: location.scope, updateViaCache: 'none' });
    }
    try {
      const value = await registerPromise.current;
      registration.current = value;
      return value;
    } catch (error) { registerPromise.current = null; throw error; }
  }, []);
  const bind = useCallback((worker: ServiceWorker) => {
    if (hashPattern.test(pageVersion.current)) worker.postMessage({ type: 'BIND', version: pageVersion.current });
  }, []);
  const liveWorker = useCallback(async (value: ServiceWorkerRegistration) => {
    if (value.active) return value.active;
    return new Promise<ServiceWorker>((resolve, reject) => {
      const installing = value.installing ?? value.waiting;
      const finish = () => { clearTimeout(timeout); installing?.removeEventListener('statechange', changed); };
      const changed = () => {
        if (installing?.state === 'redundant') {
          finish(); reject(new Error('離線服務安裝未完成，請確認連線與儲存空間後重試。'));
        } else if (value.active) { finish(); resolve(value.active); }
      };
      const timeout = setTimeout(() => { finish(); reject(new Error('離線服務啟動逾時，請確認連線後重試。')); }, 30000);
      installing?.addEventListener('statechange', changed);
      void navigator.serviceWorker.ready.then((ready) => {
        // An account-root PWA may already control this origin; wait for this project's worker.
        if (ready.scope === value.scope && ready.active) { finish(); resolve(ready.active); }
      }).catch((error) => { finish(); reject(error); });
      changed();
    });
  }, []);
  const progress = useCallback((version: string) => (snapshot: WorkerSnapshot) => {
    set((previous) => mergeOfflineProgress(previous, snapshot, version));
  }, [set]);

  const stageCandidate = useCallback(async (worker: ServiceWorker, allowDownload: boolean, resumePaused = false) => {
    let snapshot = await requestWorker(worker, { type: 'CHECK' });
    if (snapshot.version === pageVersion.current || snapshot.version === appliedVersion.current) return;
    candidate.current = { worker, version: snapshot.version };
    if (!snapshot.ready && allowDownload && navigator.onLine && (!snapshot.paused || resumePaused)) {
      set((previous) => ({ ...previous, downloading: true, paused: false, error: '' }));
      const target = { worker, version: snapshot.version };
      downloadTarget.current = target;
      try { snapshot = await requestWorker(worker, { type: 'DOWNLOAD' }, progress(snapshot.version)); }
      finally { if (downloadTarget.current === target) downloadTarget.current = null; }
    }
    set((previous) => mergeOfflineCandidateState(previous, snapshot, allowDownload));
  }, [progress, set]);

  const check = useCallback(async () => {
    try {
      const value = await getRegistration();
      const worker = await liveWorker(value);
      bind(worker);
      const page = await requestWorker(worker, { type: 'CHECK', ...(hashPattern.test(pageVersion.current) ? { version: pageVersion.current } : {}) });
      if (!pageVersion.current) pageVersion.current = page.version;
      set((previous) => ({ ...mergeOfflineSnapshot(previous, page, pageVersion.current), error: '' }));
      // A reload attaches to an existing worker job without re-fetching its verified files.
      if (page.downloading && !operation.current) {
        const target = { worker, version: page.version };
        downloadTarget.current = target;
        let resumed: WorkerSnapshot;
        try { resumed = await requestWorker(worker, { type: 'DOWNLOAD', version: page.version }, progress(page.version)); }
        finally { if (downloadTarget.current === target) downloadTarget.current = null; }
        set((previous) => ({ ...mergeOfflineSnapshot(previous, resumed, pageVersion.current), downloading: false }));
      }
      if (navigator.onLine) {
        try { await value.update(); }
        catch { /* A valid cached pack remains playable when the server cannot be reached. */ }
      }
      const target = value.waiting ?? value.active;
      if (target) await stageCandidate(target, page.ready);
    } catch (error) { report(error); }
  }, [bind, getRegistration, liveWorker, report, set, stageCandidate]);

  const download = useCallback(async () => {
    if (operation.current) return operation.current;
    const job = (async () => {
      let pageDownloadCompleted = false;
      try {
        const value = await getRegistration();
        const worker = await liveWorker(value);
        const before = await requestWorker(worker, { type: 'CHECK', ...(hashPattern.test(pageVersion.current) ? { version: pageVersion.current } : {}) });
        if (!pageVersion.current) pageVersion.current = before.version;
        set((previous) => ({ ...mergeOfflineSnapshot(previous, before, pageVersion.current), downloading: true, paused: false, error: '' }));
        downloadTarget.current = { worker, version: pageVersion.current };
        const complete = await requestWorker(worker, { type: 'DOWNLOAD', version: pageVersion.current }, progress(pageVersion.current));
        downloadTarget.current = null;
        set((previous) => ({ ...mergeOfflineSnapshot(previous, complete, pageVersion.current), downloading: false, error: '' }));
        if (complete.paused) return;
        pageDownloadCompleted = complete.ready;
        if (value.waiting) await stageCandidate(value.waiting, true, true);
        else if (value.active) await stageCandidate(value.active, true, true);
      } catch (error) {
        downloadTarget.current = null;
        report(error);
        if (pageDownloadCompleted) return; // Preserve an update's failure without retrying it twice.
        // Re-check actual cache presence after an interrupted or quota-limited download.
        try {
          const value = await getRegistration();
          const worker = await liveWorker(value);
          const snapshot = await requestWorker(worker, { type: 'CHECK', version: pageVersion.current });
          set((previous) => ({ ...mergeOfflineSnapshot(previous, snapshot, pageVersion.current), downloading: false }));
        } catch { /* Preserve the actionable original error. */ }
        // A removed old audio file must not trap an incomplete pack after a GitHub Pages deploy.
        // Only an explicit download can take this path; CHECK never resumes a paused pack.
        try {
          const value = await getRegistration();
          const worker = value.waiting ?? value.active;
          if (!worker) return;
          const recovered = await recoverOfflineUpdate(pageVersion.current,
            () => requestWorker(worker, { type: 'CHECK' }),
            async (snapshot) => {
              candidate.current = { worker, version: snapshot.version };
              set((previous) => ({ ...previous, downloading: true, paused: false, error: '' }));
              const target = { worker, version: snapshot.version };
              downloadTarget.current = target;
              try { return await requestWorker(worker, { type: 'DOWNLOAD', version: snapshot.version }, progress(snapshot.version)); }
              finally { if (downloadTarget.current === target) downloadTarget.current = null; }
            });
          if (recovered) {
            candidate.current = { worker, version: recovered.version };
            set((previous) => mergeOfflineRecoveryState(previous, recovered));
          }
        } catch (recoveryError) { report(recoveryError); }
      }
    })();
    operation.current = job;
    try { await job; } finally { operation.current = null; }
  }, [getRegistration, liveWorker, progress, report, set, stageCandidate]);

  const pause = useCallback(async () => {
    try {
      const value = await getRegistration();
      const target = downloadTarget.current ?? candidate.current ?? { worker: await liveWorker(value), version: pageVersion.current };
      const snapshot = await requestWorker(target.worker, { type: 'PAUSE', version: target.version });
      set((previous) => target.version === pageVersion.current
        ? { ...mergeOfflineSnapshot(previous, snapshot, pageVersion.current), downloading: false, error: '' }
        : { ...previous, downloading: false, paused: snapshot.paused ?? false, error: '' });
    } catch (error) { report(error); }
  }, [getRegistration, liveWorker, report, set]);

  const applyUpdate = useCallback(async () => {
    if (operation.current) await operation.current;
    try {
      const value = await getRegistration();
      const selected = candidate.current?.worker ?? value.waiting;
      if (!selected) return;
      const checked = await requestWorker(selected, { type: 'CHECK' });
      if (!checked.ready) throw new Error('新版素材尚未完整下載，請先完成下載後再套用。');
      await requestWorker(selected, { type: 'ACTIVATE' });
      appliedVersion.current = checked.version;
      candidate.current = null;
      set((previous) => ({ ...previous, updateAvailable: false, error: '' }));
      // Keep this game's current code, question set and audio binding. Next navigation loads the update.
    } catch (error) { report(error); }
  }, [getRegistration, report, set]);
  const install = useCallback(async () => {
    const available = prompt.current;
    if (!available) {
      set((previous) => ({ ...previous, error: '此瀏覽器請用分享選單的「加入主畫面」，或瀏覽器選單的安裝功能。' }));
      return;
    }
    try { await available.prompt(); await available.userChoice; }
    catch (error) { report(error); }
    finally { prompt.current = null; if (mounted.current) setInstallable(false); }
  }, [report, set]);

  useEffect(() => {
    mounted.current = true;
    let disposed = false;
    const onInstall = (event: Event) => {
      event.preventDefault(); prompt.current = event as InstallPrompt; setInstallable(true);
    };
    const onInstalled = () => { prompt.current = null; setInstallable(false); };
    const onConnection = () => {
      set((previous) => ({ ...previous, online: navigator.onLine }));
      if (navigator.onLine && !operation.current) void check();
    };
    const onController = () => {
      const worker = navigator.serviceWorker.controller;
      if (worker) bind(worker);
    };
    window.addEventListener('beforeinstallprompt', onInstall);
    window.addEventListener('appinstalled', onInstalled);
    window.addEventListener('online', onConnection);
    window.addEventListener('offline', onConnection);
    let removeUpdateListener = () => {};
    if (state.supported) {
      navigator.serviceWorker.addEventListener('controllerchange', onController);
      void getRegistration().then((value) => {
        if (disposed) return;
        const onUpdate = () => {
          const worker = value.installing;
          if (!worker) return;
          const onState = () => {
            if (worker.state === 'installed' && value.waiting && !operation.current) void check();
            if (worker.state === 'installed' || worker.state === 'redundant') worker.removeEventListener('statechange', onState);
          };
          worker.addEventListener('statechange', onState);
        };
        value.addEventListener('updatefound', onUpdate);
        removeUpdateListener = () => value.removeEventListener('updatefound', onUpdate);
        return check();
      }).catch((error) => report(import.meta.env.DEV ? new Error('離線功能需使用正式預覽：先 npm run build，再 npm run preview。') : error));
    }
    return () => {
      disposed = true;
      mounted.current = false; removeUpdateListener();
      window.removeEventListener('beforeinstallprompt', onInstall);
      window.removeEventListener('appinstalled', onInstalled);
      window.removeEventListener('online', onConnection);
      window.removeEventListener('offline', onConnection);
      if ('serviceWorker' in navigator) navigator.serviceWorker.removeEventListener('controllerchange', onController);
    };
  }, [bind, check, getRegistration, report, set, state.supported]);

  return { state, download, pause, check, applyUpdate, install, installable };
}
