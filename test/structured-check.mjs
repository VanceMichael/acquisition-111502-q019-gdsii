import assert from 'node:assert/strict';
import { harness } from './harness.mjs';
import descriptor from '../fixtures/descriptor.json' with { type: 'json' };
import expectations from '../fixtures/expected-observations.json' with { type: 'json' };

function contains(actual, expected) {
  if (expected === null || typeof expected !== 'object') return Object.is(actual, expected);
  if (Array.isArray(expected)) return Array.isArray(actual) && actual.length === expected.length && expected.every((value, index) => contains(actual[index], value));
  return actual && typeof actual === 'object' && Object.entries(expected).every(([key, value]) => contains(actual[key], value));
}

const context = await harness();
try {
  const acquired = await context.call('/acquisitions', { collectionId: 'structured', entry: context.source + descriptor.entry, options: descriptor.options || {} });
  assert.ok(acquired.status >= 200 && acquired.status < 300, '来源接收失败');
  const collection = (await context.call('/collections/structured')).value;
  for (const expected of expectations) {
    const record = collection.records.find(record => record.kind === expected.kind && contains(record.value, expected.value));
    assert.ok(record, '未找到所需资料观察: ' + JSON.stringify(expected));
    assert.ok(record.provenance?.length > 0, '观察缺少来源出处');
    for (const origin of record.provenance) {
      assert.ok(typeof origin.location === 'string' && origin.location.length > 0, '出处缺少原始位置');
      const receipt = await context.call('/receipts/' + origin.receiptId);
      assert.equal(receipt.status, 200, '出处未绑定真实收件');
      assert.equal(receipt.value.collectionId, 'structured');
    }
  }
  await context.restart();
  assert.deepEqual((await context.call('/collections/structured')).value.records, collection.records, '重启丢失资料解释');
  console.log(JSON.stringify({ state: 'structured-records-confirmed', observations: expectations.length, records: collection.records.length }));
} finally { await context.close(); }
