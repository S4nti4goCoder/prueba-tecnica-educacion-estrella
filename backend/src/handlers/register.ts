import type { LambdaFunctionURLEvent } from 'aws-lambda';
import {
  type HttpResponse,
  badRequest,
  clientIp,
  conflict,
  created,
  fieldErrors,
  parseJsonBody,
  sessionCookie,
  tooManyRequests,
} from '../lib/http';
import { signSession } from '../lib/jwt';
import { hashPassword } from '../lib/password';
import { REGISTER_LIMIT, countAttempt, isBlocked } from '../lib/rateLimit';
import { EmailAlreadyRegisteredError, create } from '../repositories/users';
import { registerSchema } from '../schemas/auth';

export async function register(event: LambdaFunctionURLEvent): Promise<HttpResponse> {
  const ip = clientIp(event);

  const blocked = await isBlocked(ip, REGISTER_LIMIT);
  if (blocked) {
    return tooManyRequests(blocked.retryAfterSeconds);
  }

  const parsed = registerSchema.safeParse(parseJsonBody(event));

  if (!parsed.success) {
    return badRequest(
      'VALIDATION_ERROR',
      'Revise los datos del formulario.',
      fieldErrors(parsed.error),
    );
  }

  const { email, password } = parsed.data;

  // Se cuenta antes de crear: reintentar con un correo ya registrado también es abuso.
  await countAttempt(ip, REGISTER_LIMIT);

  let user;
  try {
    user = await create(email, await hashPassword(password));
  } catch (err) {
    if (err instanceof EmailAlreadyRegisteredError) {
      return conflict('EMAIL_ALREADY_REGISTERED', err.message);
    }
    throw err;
  }

  const token = await signSession({ userId: user.userId, email: user.email });

  // El hash nunca sale de la capa de repositorio.
  return created({ userId: user.userId, email: user.email }, [sessionCookie(token)]);
}
