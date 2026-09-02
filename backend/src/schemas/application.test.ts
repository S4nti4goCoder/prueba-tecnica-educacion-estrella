import { describe, expect, it } from 'vitest';
import { MAX_AMOUNT, MIN_AMOUNT, applicationSchema } from './application';

/**
 * Validación de servidor de la solicitud de crédito. El cliente válida las mismas
 * reglas para dar respuesta inmediata, pero todo lo que llega a la API se comprueba
 * aquí, porque a un cliente siempre se le puede dar la vuelta con curl.
 */

const valid = {
  fullName: 'Ana María Torres',
  idDocument: '1020304050',
  institution: 'Universidad Nacional',
  program: 'Ingeniería de Sistemas',
  amount: 12_000_000,
  videoKey: 'users/abc/def.mp4',
};

const errorFor = (input: unknown, field: string) => {
  const result = applicationSchema.safeParse(input);
  if (result.success) return null;
  return result.error.issues.find((i) => i.path[0] === field) ?? null;
};

describe('applicationSchema', () => {
  it('acepta una solicitud completa', () => {
    expect(applicationSchema.safeParse(valid).success).toBe(true);
  });

  it('recorta los espacios de los campos de texto', () => {
    const parsed = applicationSchema.parse({ ...valid, fullName: '  Ana María Torres  ' });
    expect(parsed.fullName).toBe('Ana María Torres');
  });

  it('rechaza un cuerpo vacío', () => {
    expect(applicationSchema.safeParse({}).success).toBe(false);
    expect(applicationSchema.safeParse(undefined).success).toBe(false);
  });

  describe('monto', () => {
    it('rechaza montos por debajo del mínimo', () => {
      expect(errorFor({ ...valid, amount: MIN_AMOUNT - 1 }, 'amount')).not.toBeNull();
    });

    it('rechaza montos por encima del máximo', () => {
      expect(errorFor({ ...valid, amount: MAX_AMOUNT + 1 }, 'amount')).not.toBeNull();
    });

    // El dinero se guarda como entero de pesos; un decimal introduciria redondeos.
    it('rechaza montos con decimales', () => {
      expect(errorFor({ ...valid, amount: 1_000_000.5 }, 'amount')).not.toBeNull();
    });

    it('rechaza el monto como texto', () => {
      expect(errorFor({ ...valid, amount: '12000000' }, 'amount')).not.toBeNull();
    });
  });

  describe('documento de identidad', () => {
    it('rechaza caracteres fuera del conjunto permitido', () => {
      expect(errorFor({ ...valid, idDocument: '10203<script>' }, 'idDocument')).not.toBeNull();
    });

    it('rechaza documentos demasiado cortos', () => {
      expect(errorFor({ ...valid, idDocument: '123' }, 'idDocument')).not.toBeNull();
    });
  });

  it('exige la referencia al video', () => {
    expect(errorFor({ ...valid, videoKey: '' }, 'videoKey')).not.toBeNull();
    const { videoKey: _omitted, ...sinVideo } = valid;
    expect(errorFor(sinVideo, 'videoKey')).not.toBeNull();
  });

  // El handler toma el userId del token. Uno inyectado no debe sobrevivir.
  it('descarta un userId enviado en el cuerpo', () => {
    const parsed = applicationSchema.parse({ ...valid, userId: 'otro-usuario' });
    expect(parsed).not.toHaveProperty('userId');
  });
});
