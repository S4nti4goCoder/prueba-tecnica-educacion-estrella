import { GetObjectCommand, HeadObjectCommand, NotFound } from '@aws-sdk/client-s3';
import { MAX_VIDEO_BYTES } from '../schemas/upload';
import { s3, videoPrefix, videosBucket } from './s3';

export type VerificationFailure =
  | 'NOT_OWNED'
  | 'NOT_FOUND'
  | 'EMPTY'
  | 'TOO_LARGE'
  | 'NOT_A_VIDEO';

export type Verification =
  | { ok: true; size: number }
  | { ok: false; reason: VerificationFailure };

/** Primeros bytes que identifican cada contenedor. */
const FTYP = [0x66, 0x74, 0x79, 0x70]; // "ftyp" en la posición 4: MP4 / ISO-BMFF
const EBML = [0x1a, 0x45, 0xdf, 0xa3]; // posición 0: WebM / Matroska

const matches = (bytes: Uint8Array, signature: number[], offset: number) =>
  signature.every((byte, i) => bytes[offset + i] === byte);

/** Cierto cuando los primeros bytes corresponden a un contenedor MP4 o WebM. */
export const isVideoContainer = (bytes: Uint8Array): boolean =>
  matches(bytes, EBML, 0) || matches(bytes, FTYP, 4);

/**
 * Confirma un objeto subido antes de registrarlo como una solicitud real.
 *
 * El Content-Type que devuelve HeadObject es el que declaro el cliente al subir,
 * así que no prueba nada. Leer los primeros bytes es lo único que demuestra
 * si el archivo es de verdad un contenedor de video.
 */
export async function verifyUploadedVideo(userId: string, key: string): Promise<Verification> {
  // La comprobación mas barata primero, y la que mas importa: la clave debe pertenecer
  // a quien llama, o alguien podría reclamar como suya la subida de otro.
  if (!key.startsWith(videoPrefix(userId))) {
    return { ok: false, reason: 'NOT_OWNED' };
  }

  const Bucket = videosBucket();
  let size: number;

  try {
    const head = await s3.send(new HeadObjectCommand({ Bucket, Key: key }));
    size = head.ContentLength ?? 0;
  } catch (err) {
    if (err instanceof NotFound) {
      return { ok: false, reason: 'NOT_FOUND' };
    }
    throw err;
  }

  if (size === 0) return { ok: false, reason: 'EMPTY' };
  if (size > MAX_VIDEO_BYTES) return { ok: false, reason: 'TOO_LARGE' };

  // 16 bytes bastan para distinguir el contenedor, y descargarlos no cuesta nada.
  const head = await s3.send(
    new GetObjectCommand({ Bucket, Key: key, Range: 'bytes=0-15' }),
  );
  const bytes = await head.Body!.transformToByteArray();

  if (!isVideoContainer(bytes)) {
    return { ok: false, reason: 'NOT_A_VIDEO' };
  }

  return { ok: true, size };
}

export const VERIFICATION_MESSAGES: Record<VerificationFailure, string> = {
  NOT_OWNED: 'El video indicado no pertenece a su cuenta.',
  NOT_FOUND: 'No se encontró el video. Vuelva a subirlo.',
  EMPTY: 'El archivo subido está vacío.',
  TOO_LARGE: 'El video supera los 200 MB permitidos.',
  NOT_A_VIDEO: 'El archivo no es un video MP4 o WebM válido.',
};
