import { z } from 'zod';

export const MAX_VIDEO_BYTES = 200 * 1024 * 1024;

export const VIDEO_TYPES = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
} as const;

export type VideoContentType = keyof typeof VIDEO_TYPES;

export const presignSchema = z.object({
  contentType: z.enum(
    Object.keys(VIDEO_TYPES) as [VideoContentType, ...VideoContentType[]],
    'El video debe estar en formato MP4 o WebM.',
  ),

  // Lo declara el cliente para rechazar un archivo grande antes de empezar a subir.
  // El límite de verdad lo impone S3 con content-length-range.
  size: z
    .number('Indique el tamaño del archivo.')
    .int()
    .positive('El archivo está vacío.')
    .max(MAX_VIDEO_BYTES, 'El video no puede superar los 200 MB.'),
});

export type PresignInput = z.infer<typeof presignSchema>;
