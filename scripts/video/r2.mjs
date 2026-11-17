// Upload to Cloudflare R2 (or any S3-compatible storage) with AWS Signature V4, using only Node built-ins.
import { createHash, createHmac } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import https from 'node:https';

const hmac = (key, data) => createHmac('sha256', key).update(data).digest();
const hex = (data) => createHash('sha256').update(data).digest('hex');
const encodePath = (p) => p.split('/').map((s) => encodeURIComponent(s)).join('/');

/** Headers (including Authorization) for one request. Exported so it can be checked against AWS's test values. */
export function signRequest({ method, host, path, headers = {}, region, service = 's3', accessKey, secretKey, date = new Date(), payloadHash = 'UNSIGNED-PAYLOAD' }) {
  const amzDate = date.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const day = amzDate.slice(0, 8);
  const all = { ...headers, host, 'x-amz-date': amzDate, ...(service === 's3' ? { 'x-amz-content-sha256': payloadHash } : {}) };
  const names = Object.keys(all).map((k) => k.toLowerCase()).sort();
  const lower = Object.fromEntries(Object.entries(all).map(([k, v]) => [k.toLowerCase(), String(v).trim()]));
  const canonical = [method, encodePath(path), '', names.map((n) => `${n}:${lower[n]}\n`).join(''), names.join(';'), payloadHash].join('\n');
  const scope = `${day}/${region}/${service}/aws4_request`;
  const toSign = ['AWS4-HMAC-SHA256', amzDate, scope, hex(canonical)].join('\n');
  const key = hmac(hmac(hmac(hmac(`AWS4${secretKey}`, day), region), service), 'aws4_request');
  const signature = createHmac('sha256', key).update(toSign).digest('hex');
  return { ...all, Authorization: `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${names.join(';')}, Signature=${signature}` };
}

export function r2FromEnv(env = process.env) {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, VIDEO_PUBLIC_URL } = env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET || !VIDEO_PUBLIC_URL) return null;
  return {
    host: `${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    bucket: R2_BUCKET,
    accessKey: R2_ACCESS_KEY_ID,
    secretKey: R2_SECRET_ACCESS_KEY,
    publicUrl: VIDEO_PUBLIC_URL.replace(/\/+$/, ''),
  };
}

/** PUT a local file at `key`. Streams it, so large videos don't have to fit in memory. */
export async function upload(r2, file, key, contentType) {
  const size = (await stat(file)).size;
  const path = `/${r2.bucket}/${key}`;
  const headers = signRequest({
    method: 'PUT',
    host: r2.host,
    path,
    region: 'auto',
    accessKey: r2.accessKey,
    secretKey: r2.secretKey,
    headers: { 'content-type': contentType, 'content-length': size, 'cache-control': 'public, max-age=604800' },
  });
  await new Promise((resolve, reject) => {
    const req = https.request({ method: 'PUT', host: r2.host, path: encodePath(path), headers }, (res) => {
      let body = '';
      res.on('data', (d) => (body += d));
      res.on('end', () => (res.statusCode >= 200 && res.statusCode < 300 ? resolve() : reject(new Error(`Upload failed (${res.statusCode}): ${body.slice(0, 300)}`))));
    });
    req.on('error', reject);
    createReadStream(file).pipe(req);
  });
  return `${r2.publicUrl}/${key}`;
}
