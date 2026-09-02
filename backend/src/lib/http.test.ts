import { describe, expect, it } from 'vitest';
import { clientIp, tooManyRequests } from './http';

const PROXY = '130.176.0.1';
const CLIENTE = '186.30.10.20';

const event = (forwarded?: string) => ({
  headers: forwarded ? { 'x-forwarded-for': forwarded } : {},
  requestContext: { http: { sourceIp: PROXY } },
});

describe('clientIp', () => {
  it('prefiere X-Forwarded-For a la IP del proxy', () => {
    expect(clientIp(event(CLIENTE))).toBe(CLIENTE);
  });

  it('se queda con el último salto de la cadena', () => {
    expect(clientIp(event(`1.1.1.1, 2.2.2.2, ${CLIENTE}`))).toBe(CLIENTE);
  });

  it('cae en sourceIp cuando no hay cabecera', () => {
    expect(clientIp(event())).toBe(PROXY);
  });

  it('cae en sourceIp cuando la cabecera viene vacía', () => {
    expect(clientIp(event('   '))).toBe(PROXY);
  });
});

describe('tooManyRequests', () => {
  it('responde 429 con Retry-After en segundos', () => {
    const response = tooManyRequests(300);
    expect(response.statusCode).toBe(429);
    expect(response.headers?.['Retry-After']).toBe('300');
  });

  it('redondea hacia arriba los minutos del mensaje', () => {
    expect(tooManyRequests(61).body).toContain('2 minutos');
  });
});
