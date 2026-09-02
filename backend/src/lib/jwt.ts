import { SignJWT, jwtVerify } from 'jose';
import { SESSION_TTL_SECONDS } from './http';
import { getJwtSecret } from './ssm';

const ALGORITHM = 'HS256';
const ISSUER = 'estrella-api';

export interface SessionClaims {
  userId: string;
  email: string;
}

export async function signSession(claims: SessionClaims): Promise<string> {
  const secret = await getJwtSecret();

  return new SignJWT({ email: claims.email })
    .setProtectedHeader({ alg: ALGORITHM })
    .setSubject(claims.userId)
    .setIssuer(ISSUER)
    .setIssuedAt()
    // Misma vida que la cookie, para que ninguno sobreviva al otro.
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secret);
}

/** Devuelve null ante cualquier token inválido: caducado, manipulado, de otro emisor o mal formado. */
export async function verifySession(token: string): Promise<SessionClaims | null> {
  try {
    const secret = await getJwtSecret();

    const { payload } = await jwtVerify(token, secret, {
      // Fijar el algoritmo es lo que rechaza un token que declare "alg": "none".
      algorithms: [ALGORITHM],
      issuer: ISSUER,
    });

    if (!payload.sub || typeof payload.email !== 'string') {
      return null;
    }

    return { userId: payload.sub, email: payload.email };
  } catch {
    return null;
  }
}
