import { type HttpResponse, clearSessionCookie, ok } from '../lib/http';

/**
 * Borra la cookie del navegador. El token en si sigue siendo válido hasta que
 * caduca: un JWT no se puede revocar en el servidor sin una lista de denegación.
 */
export function logout(): HttpResponse {
  return ok({ ok: true }, [clearSessionCookie()]);
}
