import type { LambdaFunctionURLEvent, LambdaFunctionURLResult } from 'aws-lambda';
import { createApplication } from './handlers/createApplication';
import { listApplications } from './handlers/listApplications';
import { login } from './handlers/login';
import { logout } from './handlers/logout';
import { me } from './handlers/me';
import { presignUpload } from './handlers/presignUpload';
import { register } from './handlers/register';
import { internalError, notFound, ok } from './lib/http';

export async function handler(event: LambdaFunctionURLEvent): Promise<LambdaFunctionURLResult> {
  const { requestId } = event.requestContext;
  const { method } = event.requestContext.http;
  const path = event.rawPath.replace(/^\/api/, '').replace(/\/+$/, '') || '/';

  // Ni cabeceras, ni cookies, ni cuerpo: llevan el token de sesión y datos personales.
  console.log(JSON.stringify({ requestId, method, path }));

  try {
    switch (`${method} ${path}`) {
      case 'GET /health':
        return ok({ status: 'ok' });

      case 'POST /auth/register':
        return await register(event);

      case 'POST /auth/login':
        return await login(event);

      case 'GET /auth/me':
        return await me(event);

      case 'POST /auth/logout':
        return logout();

      case 'POST /applications':
        return await createApplication(event);

      case 'GET /applications':
        return await listApplications(event);

      case 'POST /uploads/presign':
        return await presignUpload(event);

      default:
        return notFound(`No existe la ruta ${method} ${path}.`);
    }
  } catch (err) {
    console.error(JSON.stringify({ requestId, error: String(err) }));
    return internalError(requestId);
  }
}
