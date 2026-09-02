import { z } from 'zod';

/**
 * Copia de cliente de las reglas de servidor de backend/src/schemas/auth.ts.
 *
 * Duplicada a propósito: compartir un modulo habría exigido npm workspaces para tres
 * archivos de esquemas, lo que no compensaba a este tamaño. Ver el README.
 * Estos dos archivos hay que cambiarlos a la vez.
 */

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72;

const EMAIL_MAX_LENGTH = 254;

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(
    z
      .email('Introduzca un correo electrónico válido.')
      .max(EMAIL_MAX_LENGTH, 'El correo electrónico es demasiado largo.'),
  );

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`)
  .max(PASSWORD_MAX_LENGTH, `La contraseña no puede superar los ${PASSWORD_MAX_LENGTH} caracteres.`);

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Introduzca su contraseña.'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
