import { S3Client } from '@aws-sdk/client-s3';

export const s3 = new S3Client({});

export function videosBucket(): string {
  const value = process.env.VIDEOS_BUCKET;
  if (!value) {
    throw new Error('VIDEOS_BUCKET no está definida.');
  }
  return value;
}

/** Cada objeto vive bajo el prefijo de su dueño, así que la clave ya lleva la pertenencia. */
export const videoPrefix = (userId: string) => `users/${userId}/`;
