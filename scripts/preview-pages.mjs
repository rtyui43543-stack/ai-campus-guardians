import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import { resolve, relative, isAbsolute, sep, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseByteRange } from './serve.mjs';

const types = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8', '.md': 'text/markdown; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.wasm': 'application/wasm',
};
const within = (root, target) => {
  const part = relative(root, target);
  return part !== '..' && !part.startsWith('..' + sep) && !isAbsolute(part);
};

/** Canonical URL path: suitable for Pages repository names, including encoded spaces. */
export function normalizePagesBase(input = '/ai-campus-guardians/') {
  if (typeof input !== 'string' || !input.startsWith('/') || /[?#\\\0]/.test(input)) {
    throw new Error('Base 必須是以 / 開頭的網址路徑。');
  }
  const parts = input.split('/').filter(Boolean).map((part) => {
    const decoded = decodeURIComponent(part);
    if (!decoded || decoded === '.' || decoded === '..' || /[/\\\0?#]/.test(decoded)) {
      throw new Error('Base 不可包含跳脫或網址控制字元。');
    }
    return encodeURIComponent(decoded);
  });
  return '/' + (parts.length ? parts.join('/') + '/' : '');
}

/** QA server that deliberately refuses origin-root assets and missing Pages paths. */
export async function startPagesServer({
  root = resolve(dirname(fileURLToPath(import.meta.url)), '../dist'),
  port = 4180, base = '/ai-campus-guardians/', delay = 0,
} = {}) {
  const basePath = normalizePagesBase(base);
  const decodedBase = decodeURIComponent(basePath);
  if (!Number.isInteger(delay) || delay < 0 || delay > 25000) throw new Error('Delay 需為 0–25000 毫秒。');
  const rootReal = await realpath(root);
  if (!(await stat(resolve(rootReal, 'index.html'))).isFile()) throw new Error('請先建置 dist/index.html。');
  const server = createServer(async (request, response) => {
    const reply = (status, message) => {
      response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
      response.end(request.method === 'HEAD' ? undefined : message);
    };
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.setHeader('Allow', 'GET, HEAD'); reply(405, '僅提供靜態遊戲檔案。'); return;
    }
    let pathname;
    try {
      const raw = (request.url ?? '/').split(/[?#]/, 1)[0];
      if (!raw.startsWith('/')) { reply(400, '網址格式不正確。'); return; }
      pathname = decodeURIComponent(raw);
    } catch { reply(400, '網址編碼不正確。'); return; }
    if (/[\\\0]/.test(pathname) || pathname.split('/').some((part) => part === '..')) {
      reply(403, '無法存取遊戲資料夾以外的檔案。'); return;
    }
    if (basePath !== '/' && pathname === decodedBase.slice(0, -1)) {
      response.writeHead(308, { Location: basePath, 'Cache-Control': 'no-store' }); response.end(); return;
    }
    if (!pathname.startsWith(decodedBase)) { reply(404, '此路徑不在 Pages 專案內。'); return; }
    const relativePath = pathname.slice(decodedBase.length);
    let target = resolve(rootReal, relativePath || 'index.html');
    if (!within(rootReal, target)) { reply(403, '無法存取遊戲資料夾以外的檔案。'); return; }
    try {
      let info = await stat(target);
      if (info.isDirectory()) {
        if (!pathname.endsWith('/')) {
          response.writeHead(308, { Location: basePath + relativePath.split('/').map(encodeURIComponent).join('/') + '/', 'Cache-Control': 'no-store' });
          response.end(); return;
        }
        target = resolve(target, 'index.html'); info = await stat(target);
      }
      if (!info.isFile()) { reply(404, '找不到這個遊戲檔案。'); return; }
      const targetReal = await realpath(target);
      if (!within(rootReal, targetReal)) { reply(403, '無法存取遊戲資料夾以外的檔案。'); return; }
      const noCache = ['index.html', 'sw.js', 'offline-manifest.json', 'manifest.webmanifest'].includes(relativePath || 'index.html');
      if (delay && !noCache) await new Promise((done) => setTimeout(done, delay));
      if (response.destroyed) return;
      const etag = '"' + info.size.toString(16) + '-' + Math.trunc(info.mtimeMs).toString(16) + '"';
      response.setHeader('Content-Type', types[extname(targetReal).toLowerCase()] || 'application/octet-stream');
      response.setHeader('Cache-Control', noCache ? 'no-cache' : 'public, max-age=3600');
      response.setHeader('Accept-Ranges', 'bytes');
      response.setHeader('ETag', etag);
      response.setHeader('Last-Modified', info.mtime.toUTCString());
      if (relativePath === 'sw.js') response.setHeader('Service-Worker-Allowed', basePath);
      const rangeHeader = request.headers.range;
      const ifRange = request.headers['if-range'];
      const useRange = rangeHeader && (!ifRange || ifRange === etag || Date.parse(ifRange) >= Math.trunc(info.mtimeMs / 1000) * 1000);
      const range = useRange ? parseByteRange(rangeHeader, info.size) : null;
      if (useRange && !range) {
        response.setHeader('Content-Range', 'bytes */' + info.size); reply(416, '檔案範圍無效。'); return;
      }
      if (!rangeHeader && request.headers['if-none-match'] === etag) { response.writeHead(304); response.end(); return; }
      if (range) {
        response.setHeader('Content-Range', 'bytes ' + range.start + '-' + range.end + '/' + info.size);
        response.setHeader('Content-Length', range.end - range.start + 1); response.writeHead(206);
      } else { response.setHeader('Content-Length', info.size); response.writeHead(200); }
      if (request.method === 'HEAD') { response.end(); return; }
      const stream = createReadStream(targetReal, range ?? {});
      response.on('close', () => stream.destroy()); stream.on('error', () => response.destroy()); stream.pipe(response);
    } catch (error) {
      if (response.headersSent) { response.destroy(); return; }
      reply(error.code === 'ENOENT' || error.code === 'ENOTDIR' ? 404 : 500, '找不到或無法讀取這個 Pages 檔案。');
    }
  });
  await new Promise((done, fail) => {
    server.once('error', fail);
    server.listen(port, '127.0.0.1', () => { server.removeListener('error', fail); done(); });
  });
  return server;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const value = (name, fallback) => args.find((arg) => arg.startsWith('--' + name + '='))?.slice(name.length + 3) ?? fallback;
  const port = Number(value('port', args.find((arg) => /^\d+$/.test(arg)) ?? '4180'));
  const base = value('base', '/ai-campus-guardians/');
  const delay = Number(value('delay', '0'));
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('連接埠需為 1–65535。');
  const server = await startPagesServer({ port, base, delay, root: value('root', 'dist') });
  console.log('Pages 專案預覽：http://127.0.0.1:' + port + normalizePagesBase(base));
  if (delay) console.log('素材回應延遲：' + delay + ' ms，僅用於下載暫停／續傳驗收。');
  process.on('SIGINT', () => server.close(() => { process.exitCode = 0; }));
  process.on('SIGTERM', () => server.close(() => { process.exitCode = 0; }));
}
