import { randomUUID } from 'node:crypto';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import type { LambdaFunctionURLEvent } from 'aws-lambda';
import {
  type HttpResponse,
  badRequest,
  fieldErrors,
  ok,
  parseJsonBody,
  unauthorized,
} from '../lib/http';
import { s3, videoPrefix, videosBucket } from '../lib/s3';
import { getSession } from '../middleware/auth';
import { MAX_VIDEO_BYTES, VIDEO_TYPES, presignSchema } from '../schemas/upload';

/** Suficiente para empezar una subida de 200 MB, poco para servir de algo si se filtra. */
const EXPIRES_SECONDS = 300;

export async function presignUpload(event: LambdaFunctionURLEvent): Promise<HttpResponse> {
  const session = await getSession(event);
  if (!session) {
    return unauthorized();
  }

  const parsed = presignSchema.safeParse(parseJsonBody(event));
  if (!parsed.success) {
    return badRequest('INVALID_FILE', 'El archivo no es válido.', fieldErrors(parsed.error));
  }

  const { contentType } = parsed.data;

  // La clave la decide el servidor. Si la eligiera el cliente, podría escribir en el
  // prefijo de otro usuario o sobrescribir un video existente.
  const key = `${videoPrefix(session.userId)}${randomUUID()}.${VIDEO_TYPES[contentType]}`;

  const { url, fields } = await createPresignedPost(s3, {
    Bucket: videosBucket(),
    Key: key,
    Conditions: [
      // Esto lo hace cumplir S3. Un presigned PUT no podría ni expresar el límite de tamaño.
      ['content-length-range', 1, MAX_VIDEO_BYTES],
      ['eq', '$Content-Type', contentType],
    ],
    Fields: { 'Content-Type': contentType },
    Expires: EXPIRES_SECONDS,
  });

  return ok({ url, fields, key });
}
