import { describe, expect, it } from 'vitest';
import { PASSWORD_MAX_LENGTH, loginSchema, passwordSchema } from './auth';

/**
 * La normalización del correo sostiene dos cosas: la unicidad de la cuenta, porque el
 * correo es la clave de partición, y el bloqueo por intentos, que cuenta por cuenta.
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

describe('política de contraseñas', () => {
  const motivo = (password: string) => {
    const result = passwordSchema.safeParse(password);
    return result.success ? null : result.error.issues[0]?.message;
  };

  it('acepta una contraseña que cumple todo', () => {
    expect(motivo('Evaluador2026#Prueba')).toBeNull();
  });

  it('rechaza las de menos de 12 caracteres', () => {
    expect(motivo('Abc123!xyz')).toContain('12 caracteres');
  });

  it('rechaza si falta una minúscula', () => {
    expect(motivo('ABCDEFGH1234!')).toContain('minúscula');
  });

  it('rechaza si falta una mayúscula', () => {
    expect(motivo('abcdefgh1234!')).toContain('mayúscula');
  });

  it('rechaza si falta un número', () => {
    expect(motivo('AbcdefghIjkl!')).toContain('número');
  });

  it('rechaza si falta un carácter especial', () => {
    expect(motivo('Abcdefgh12345')).toContain('especial');
  });

  it('rechaza por encima del límite de bcrypt', () => {
    expect(motivo(`Aa1!${'x'.repeat(PASSWORD_MAX_LENGTH)}`)).toContain('72');
  });

  /**
   * El motivo de existir de la lista negra: esta cumple las cinco reglas anteriores y
   * sigue siendo de las primeras que probaría cualquiera.
   */
  it('rechaza una habitual que cumple todas las demás reglas', () => {
    expect(motivo('Password123!')).toContain('habitual');
  });

  it('la rechaza aunque cambien las mayúsculas', () => {
    expect(motivo('PassWord123!')).toContain('habitual');
  });

  it('rechaza las habituales en español', () => {
    expect(motivo('Contrasena123!')).toContain('habitual');
  });

  it('informa de un solo requisito a la vez', () => {
    const result = passwordSchema.safeParse('abc');
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues).toHaveLength(1);
  });
});
