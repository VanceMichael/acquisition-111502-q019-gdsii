export async function retrieve(entry, allowedOrigin, maximumBytes = 16 * 1024 * 1024) {
  const url = new URL(entry);
  if (url.origin !== allowedOrigin || url.username || url.password) {
    throw Object.assign(new Error('source_not_allowed'), { status: 403 });
  }
  const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw Object.assign(new Error('source_response_' + response.status), { status: 502 });
  let length = 0;
  const chunks = [];
  for await (const chunk of response.body) {
    length += chunk.length;
    if (length > maximumBytes) throw Object.assign(new Error('source_too_large'), { status: 413 });
    chunks.push(chunk);
  }
  return { bytes: Buffer.concat(chunks), mediaType: response.headers.get('content-type') || 'application/octet-stream',
    revision: response.headers.get('etag') || 'unversioned', headers: Object.fromEntries(response.headers) };
}
