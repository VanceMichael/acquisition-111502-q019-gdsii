import assert from 'node:assert/strict';
import { harness } from './harness.mjs';
import descriptor from '../fixtures/descriptor.json' with { type: 'json' };

const context = await harness('partial');
try {
  const result = await context.call('/acquisitions', { collectionId: 'partial', entry: context.source + descriptor.entry, options: descriptor.options || {} });
  assert.ok(result.status < 500, '不能把不完整来源变成内部崩溃');
  const collection = (await context.call('/collections/partial')).value;
  assert.ok(collection.issues.length > 0, '未说明来源缺件、截断或解释限制');
  assert.ok(collection.receiptIds.length > 0, '丢失已领取的原文依据');
  for (const issue of collection.issues) assert.ok(issue.reason && issue.location, '问题记录缺少原因或范围');
  console.log(JSON.stringify({ state: 'partial-source-explained', issues: collection.issues.length }));
} finally { await context.close(); }
