import { Client } from 'minio';

const minioClient = new Client({
  endPoint: process.env.MINIO_ENDPOINT || 'localhost',
  port: parseInt(process.env.MINIO_PORT || '9000'),
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
});

const BUCKET = process.env.MINIO_BUCKET || 'speakup-audio';

export async function ensureBucket(): Promise<void> {
  const exists = await minioClient.bucketExists(BUCKET);
  if (!exists) {
    await minioClient.makeBucket(BUCKET);
  }
}

export async function uploadAudio(
  fileName: string,
  buffer: Buffer,
  contentType: string,
): Promise<string> {
  await minioClient.putObject(BUCKET, fileName, buffer, buffer.length, {
    'Content-Type': contentType,
  });
  return getAudioUrl(fileName);
}

export function getAudioUrl(fileName: string): string {
  const protocol = process.env.MINIO_USE_SSL === 'true' ? 'https' : 'http';
  const endpoint = process.env.MINIO_ENDPOINT || 'localhost';
  const port = process.env.MINIO_PORT || '9000';
  return `${protocol}://${endpoint}:${port}/${BUCKET}/${fileName}`;
}

export async function getPresignedUrl(
  fileName: string,
  expirySeconds = 3600,
): Promise<string> {
  return minioClient.presignedGetObject(BUCKET, fileName, expirySeconds);
}

export async function deleteAudio(fileName: string): Promise<void> {
  await minioClient.removeObject(BUCKET, fileName);
}

export async function getAudioBuffer(fileName: string): Promise<Buffer> {
  const stream = await minioClient.getObject(BUCKET, fileName);
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export { BUCKET, minioClient };

