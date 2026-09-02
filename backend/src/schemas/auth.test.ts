import { describe, expect, it } from 'vitest';
import { loginSchema } from './auth';

/**
 * La normalización del correo sostiene dos cosas: la unicidad de la cuenta, porque el
 * correo es la clave de partición, y el limitador de intentos, que cuenta por cuenta.
 * Sin ella, alternar mayúsculas daría contadores distintos para el mismo usuario.
 */
describe('normalización del correo', () => {
  const normaliza = (email: string) => loginSchema.parse({ email, password: 'x' }).email;

  it('pasa a minúsculas', () => {
    expect(normaliza('Persona@Ejemplo.COM')).toBe('persona@ejemplo.com');
  });

  it('quita los espacios de los extremos', () => {
    expect(normaliza('  persona@ejemplo.com  ')).toBe('persona@ejemplo.com');
  });

  it('rechaza lo que no es un correo', () => {
    expect(loginSchema.safeParse({ email: 'persona', password: 'x' }).success).toBe(false);
  });
});
