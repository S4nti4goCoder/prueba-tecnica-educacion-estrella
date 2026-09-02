import { z } from 'zod';

/** Pesos colombianos, como enteros. El dinero nunca es coma flotante. */
export const MIN_AMOUNT = 500_000;
export const MAX_AMOUNT = 100_000_000;

const text = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .min(min, `${label} debe tener al menos ${min} caracteres.`)
    .max(max, `${label} no puede superar los ${max} caracteres.`);

export const applicationSchema = z.object({
  fullName: text(3, 120, 'El nombre completo'),

  // Laxo a propósito: admite cedula o pasaporte. Los datos son ficticios.
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

  // Lo devuelve el endpoint de presign. Se verifica contra S3 antes de escribir el registro.
  videoKey: z.string().min(1, 'Debe adjuntar el video de la entrevista.'),
});

export type ApplicationInput = z.infer<typeof applicationSchema>;
