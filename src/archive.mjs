import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, rename, readdir } from 'node:fs/promises';
import { join } from 'node:path';

export function digest(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

export function identifier(value) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_.-]{1,100}$/.test(value)) {
    throw Object.assign(new Error('invalid_identifier'), { status: 400 });
  }
  return value;
}

export class Archive {
  constructor(directory) {
    this.directory = directory;
    this.pending = Promise.resolve();
  }

  async initialize() {
    for (const name of ['blobs', 'receipts', 'collections']) {
      await mkdir(join(this.directory, name), { recursive: true });
    }
  }

  async serialized(operation) {
    const result = this.pending.then(operation);
    this.pending = result.catch(() => {});
    return result;
  }

  async saveJson(path, value) {
    const temporary = path + '.pending';
    await writeFile(temporary, JSON.stringify(value, null, 2));
    await rename(temporary, path);
  }

  async collection(collectionId) {
    identifier(collectionId);
    try {
      return JSON.parse(await readFile(join(this.directory, 'collections', collectionId + '.json'), 'utf8'));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      return { collectionId, receiptIds: [], records: [], issues: [] };
    }
  }

  async receive({ collectionId, sourceKey, revision, mediaType, bytes, summary }) {
    identifier(collectionId);
    if (typeof sourceKey !== 'string' || !sourceKey || typeof revision !== 'string' || !revision) {
      throw Object.assign(new Error('missing_source_identity'), { status: 400 });
    }
    const sha256 = digest(bytes);
    const receiptId = digest(Buffer.from(JSON.stringify([collectionId, sourceKey, revision])));
    return this.serialized(async () => {
      const path = join(this.directory, 'receipts', receiptId + '.json');
      try {
        const existing = JSON.parse(await readFile(path, 'utf8'));
        if (existing.sha256 !== sha256) throw Object.assign(new Error('revision_content_conflict'), { status: 409 });
        const collection = await this.collection(collectionId);
        if (!collection.receiptIds.includes(receiptId)) {
          collection.receiptIds.push(receiptId);
          await this.saveJson(join(this.directory, 'collections', collectionId + '.json'), collection);
        }
        return existing;
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
      await writeFile(join(this.directory, 'blobs', sha256), bytes, { flag: 'wx' }).catch(error => {
        if (error.code !== 'EEXIST') throw error;
      });
      const receipt = { receiptId, collectionId, sourceKey, revision, mediaType, sha256, byteLength: bytes.length, summary };
      await this.saveJson(path, receipt);
      const collection = await this.collection(collectionId);
      collection.receiptIds.push(receiptId);
      await this.saveJson(join(this.directory, 'collections', collectionId + '.json'), collection);
      return receipt;
    });
  }

  async receipt(receiptId) {
    if (!/^[a-f0-9]{64}$/.test(receiptId)) throw Object.assign(new Error('invalid_receipt'), { status: 400 });
    try {
      return JSON.parse(await readFile(join(this.directory, 'receipts', receiptId + '.json'), 'utf8'));
    } catch (error) {
      if (error.code === 'ENOENT') throw Object.assign(new Error('receipt_not_found'), { status: 404 });
      throw error;
    }
  }

  async body(receiptId) {
    const receipt = await this.receipt(receiptId);
    return readFile(join(this.directory, 'blobs', receipt.sha256));
  }

  async addRecord(collectionId, record) {
    identifier(collectionId);
    if (!record || typeof record.kind !== 'string' || typeof record.key !== 'string' || !record.value || typeof record.value !== 'object') {
      throw Object.assign(new Error('invalid_record'), { status: 400 });
    }
    if (!Array.isArray(record.provenance) || record.provenance.length === 0) {
      throw Object.assign(new Error('missing_provenance'), { status: 400 });
    }
    for (const origin of record.provenance) {
      const receipt = await this.receipt(origin.receiptId);
      if (receipt.collectionId !== collectionId || typeof origin.location !== 'string' || !origin.location) {
        throw Object.assign(new Error('provenance_scope'), { status: 400 });
      }
    }
    return this.serialized(async () => {
      const collection = await this.collection(collectionId);
      const match = collection.records.find(existing => existing.kind === record.kind && existing.key === record.key);
      if (match && JSON.stringify(match) !== JSON.stringify(record)) {
        throw Object.assign(new Error('record_identity_conflict'), { status: 409 });
      }
      if (!match) collection.records.push(record);
      await this.saveJson(join(this.directory, 'collections', collectionId + '.json'), collection);
      return record;
    });
  }

  async list() {
    return (await readdir(join(this.directory, 'collections'))).filter(name => name.endsWith('.json')).map(name => name.slice(0, -5));
  }
}
