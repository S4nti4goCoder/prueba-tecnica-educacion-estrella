import type { LambdaFunctionURLEvent } from 'aws-lambda';
import { SESSION_COOKIE_NAME } from '../lib/http';
import { type SessionClaims, verifySession } from '../lib/jwt';

function readCookie(event: LambdaFunctionURLEvent, name: string): string | null {
  const prefix = `${name}=`;
  const found = event.cookies?.find((c) => c.startsWith(prefix));
  return found ? decodeURIComponent(found.slice(prefix.length)) : null;
}

/**
 * El único sitio donde una petición se convierte en una identidad. Devuelve null si no
 * hay cookie o el token no es válido; cada handler decide que hacer con eso.
 */
export async function getSession(event: LambdaFunctionURLEvent): Promise<SessionClaims | null> {
  const token = readCookie(event, SESSION_COOKIE_NAME);
  return token ? verifySession(token) : null;
}
