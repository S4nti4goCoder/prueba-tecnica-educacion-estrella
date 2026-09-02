import type { LambdaFunctionURLEvent } from 'aws-lambda';
import {
  type HttpResponse,
  badRequest,
  fieldErrors,
  ok,
  parseJsonBody,
  sessionCookie,
  tooManyRequests,
  unauthorized,
} from '../lib/http';
import { signSession } from '../lib/jwt';
import { verifyPassword } from '../lib/password';
import { LOGIN_LIMIT, countAttempt, isBlocked } from '../lib/rateLimit';
import { findByEmail } from '../repositories/users';
import { loginSchema } from '../schemas/auth';

/**
 * Hash de un valor aleatorio que nadie conoce. Se compara contra el cuando el correo no
 * existe, para que una cuenta inexistente tarde lo mismo que una contraseña incorrecta
 * y no se puedan enumerar los correos registrados cronometrando la respuesta.
 */
const DECOY_HASH = '$2b$10$SwhM7G5CVqls6HnB14iP5OnKmkbbcYbnZj3aWgt2WoMf5hnK6E1b6';

const INVALID_CREDENTIALS = 'Correo electrónico o contraseña incorrectos.';

export async function login(event: LambdaFunctionURLEvent): Promise<HttpResponse> {
  const parsed = loginSchema.safeParse(parseJsonBody(event));

  if (!parsed.success) {
    return badRequest(
      'VALIDATION_ERROR',
      'Revise los datos del formulario.',
      fieldErrors(parsed.error),
    );
  }

  // Ya normalizado por el esquema: sin esto, cambiar mayúsculas reiniciaría el contador.
  const { email, password } = parsed.data;

  // Antes de buscar al usuario: un ataque por fuerza bruta no debe llegar ni a bcrypt.
  const blocked = await isBlocked(email, LOGIN_LIMIT);
  if (blocked) {
    return tooManyRequests(blocked.retryAfterSeconds);
  }

  const user = await findByEmail(email);
  const matches = await verifyPassword(password, user?.passwordHash ?? DECOY_HASH);

  // Un solo mensaje para los dos fallos: nadie puede saber si el correo existe.
  if (!user || !matches) {
    // Se cuenta exista o no la cuenta, o un 429 revelaría cuáles están registradas.
    await countAttempt(email, LOGIN_LIMIT);
    return unauthorized(INVALID_CREDENTIALS);
  }

  const token = await signSession({ userId: user.userId, email: user.email });

  return ok({ userId: user.userId, email: user.email }, [sessionCookie(token)]);
}
