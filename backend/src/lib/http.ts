import type { ZodError } from 'zod';

/** Forma de la respuesta que esperan las Function URL de Lambda (formato 2.0). */
export interface HttpResponse {
  statusCode: number;
  headers?: Record<string, string>;
  /** El formato 2.0 usa un array: un objeto de cabeceras no admite Set-Cookie repetido. */
  cookies?: string[];
  body?: string;
}

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'EMAIL_ALREADY_REGISTERED'
  | 'INVALID_CREDENTIALS'
  | 'UPLOAD_NOT_FOUND'
  | 'INVALID_FILE'
  | 'INTERNAL_ERROR';

const BASE_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};

// --- Lectura de la petición ---

/** Devuelve undefined si el cuerpo falta o está mal formado, para que el esquema lo rechace. */
export function parseJsonBody(event: {
  body?: string;
  isBase64Encoded?: boolean;
}): unknown {
  if (!event.body) return undefined;

  const raw = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf8')
    : event.body;

  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

/** Aplana los errores de Zod a { campo: mensaje } para que el formulario marque los inputs. */
export function fieldErrors(error: ZodError): Record<string, string> {
  const result: Record<string, string> = {};

  for (const issue of error.issues) {
    const field = issue.path.join('.') || '_';
    result[field] ??= issue.message;
  }

  return result;
}

// --- Cookie de sesión ---

export const SESSION_COOKIE_NAME = 'estrella_session';
export const SESSION_TTL_SECONDS = 60 * 60;

/** Pasa a 'None' solo si el proxy de mismo origen no propaga las cookies (prueba P-01). */
const SAME_SITE: 'Lax' | 'None' = 'Lax';

function buildSessionCookie(value: string, maxAgeSeconds: number): string {
  return [
    `${SESSION_COOKIE_NAME}=${value}`,
    'HttpOnly',
    'Secure',
    `SameSite=${SAME_SITE}`,
    'Path=/',
    `Max-Age=${maxAgeSeconds}`,
  ].join('; ');
}

export function sessionCookie(token: string): string {
  return buildSessionCookie(token, SESSION_TTL_SECONDS);
}

/** Los atributos deben coincidir con los de emisión, o el navegador conserva la original. */
export function clearSessionCookie(): string {
  return buildSessionCookie('', 0);
}

// --- Respuestas correctas ---

export function json(
  statusCode: number,
  body: unknown,
  options: { cookies?: string[]; headers?: Record<string, string> } = {},
): HttpResponse {
  return {
    statusCode,
    headers: { ...BASE_HEADERS, ...options.headers },
    ...(options.cookies?.length ? { cookies: options.cookies } : {}),
    body: JSON.stringify(body),
  };
}

export function ok(body: unknown, cookies?: string[]): HttpResponse {
  return json(200, body, { cookies });
}

export function created(body: unknown, cookies?: string[]): HttpResponse {
  return json(201, body, { cookies });
}

export function noContent(cookies?: string[]): HttpResponse {
  return {
    statusCode: 204,
    headers: BASE_HEADERS,
    ...(cookies?.length ? { cookies } : {}),
  };
}

// --- Errores ---

export function error(
  statusCode: number,
  code: ErrorCode,
  message: string,
  details?: unknown,
): HttpResponse {
  return json(statusCode, {
    error: { code, message, ...(details !== undefined ? { details } : {}) },
  });
}

export function badRequest(code: ErrorCode, message: string, details?: unknown): HttpResponse {
  return error(400, code, message, details);
}

export function unauthorized(message = 'Sesión no válida o expirada.'): HttpResponse {
  return error(401, 'UNAUTHORIZED', message);
}

export function forbidden(message = 'No tiene acceso a este recurso.'): HttpResponse {
  return error(403, 'FORBIDDEN', message);
}

export function notFound(message = 'Recurso no encontrado.'): HttpResponse {
  return error(404, 'NOT_FOUND', message);
}

export function conflict(code: ErrorCode, message: string): HttpResponse {
  return error(409, code, message);
}

/** La traza va a CloudWatch; el cliente solo recibe un identificador que citar. */
export function internalError(requestId: string): HttpResponse {
  return error(500, 'INTERNAL_ERROR', 'Error interno del servidor.', { requestId });
}
