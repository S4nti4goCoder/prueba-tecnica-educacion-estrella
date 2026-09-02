import { compare, hash } from 'bcryptjs';

// Coste 10 y no el habitual 12: el hash es CPU pura y Lambda cobra por
// milisegundo. En hardware dedicado subiría.
const COST = 10;

export function hashPassword(plain: string): Promise<string> {
  return hash(plain, COST);
}

/** Comparación en tiempo constante, para que no se pueda adivinar cronometrando. */
export function verifyPassword(plain: string, storedHash: string): Promise<boolean> {
  return compare(plain, storedHash);
}
