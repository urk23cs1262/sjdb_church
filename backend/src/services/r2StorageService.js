/**
 * Cloudflare R2 / S3-Compatible Object Storage Service
 * St. John de Britto Church
 *
 * Provides zero-egress, 10GB-free object storage for audio files (Rosary),
 * PDFs (Parish certificates), and images.
 */

const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');

let s3ClientInstance = null;

function isR2Configured() {
  return !!(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME
  );
}

function getR2Client() {
  if (!isR2Configured()) {
    return null;
  }
  if (!s3ClientInstance) {
    s3ClientInstance = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
      }
    });
  }
  return s3ClientInstance;
}

/**
 * Upload a buffer or stream to Cloudflare R2
 * @param {Buffer|ReadableStream} body - File content
 * @param {string} key - Object key (e.g., file ID or path)
 * @param {string} contentType - MIME type (e.g., 'audio/mpeg', 'application/pdf')
 * @param {Object} metadata - Optional key-value metadata
 */
async function uploadToR2(body, key, contentType = 'application/octet-stream', metadata = {}) {
  const client = getR2Client();
  if (!client) {
    throw new Error('Cloudflare R2 is not configured. Please check environment variables.');
  }

  const cleanKey = String(key).replace(/^\/+/, '');
  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: cleanKey,
    Body: body,
    ContentType: contentType,
    CacheControl: 'public, max-age=31536000, immutable',
    Metadata: metadata
  });

  const response = await client.send(command);

  let publicUrl = null;
  if (process.env.R2_PUBLIC_DOMAIN) {
    const base = process.env.R2_PUBLIC_DOMAIN.replace(/\/+$/, '');
    publicUrl = `${base}/${cleanKey}`;
  }

  return {
    success: true,
    key: cleanKey,
    publicUrl,
    url: `/api/files/${cleanKey}`,
    etag: response.ETag
  };
}

/**
 * Retrieve an object from Cloudflare R2 with optional HTTP Range support
 * @param {string} key - Object key
 * @param {string} range - Optional Range header e.g. "bytes=0-1048575"
 */
async function getR2Object(key, range = null) {
  const client = getR2Client();
  if (!client) {
    return null;
  }

  const cleanKey = String(key).replace(/^\/+/, '');
  const params = {
    Bucket: process.env.R2_BUCKET_NAME,
    Key: cleanKey
  };

  if (range) {
    params.Range = range;
  }

  try {
    const command = new GetObjectCommand(params);
    const response = await client.send(command);
    return {
      stream: response.Body,
      contentLength: response.ContentLength,
      contentType: response.ContentType,
      contentRange: response.ContentRange,
      acceptRanges: response.AcceptRanges || 'bytes',
      eTag: response.ETag,
      lastModified: response.LastModified,
      status: range && response.ContentRange ? 206 : 200
    };
  } catch (err) {
    if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) {
      return null;
    }
    throw err;
  }
}

/**
 * Check if an object exists in Cloudflare R2
 * @param {string} key - Object key
 */
async function headR2Object(key) {
  const client = getR2Client();
  if (!client) return null;

  try {
    const cleanKey = String(key).replace(/^\/+/, '');
    const command = new HeadObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: cleanKey
    });
    const res = await client.send(command);
    return {
      contentLength: res.ContentLength,
      contentType: res.ContentType,
      eTag: res.ETag,
      lastModified: res.LastModified
    };
  } catch (err) {
    return null;
  }
}

/**
 * Delete an object from Cloudflare R2
 * @param {string} key - Object key
 */
async function deleteFromR2(key) {
  const client = getR2Client();
  if (!client) return false;

  try {
    const cleanKey = String(key).replace(/^\/+/, '');
    const command = new DeleteObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: cleanKey
    });
    await client.send(command);
    return true;
  } catch (err) {
    console.error(`Failed to delete ${key} from R2:`, err.message);
    return false;
  }
}

module.exports = {
  isR2Configured,
  getR2Client,
  uploadToR2,
  getR2Object,
  headR2Object,
  deleteFromR2
};
