import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createProvider } from '../provider/server.mjs';
import { createService } from '../src/service.mjs';

async function listen(server) {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return `http://127.0.0.1:${server.address().port}`;
}

export async function harness(stage = 'complete') {
  const directory = await mkdtemp(join(tmpdir(), 'collection-'));
  const provider = createProvider({ stage });
  const source = await listen(provider.server);
  let service = await createService({ directory, allowedOrigin: source });
  let base = await listen(service.server);
  return {
    source, directory, provider,
    get base() { return base; },
    async call(path, body) {
      const response = await fetch(base + path, body === undefined ? undefined : {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body)
      });
      return { status: response.status, value: await response.json() };
    },
    async restart() {
      service.server.closeAllConnections();
      await new Promise(resolve => service.server.close(resolve));
      service = await createService({ directory, allowedOrigin: source });
      base = await listen(service.server);
    },
    async close() {
      service.server.closeAllConnections(); provider.server.closeAllConnections();
      await Promise.all([new Promise(resolve => service.server.close(resolve)), new Promise(resolve => provider.server.close(resolve))]);
      await rm(directory, { recursive: true, force: true });
    }
  };
}
