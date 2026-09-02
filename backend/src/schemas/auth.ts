import { z } from 'zod';
import { isCommonPassword } from './commonPasswords';

/** PCI DSS 4.0, requisito 8.3.6, para sistemas que manejan datos financieros. */
export const PASSWORD_MIN_LENGTH = 12;

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

export interface PasswordRule {
  label: string;
  error: string;
  test: (value: string) => boolean;
}

/**
 * Fuente única de la política. El formulario pinta estas mismas reglas mientras se
 * escribe, así que lo que el usuario ve marcado es literalmente lo que valida el servidor.
 */
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

/**
 * Fuera de PASSWORD_RULES a propósito. Las otras reglas son requisitos que se van
 * cumpliendo, y tiene sentido listarlas. Esta es una trampa: mostrarla sin marcar solo
 * hace preguntarse como se cumple. Se avisa cuando se tropieza con ella, no antes.
 */
export const COMMON_PASSWORD_ERROR = 'Esta contraseña es demasiado habitual. Elija otra.';

export const passwordSchema = z.string().superRefine((value, ctx) => {
  if (value.length > PASSWORD_MAX_LENGTH) {
    ctx.addIssue({
      code: 'custom',
      message: `La contraseña no puede superar los ${PASSWORD_MAX_LENGTH} caracteres.`,
    });
    return;
  }

  // Solo el primer incumplimiento: enumerarlos todos de golpe abruma más que ayuda.
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
