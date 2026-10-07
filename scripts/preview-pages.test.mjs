import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startPagesServer, normalizePagesBase } from './preview-pages.mjs';

test('Pages preview serves only the project subpath, with audio ranges and scoped worker', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'ai-pages-preview-'));
  await mkdir(join(root, 'audio')); await mkdir(join(root, 'teacher'));
  await writeFile(join(root, 'index.html'), '<!doctype html><title>Game</title>');
  await writeFile(join(root, 'audio', 'sample.mp3'), Buffer.from([0, 1, 2, 3, 4, 5, 6, 7]));
  await writeFile(join(root, 'teacher', 'index.html'), '<title>Teachers</title>');
  await writeFile(join(root, 'teacher', '題庫.csv'), 'id,A,B\n1,a,b\n');
  await writeFile(join(root, 'sw.js'), '/* worker */');
  const server = await startPagesServer({ root, port: 0, base: '/school%20garden/' });
  t.after(async () => { await new Promise((done) => server.close(done)); await rm(root, { recursive: true, force: true }); });
  const origin = 'http://127.0.0.1:' + server.address().port;
  const response = await fetch(origin + '/school%20garden/');
  assert.equal(response.status, 200); assert.match(await response.text(), /Game/);
  for (const path of ['/', '/index.html', '/audio/sample.mp3', '/school%20garden/missing', '/school%20gardener/']) {
    assert.equal((await fetch(origin + path)).status, 404, path + ' must not bypass the mount or receive a shell fallback');
  }
  const redirect = await fetch(origin + '/school%20garden', { redirect: 'manual' });
  assert.equal(redirect.status, 308); assert.equal(redirect.headers.get('location'), '/school%20garden/');
  const nested = await fetch(origin + '/school%20garden/teacher/');
  assert.equal(nested.status, 200); assert.match(await nested.text(), /Teachers/);
  const csv = await fetch(origin + '/school%20garden/teacher/%E9%A1%8C%E5%BA%AB.csv');
  assert.equal(csv.status, 200); assert.match(csv.headers.get('content-type'), /^text\/csv/);
  const worker = await fetch(origin + '/school%20garden/sw.js');
  assert.equal(worker.headers.get('service-worker-allowed'), '/school%20garden/');
  assert.equal(worker.headers.get('cache-control'), 'no-cache');
  const audioURL = origin + '/school%20garden/audio/sample.mp3';
  const audio = await fetch(audioURL, { headers: { Range: 'bytes=2-4' } });
  assert.equal(audio.status, 206); assert.equal(audio.headers.get('content-range'), 'bytes 2-4/8');
  assert.equal(audio.headers.get('content-type'), 'audio/mpeg');
  assert.deepEqual([...new Uint8Array(await audio.arrayBuffer())], [2, 3, 4]);
  const suffix = await fetch(audioURL, { headers: { Range: 'bytes=-2' } });
  assert.deepEqual([...new Uint8Array(await suffix.arrayBuffer())], [6, 7]);
  assert.equal((await fetch(audioURL, { headers: { Range: 'bytes=99-' } })).status, 416);
  const head = await fetch(audioURL, { method: 'HEAD' });
  assert.equal(head.headers.get('content-length'), '8'); assert.equal((await head.arrayBuffer()).byteLength, 0);
  const forbidden = await fetch(origin + '/school%20garden/%2e%2e%2fpackage.json');
  assert.equal(forbidden.status, 403);
  assert.equal((await fetch(audioURL, { method: 'POST' })).status, 405);
});

test('Pages base supports encoded names and rejects traversal and URL controls', () => {
  assert.equal(normalizePagesBase('/校園 遊戲/'), '/%E6%A0%A1%E5%9C%92%20%E9%81%8A%E6%88%B2/');
  assert.equal(normalizePagesBase('/repo'), '/repo/');
  assert.equal(normalizePagesBase('/'), '/');
  for (const input of ['/a/../', '/%2e%2e/', '/a%2fb/', '/a?b/', 'https://example.test/', '/a\\b/']) {
    assert.throws(() => normalizePagesBase(input), undefined, input);
  }
});
