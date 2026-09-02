export interface ApiErrorBody {
  code: string;
  message: string;
  details?: Record<string, string>;
}

export class ApiError extends Error {
  readonly status: number;
  readonly body: ApiErrorBody;

  constructor(status: number, body: ApiErrorBody) {
    super(body.message);
    this.status = status;
    this.body = body;
  }

  /** Mensajes por campo de la validación de servidor, para marcar los inputs. */
  get fields(): Record<string, string> {
    return this.body.details ?? {};
  }
}

const NETWORK_ERROR: ApiErrorBody = {
  code: 'NETWORK_ERROR',
  message: 'No se pudo conectar con el servidor. Revise su conexión e inténtelo de nuevo.',
};

/**
 * Todas las llamadas van a /api, que el rewrite de Amplify y el proxy de Vite reenvían
 * a la Lambda. Mismo origen, así que la cookie de sesión viaja sola.
 */
export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`/api${path}`, {
      credentials: 'include',
      headers: init.body ? { 'Content-Type': 'application/json' } : undefined,
      ...init,
    });
  } catch {
    // fetch solo falla ante un error de red, nunca ante un 4xx o un 5xx.
    throw new ApiError(0, NETWORK_ERROR);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const body = (payload as { error?: ApiErrorBody } | null)?.error;
    throw new ApiError(
      response.status,
      body ?? { code: 'UNKNOWN', message: 'Ocurrió un error inesperado.' },
    );
  }

  return payload as T;
}

export const post = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined });

export const get = <T>(path: string) => request<T>(path, { method: 'GET' });
