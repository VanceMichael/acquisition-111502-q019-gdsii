import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { harness } from './harness.mjs';
import routes from '../fixtures/routes.json' with { type: 'json' };
import { summarize } from '../src/summary.mjs';

test('来源每个正常交付地址与样本字节一致', async () => {
  const context = await harness();
  try {
    for (const [path, route] of Object.entries(routes)) {
      const response = await fetch(context.source + path, { redirect: 'manual' });
      assert.equal(response.status, route.redirect ? 302 : 200, path);
      if (!route.redirect && !route.echoQuery && !route.leaseJob) {
        const actual = Buffer.from(await response.arrayBuffer());
        const expected = await readFile(new URL('../fixtures/' + route.file, import.meta.url));
        assert.deepEqual(actual, expected, path);
        assert.ok(response.headers.get('etag'));
        assert.equal(typeof summarize(actual, route.mediaType || ''), 'object');
      } else await response.arrayBuffer();
    }
  } finally { await context.close(); }
});

test('来源不允许执行写操作', async () => {
  const context = await harness();
  try {
    const path = Object.keys(routes)[0];
    const response = await fetch(context.source + path, { method: 'POST' });
    assert.equal(response.status, 405);
  } finally { await context.close(); }
});

test('不完整来源保持其实际缺件或截断状态', async () => {
  const context = await harness('partial');
  try {
    for (const [path, route] of Object.entries(routes)) {
      if (route.availableAt) assert.equal((await fetch(context.source + path)).status, 404);
      else if (route.partialFile) {
        const actual = Buffer.from(await fetch(context.source + path).then(response => response.arrayBuffer()));
        const expected = await readFile(new URL('../fixtures/' + route.partialFile, import.meta.url));
        assert.deepEqual(actual, expected);
      }
    }
  } finally { await context.close(); }
});
