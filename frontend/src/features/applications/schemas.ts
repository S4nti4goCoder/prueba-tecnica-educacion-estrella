import { z } from 'zod';

/**
 * Copia de cliente de las reglas de servidor de backend/src/schemas/. Duplicada a
 * propósito; ver el README. Hay que cambiar los dos archivos a la vez.
 */

export const MIN_AMOUNT = 500_000;
export const MAX_AMOUNT = 100_000_000;

export const MAX_VIDEO_BYTES = 200 * 1024 * 1024;

export const VIDEO_TYPES = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
} as const;

export type VideoContentType = keyof typeof VIDEO_TYPES;

export const isAllowedVideoType = (type: string): type is VideoContentType =>
  type in VIDEO_TYPES;

const text = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .min(min, `${label} debe tener al menos ${min} caracteres.`)
    .max(max, `${label} no puede superar los ${max} caracteres.`);

export const applicationFormSchema = z.object({
  fullName: text(3, 120, 'El nombre completo'),

  idDocument: z
    .string()
    .trim()
    .min(5, 'El documento debe tener al menos 5 caracteres.')
    .max(20, 'El documento no puede superar los 20 caracteres.')
    .regex(/^[A-Za-z0-9.-]+$/, 'El documento solo admite letras, números, puntos y guiones.'),

  institution: text(3, 120, 'La institución educativa'),
  program: text(3, 120, 'El programa académico'),

  amount: z
    .number('Introduzca un monto válido.')
    .int('El monto debe ser un número entero de pesos.')
    .min(MIN_AMOUNT, `El monto mínimo es de ${MIN_AMOUNT.toLocaleString('es-CO')} pesos.`)
    .max(MAX_AMOUNT, `El monto máximo es de ${MAX_AMOUNT.toLocaleString('es-CO')} pesos.`),
});

export type ApplicationFormInput = z.infer<typeof applicationFormSchema>;
