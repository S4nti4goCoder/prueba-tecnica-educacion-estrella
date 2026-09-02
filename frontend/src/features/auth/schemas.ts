import { z } from 'zod';
import { isCommonPassword } from './commonPasswords';

/**
 * Copia de cliente de las reglas de servidor de backend/src/schemas/auth.ts.
 *
 * Duplicada a propósito: compartir un modulo habría exigido npm workspaces para tres
 * archivos de esquemas, lo que no compensaba a este tamaño. Ver el README.
 * Estos dos archivos hay que cambiarlos a la vez.
 */

/** PCI DSS 4.0, requisito 8.3.6, para sistemas que manejan datos financieros. */
export const PASSWORD_MIN_LENGTH = 12;

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

export interface PasswordRule {
  label: string;
  error: string;
  test: (value: string) => boolean;
}

/** El formulario pinta estas mismas reglas mientras se escribe. */
export const PASSWORD_RULES: PasswordRule[] = [
  {
    label: `Al menos ${PASSWORD_MIN_LENGTH} caracteres`,
    error: `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`,
    test: (value) => value.length >= PASSWORD_MIN_LENGTH,
  },
  {
    label: 'Una letra minúscula',
    error: 'La contraseña debe incluir una letra minúscula.',
    test: (value) => /[a-z]/.test(value),
  },
  {
    label: 'Una letra mayúscula',
    error: 'La contraseña debe incluir una letra mayúscula.',
    test: (value) => /[A-Z]/.test(value),
  },
  {
    label: 'Un número',
    error: 'La contraseña debe incluir un número.',
    test: (value) => /[0-9]/.test(value),
  },
  {
    label: 'Un carácter especial',
    error: 'La contraseña debe incluir un carácter especial.',
    test: (value) => /[^A-Za-z0-9]/.test(value),
  },
];

/** Se avisa cuando se tropieza con ella, no antes. Ver backend/src/schemas/auth.ts. */
export const COMMON_PASSWORD_ERROR = 'Esta contraseña es demasiado habitual. Elija otra.';

export const passwordSchema = z.string().superRefine((value, ctx) => {
  if (value.length > PASSWORD_MAX_LENGTH) {
    ctx.addIssue({
      code: 'custom',
      message: `La contraseña no puede superar los ${PASSWORD_MAX_LENGTH} caracteres.`,
    });
    return;
  }

  const failed = PASSWORD_RULES.find((rule) => !rule.test(value));
  if (failed) {
    ctx.addIssue({ code: 'custom', message: failed.error });
    return;
  }

  if (isCommonPassword(value)) {
    ctx.addIssue({ code: 'custom', message: COMMON_PASSWORD_ERROR });
  }
});

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
