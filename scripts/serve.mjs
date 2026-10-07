import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import { resolve, relative, isAbsolute, sep, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const types = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8', '.md': 'text/markdown; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.wasm': 'application/wasm', '.txt': 'text/plain; charset=utf-8',
};
const within = (root, path) => {
  const part = relative(root, path);
  return part !== '..' && !part.startsWith('..' + sep) && !isAbsolute(part);
};

/** One byte range, including suffix and open-ended forms; invalid ranges return null. */
export function parseByteRange(header, size) {
  if (typeof header !== 'string' || !Number.isSafeInteger(size) || size <= 0) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || (!match[1] && !match[2])) return null;
  let start;
  let end;
  if (!match[1]) {
    const length = Number(match[2]);
    if (!Number.isSafeInteger(length) || length <= 0) return null;
    start = Math.max(0, size - length); end = size - 1;
  } else {
    start = Number(match[1]); end = match[2] ? Number(match[2]) : size - 1;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= size || end < start) return null;
    end = Math.min(end, size - 1);
  }
  return { start, end };
}

export async function startServer({ root = resolve(dirname(fileURLToPath(import.meta.url)), '../dist'), port = 4173 } = {}) {
  const rootReal = await realpath(root);
  if (!(await stat(resolve(rootReal, 'index.html'))).isFile()) throw new Error('找不到 dist/index.html，請先建置或確認發佈包已完整解壓。');
  const server = createServer(async (request, response) => {
    const reply = (status, message) => {
      response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
      response.end(request.method === 'HEAD' ? undefined : message);
    };
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.setHeader('Allow', 'GET, HEAD'); reply(405, '僅提供靜態遊戲檔案。'); return;
    }
    let path;
    try {
      const raw = (request.url ?? '/').split(/[?#]/, 1)[0];
      if (!raw.startsWith('/')) { reply(400, '網址格式不正確。'); return; }
      path = decodeURIComponent(raw);
    } catch { reply(400, '網址編碼不正確。'); return; }
    if (/[\\\0]/.test(path) || path.split('/').some((part) => part === '..')) { reply(403, '無法存取遊戲資料夾以外的檔案。'); return; }
    let target = resolve(rootReal, '.' + (path === '/' ? '/index.html' : path));
    if (!within(rootReal, target)) { reply(403, '無法存取遊戲資料夾以外的檔案。'); return; }
    try {
      let info;
      try { info = await stat(target); }
      catch (error) {
        if (error.code === 'ENOENT' && !extname(path)) { target = resolve(rootReal, 'index.html'); info = await stat(target); }
        else throw error;
      }
      if (!info.isFile()) { reply(404, '找不到這個遊戲檔案。'); return; }
      const targetReal = await realpath(target);
      if (!within(rootReal, targetReal)) { reply(403, '無法存取遊戲資料夾以外的檔案。'); return; }
      const extension = extname(targetReal).toLowerCase();
      const etag = '"' + info.size.toString(16) + '-' + Math.trunc(info.mtimeMs).toString(16) + '"';
      const noCache = targetReal === resolve(rootReal, 'index.html')
        || ['/sw.js', '/offline-manifest.json', '/manifest.webmanifest'].includes(path);
      response.setHeader('Content-Type', types[extension] || 'application/octet-stream');
      response.setHeader('Cache-Control', noCache ? 'no-cache' : 'public, max-age=3600');
      response.setHeader('Accept-Ranges', 'bytes');
      response.setHeader('ETag', etag);
      response.setHeader('Last-Modified', info.mtime.toUTCString());
      if (path === '/sw.js') response.setHeader('Service-Worker-Allowed', '/');
      let range = null;
      const rangeHeader = request.headers.range;
      const ifRange = request.headers['if-range'];
      const useRange = rangeHeader && (!ifRange || ifRange === etag || Date.parse(ifRange) >= Math.trunc(info.mtimeMs / 1000) * 1000);
      if (useRange) {
        range = parseByteRange(rangeHeader, info.size);
        if (!range) {
          response.setHeader('Content-Range', 'bytes */' + info.size);
          reply(416, '要求的音檔或檔案範圍無效。'); return;
        }
      }
      if (!rangeHeader && request.headers['if-none-match'] === etag) { response.writeHead(304); response.end(); return; }
      if (range) {
        response.setHeader('Content-Range', 'bytes ' + range.start + '-' + range.end + '/' + info.size);
        response.setHeader('Content-Length', range.end - range.start + 1);
        response.writeHead(206);
      } else { response.setHeader('Content-Length', info.size); response.writeHead(200); }
      if (request.method === 'HEAD') { response.end(); return; }
      const stream = createReadStream(targetReal, range ?? {});
      response.on('close', () => stream.destroy());
      stream.on('error', () => response.destroy());
      stream.pipe(response);
    } catch (error) {
      if (response.headersSent) { response.destroy(); return; }
      reply(error.code === 'ENOENT' || error.code === 'ENOTDIR' ? 404 : 500, '找不到或無法讀取這個遊戲檔案。');
    }
  });
  await new Promise((resolveListen, rejectListen) => {
    server.once('error', rejectListen);
    server.listen(port, '127.0.0.1', () => { server.removeListener('error', rejectListen); resolveListen(); });
  });
  return server;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const portText = process.env.PORT ?? process.argv.slice(2).find((argument) => /^\d+$/.test(argument)) ?? '4173';
  const port = Number(portText);
  if (!Number.isInteger(port) || port < 1 || port > 65535) { console.error('連接埠需為 1–65535。'); process.exitCode = 1; }
  else {
    try {
      const server = await startServer({ port });
      const url = 'http://127.0.0.1:' + port;
      console.log('AI 校園守護隊已啟動：' + url);
      console.log('請保留這個視窗。關閉視窗或按 Ctrl+C 可停止本機服務。');
      if (process.argv.includes('--open')) {
        const command = process.platform === 'win32' ? 'cmd.exe' : process.platform === 'darwin' ? 'open' : 'xdg-open';
        const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
        const child = spawn(command, args, { windowsHide: true, stdio: 'ignore' });
        child.on('error', () => console.log('請自行在瀏覽器開啟：' + url));
      }
      process.on('SIGINT', () => server.close(() => { process.exitCode = 0; }));
      process.on('SIGTERM', () => server.close(() => { process.exitCode = 0; }));
    } catch (error) {
      console.error(error.code === 'EADDRINUSE'
        ? '4173 連接埠已被使用。若遊戲已在執行，請開啟 http://127.0.0.1:4173；否則關閉既有服務後重試。'
        : '啟動失敗：' + error.message);
      process.exitCode = 1;
    }
  }
}
