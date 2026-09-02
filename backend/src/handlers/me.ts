import type { LambdaFunctionURLEvent } from 'aws-lambda';
import { type HttpResponse, ok, unauthorized } from '../lib/http';
import { getSession } from '../middleware/auth';

/** Lo usa el frontend al cargar para decidir si muestra la aplicación o el login. */
export async function me(event: LambdaFunctionURLEvent): Promise<HttpResponse> {
  const session = await getSession(event);

  return session ? ok(session) : unauthorized();
}
