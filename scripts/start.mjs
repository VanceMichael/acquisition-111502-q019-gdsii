import { resolve } from 'node:path';
import { createProvider } from '../provider/server.mjs';
import { createService } from '../src/service.mjs';

const sourcePort = Number(process.env.SOURCE_PORT || 4311);
const servicePort = Number(process.env.PORT || 4310);
const provider = createProvider({ stage: process.env.SOURCE_STAGE || 'complete' });
await new Promise(resolve => provider.server.listen(sourcePort, '0.0.0.0', resolve));
const service = await createService({ directory: resolve(process.env.ARCHIVE_DIR || '.local/archive'), allowedOrigin: `http://127.0.0.1:${sourcePort}` });
await new Promise(resolve => service.server.listen(servicePort, '0.0.0.0', resolve));
console.log(JSON.stringify({ service: `http://127.0.0.1:${servicePort}`, source: `http://127.0.0.1:${sourcePort}` }));
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => { service.server.closeAllConnections(); provider.server.closeAllConnections(); service.server.close(); provider.server.close(); });
}
