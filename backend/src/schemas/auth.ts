import { z } from 'zod';

export const PASSWORD_MIN_LENGTH = 8;

/** bcrypt solo procesa los primeros 72 bytes y descarta el resto en silencio. */
export const PASSWORD_MAX_LENGTH = 72;

const EMAIL_MAX_LENGTH = 254;

/** Se normaliza antes de validar: el correo es la clave de partición, y dos grafías serían dos cuentas. */
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

/**
 * El login no reutiliza `passwordSchema` a propósito: aplicar la política aquí la
 * filtraría, y daria un error distinto para "muy corta" que para "contraseña incorrecta".
 */
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Introduzca su contraseña.'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
