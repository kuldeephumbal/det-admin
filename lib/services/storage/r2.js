// Cloudflare R2 storage adapter (S3-compatible).
//
// Lazy-loads `@aws-sdk/client-s3` so a deployment without R2 creds
// doesn't have to install the SDK. Throws `STORAGE_NOT_CONFIGURED`
// (503) when missing — uploads should never silently succeed when
// the backend isn't wired.

const env = require('../../config/env');

let _client = null;
const _getClient = () => {
  if (_client) return _client;
  if (!isConfigured()) {
    const err = new Error('R2 storage not configured');
    err.statusCode = 503;
    err.code = 'STORAGE_NOT_CONFIGURED';
    throw err;
  }
  // eslint-disable-next-line global-require
  const { S3Client } = require('@aws-sdk/client-s3');
  _client = new S3Client({
    region: 'auto',
    endpoint: env.R2_ENDPOINT,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
  });
  return _client;
};

const isConfigured = () =>
  Boolean(env.R2_ENDPOINT && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_BUCKET_RECEIPTS);

const put = async ({ key, buffer, contentType, userId }) => {
  // eslint-disable-next-line global-require
  const { PutObjectCommand } = require('@aws-sdk/client-s3');
  const client = _getClient();
  const fullKey = `${userId}/${key}`;
  await client.send(
    new PutObjectCommand({
      Bucket: env.R2_BUCKET_RECEIPTS,
      Key: fullKey,
      Body: buffer,
      ContentType: contentType,
    })
  );
  // For R2, the URL is the signed-URL endpoint — minted on demand
  // via /api/v1/receipts/file/:id so the client always gets a fresh
  // one. Don't store the bucket-direct URL in DB.
  return {
    key: fullKey,
    url: `/api/v1/receipts/file/${fullKey.replace(/[/\\]/g, '_')}`,
  };
};

const get = async (key) => {
  // eslint-disable-next-line global-require
  const { GetObjectCommand } = require('@aws-sdk/client-s3');
  const client = _getClient();
  const out = await client.send(
    new GetObjectCommand({ Bucket: env.R2_BUCKET_RECEIPTS, Key: key })
  );
  const chunks = [];
  for await (const c of out.Body) chunks.push(c);
  return { buffer: Buffer.concat(chunks), contentType: out.ContentType };
};

const del = async (key) => {
  // eslint-disable-next-line global-require
  const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
  const client = _getClient();
  await client.send(new DeleteObjectCommand({ Bucket: env.R2_BUCKET_RECEIPTS, Key: key }));
};

module.exports = { isConfigured, put, get, delete: del };
