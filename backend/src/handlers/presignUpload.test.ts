import type { LambdaFunctionURLEvent } from 'aws-lambda';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_VIDEO_BYTES } from '../schemas/upload';

/**
 * El presigned POST es lo único que hay entre el navegador y el bucket. Estas pruebas
 * fijan las tres condiciones que lo hacen seguro: el límite de tamaño, el tipo de
 * contenido, y una clave que el usuario no puede elegir.
 */

const createPresignedPost = vi.fn();
const getSession = vi.fn();

vi.mock('@aws-sdk/s3-presigned-post', () => ({
  createPresignedPost: (...args: unknown[]) => createPresignedPost(...args),
}));
vi.mock('../middleware/auth', () => ({
  getSession: (...args: unknown[]) => getSession(...args),
}));

const { presignUpload } = await import('./presignUpload');

const USER_ID = '11111111-2222-3333-4444-555555555555';

interface PresignOptions {
  Conditions: unknown[];
  Fields: Record<string, string>;
  Expires: number;
}

/** Lee las opciones que el handler paso a createPresignedPost. */
function presignOptions(): PresignOptions {
  const [call] = createPresignedPost.mock.calls;
  if (!call) throw new Error('createPresignedPost no llegó a llamarse.');
  return call[1] as PresignOptions;
}

const event = (body: unknown) =>
  ({
    rawPath: '/uploads/presign',
    body: JSON.stringify(body),
    requestContext: { requestId: 'test', http: { method: 'POST' } },
  }) as unknown as LambdaFunctionURLEvent;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.VIDEOS_BUCKET = 'bucket-de-prueba';
  getSession.mockResolvedValue({ userId: USER_ID, email: 'ana@ejemplo.com' });
  createPresignedPost.mockResolvedValue({ url: 'https://s3.example', fields: {} });
});

describe('presignUpload', () => {
  it('exige sesión', async () => {
    getSession.mockResolvedValue(null);
    const response = await presignUpload(event({ contentType: 'video/mp4', size: 1000 }));

    expect(response.statusCode).toBe(401);
    expect(createPresignedPost).not.toHaveBeenCalled();
  });

  it('rechaza un tipo que no sea MP4 o WebM', async () => {
    const response = await presignUpload(event({ contentType: 'application/pdf', size: 1000 }));

    expect(response.statusCode).toBe(400);
    expect(createPresignedPost).not.toHaveBeenCalled();
  });

  it('rechaza un tamaño mayor que el límite antes de firmar nada', async () => {
    const response = await presignUpload(
      event({ contentType: 'video/mp4', size: MAX_VIDEO_BYTES + 1 }),
    );

    expect(response.statusCode).toBe(400);
    expect(createPresignedPost).not.toHaveBeenCalled();
  });

  it('genera la clave bajo el prefijo del usuario de la sesión', async () => {
    const response = await presignUpload(event({ contentType: 'video/mp4', size: 1000 }));
    const { key } = JSON.parse(response.body!);

    expect(response.statusCode).toBe(200);
    expect(key.startsWith(`users/${USER_ID}/`)).toBe(true);
    expect(key.endsWith('.mp4')).toBe(true);
  });

  it('impone el límite de tamaño en la política del POST', async () => {
    await presignUpload(event({ contentType: 'video/mp4', size: 1000 }));

    expect(presignOptions().Conditions).toContainEqual([
      'content-length-range',
      1,
      MAX_VIDEO_BYTES,
    ]);
  });

  it('fija el Content-Type en la política del POST', async () => {
    await presignUpload(event({ contentType: 'video/webm', size: 1000 }));

    const { Conditions, Fields } = presignOptions();
    expect(Conditions).toContainEqual(['eq', '$Content-Type', 'video/webm']);
    expect(Fields['Content-Type']).toBe('video/webm');
  });

  // El cliente no envia clave, así que no puede apuntar la subida a otro usuario.
  it('ignora una clave enviada por el cliente', async () => {
    const response = await presignUpload(
      event({ contentType: 'video/mp4', size: 1000, key: 'users/otro/robado.mp4' }),
    );
    const { key } = JSON.parse(response.body!);

    expect(key).not.toBe('users/otro/robado.mp4');
    expect(key.startsWith(`users/${USER_ID}/`)).toBe(true);
  });

  it('caduca la firma en cinco minutos', async () => {
    await presignUpload(event({ contentType: 'video/mp4', size: 1000 }));

    expect(presignOptions().Expires).toBe(300);
  });
});
