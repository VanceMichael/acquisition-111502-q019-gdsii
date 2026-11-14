import test from 'node:test';
import assert from 'node:assert/strict';
import { harness } from './harness.mjs';
import descriptor from '../fixtures/descriptor.json' with { type: 'json' };

test('人工收件保留原始字节且同版本重收幂等', async () => {
  const context = await harness();
  try {
    const payload = { collectionId: 'manual', sourceKey: 'manual-1', revision: 'r1', mediaType: 'text/plain', contentBase64: Buffer.from('人工摘要').toString('base64') };
    const first = await context.call('/intakes', payload);
    assert.equal(first.status, 201);
    assert.deepEqual((await context.call('/intakes', payload)).value, first.value);
    const bytes = await fetch(context.base + '/receipts/' + first.value.receiptId + '/body').then(response => response.text());
    assert.equal(bytes, '人工摘要');
    assert.equal((await context.call('/intakes', { ...payload, contentBase64: Buffer.from('变更内容').toString('base64') })).status, 409);
  } finally { await context.close(); }
});

test('来源入口通过真实 HTTP 领取并留下字节摘要', async () => {
  const context = await harness();
  try {
    const result = await context.call('/acquisitions', { collectionId: 'raw', entry: context.source + descriptor.entry });
    assert.equal(result.status, 201);
    assert.ok(result.value.receiptIds.length > 0);
    const receipt = await context.call('/receipts/' + result.value.receiptIds[0]);
    assert.equal(receipt.value.sha256.length, 64);
    assert.ok(receipt.value.byteLength > 0);
    assert.ok(context.provider.requests.some(request => request.path === descriptor.entry));
  } finally { await context.close(); }
});

test('授权来源之外的地址不发送请求', async () => {
  const context = await harness();
  try {
    const result = await context.call('/acquisitions', { collectionId: 'scope', entry: 'http://outside.invalid/file' });
    assert.equal(result.status, 403);
    assert.equal(context.provider.requests.length, 0);
  } finally { await context.close(); }
});

test('人工结构化记录的出处跨重启仍可回查', async () => {
  const context = await harness();
  try {
    const receipt = await context.call('/intakes', { collectionId: 'notes', sourceKey: 'notes', revision: 'v1', contentBase64: 'eA==' });
    const record = { kind: 'manual-note', key: 'n1', value: { text: '人工确认' }, provenance: [{ receiptId: receipt.value.receiptId, location: 'byte:0' }] };
    assert.equal((await context.call('/collections/notes/records', record)).status, 201);
    await context.restart();
    assert.deepEqual((await context.call('/collections/notes')).value.records, [record]);
  } finally { await context.close(); }
});

test('拒绝将另一资料集的收件依据写到本资料集', async () => {
  const context = await harness();
  try {
    const receipt = await context.call('/intakes', { collectionId: 'left', sourceKey: 'left', revision: 'v1', contentBase64: 'eA==' });
    const record = { kind: 'manual-note', key: 'n1', value: { text: '不应跨接' }, provenance: [{ receiptId: receipt.value.receiptId, location: 'byte:0' }] };
    assert.equal((await context.call('/collections/right/records', record)).status, 400);
  } finally { await context.close(); }
});

test('本地来源的字节范围与完整文件一致', async () => {
  const context = await harness();
  try {
    const url = context.source + descriptor.primary;
    const complete = Buffer.from(await fetch(url).then(response => response.arrayBuffer()));
    const response = await fetch(url, { headers: { range: 'bytes=0-7' } });
    assert.equal(response.status, 206);
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.deepEqual(bytes, complete.subarray(0, 8));
    assert.ok(response.headers.get('content-range'));
  } finally { await context.close(); }
});
