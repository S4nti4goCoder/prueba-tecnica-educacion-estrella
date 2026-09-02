import { describe, expect, it, vi } from 'vitest';

/**
 * El token de sesión es lo único que separa los datos de un solicitante de los de
 * otro. Estas pruebas cubren las formas en que un token falsificado podría colarse.
 */

const SECRET = new TextEncoder().encode('secreto-de-prueba-suficientemente-largo');

vi.mock('./ssm', () => ({ getJwtSecret: async () => SECRET }));

const { signSession, verifySession } = await import('./jwt');

const claims = { userId: 'usuario-1', email: 'ana@ejemplo.com' };

describe('sesión JWT', () => {
  it('firma y verifica el mismo token', async () => {
    const token = await signSession(claims);
    expect(await verifySession(token)).toEqual(claims);
  });

  it('rechaza un token con la firma manipulada', async () => {
    const token = await signSession(claims);
    expect(await verifySession(`${token.slice(0, -4)}AAAA`)).toBeNull();
  });

  // Sin fijar el algoritmo, un token que declare "alg": "none" se aceptaria
  // sin ninguna firma.
  it('rechaza un token con alg none', async () => {
    const [, payload] = (await signSession(claims)).split('.');
    const header = Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url');

    expect(await verifySession(`${header}.${payload}.`)).toBeNull();
  });

  it('rechaza un token firmado con otro secreto', async () => {
    const { SignJWT } = await import('jose');
    const foreign = await new SignJWT({ email: claims.email })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(claims.userId)
      .setIssuer('estrella-api')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode('otro-secreto-completamente-distinto'));

    expect(await verifySession(foreign)).toBeNull();
  });

  it('rechaza un token ya caducado', async () => {
    const { SignJWT } = await import('jose');
    const expired = await new SignJWT({ email: claims.email })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(claims.userId)
      .setIssuer('estrella-api')
      .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
      .sign(SECRET);

    expect(await verifySession(expired)).toBeNull();
  });

  it('rechaza basura y cadenas vacías sin lanzar excepciones', async () => {
    expect(await verifySession('')).toBeNull();
    expect(await verifySession('no-es-un-token')).toBeNull();
    expect(await verifySession('a.b.c')).toBeNull();
  });
});
