import { harness } from '../test/harness.mjs';
import descriptor from '../fixtures/descriptor.json' with { type: 'json' };

const context = await harness(process.env.SOURCE_STAGE || 'complete');
try {
  const result = await context.call('/acquisitions', { collectionId: 'demo', entry: context.source + descriptor.entry, options: descriptor.options || {} });
  console.log(JSON.stringify({ acquisition: result }, null, 2));
  const collection = await context.call('/collections/demo');
  console.log(JSON.stringify(collection.value, null, 2));
  for (const receiptId of collection.value.receiptIds) {
    console.log(JSON.stringify((await context.call('/receipts/' + receiptId)).value, null, 2));
  }
  console.log(JSON.stringify({ sourceRequests: context.provider.requests.map(({ method, path, query }) => ({ method, path, query })) }, null, 2));
  if (result.status >= 400) process.exitCode = 1;
} finally { await context.close(); }
