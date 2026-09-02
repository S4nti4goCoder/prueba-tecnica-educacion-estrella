import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Dos cosas hay que demostrar aquí. Que la ventana caduca por reloj y no por el borrado
 * del TTL, porque DynamoDB puede tardar 48 horas en borrar y hasta entonces la cuenta
 * seguiría castigada. Y que un fallo de la tabla deja pasar en vez de cerrar el login.
 */

const send = vi.fn();

vi.mock('./dynamo', () => ({
  documents: { send: (...args: unknown[]) => send(...args) },
  rateLimitsTable: () => 'tabla-de-prueba',
}));

const { LOGIN_LIMIT, countAttempt, isBlocked } = await import('./rateLimit');

const AHORA = new Date('2026-09-02T12:00:00Z');
const SEGUNDOS = Math.floor(AHORA.getTime() / 1000);
const CORREO = 'persona@ejemplo.com';

/** Lee la entrada del comando que el limitador envió a DynamoDB. */
const comando = (indice = 0) => send.mock.calls[indice]?.[0]?.input;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(AHORA);
  send.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('isBlocked', () => {
  it('deja pasar cuando la IP no tiene contador', async () => {
    send.mockResolvedValue({});
    expect(await isBlocked(CORREO, LOGIN_LIMIT)).toBe(false);
  });

  it('deja pasar mientras queden intentos', async () => {
    send.mockResolvedValue({
      Item: { hits: LOGIN_LIMIT.attempts - 1, resetAt: SEGUNDOS + 300 },
    });
    expect(await isBlocked(CORREO, LOGIN_LIMIT)).toBe(false);
  });

  it('bloquea al agotar el cupo e indica cuánto falta', async () => {
    send.mockResolvedValue({
      Item: { hits: LOGIN_LIMIT.attempts, resetAt: SEGUNDOS + 300 },
    });
    expect(await isBlocked(CORREO, LOGIN_LIMIT)).toEqual({ retryAfterSeconds: 300 });
  });

  it('deja pasar con el cupo agotado si la ventana ya venció', async () => {
    // La fila sigue ahí porque el TTL aun no la ha borrado. Manda el reloj.
    send.mockResolvedValue({
      Item: { hits: LOGIN_LIMIT.attempts + 50, resetAt: SEGUNDOS - 1 },
    });
    expect(await isBlocked(CORREO, LOGIN_LIMIT)).toBe(false);
  });

  it('deja pasar si DynamoDB falla', async () => {
    send.mockRejectedValue(new Error('tabla no disponible'));
    expect(await isBlocked(CORREO, LOGIN_LIMIT)).toBe(false);
  });

  it('lee de forma consistente para no perderse el ultimo fallo', async () => {
    send.mockResolvedValue({});
    await isBlocked(CORREO, LOGIN_LIMIT);
    expect(comando().ConsistentRead).toBe(true);
  });
});

describe('countAttempt', () => {
  it('suma sobre la ventana abierta sin tocar su vencimiento', async () => {
    send.mockResolvedValue({});
    await countAttempt(CORREO, LOGIN_LIMIT);

    const input = comando();
    expect(input.Key).toEqual({ id: `login#${CORREO}` });
    expect(input.UpdateExpression).toContain('if_not_exists(#resetAt, :resetAt)');
    expect(input.ConditionExpression).toContain('#resetAt > :now');
    expect(input.ExpressionAttributeValues[':resetAt']).toBe(
      SEGUNDOS + LOGIN_LIMIT.windowSeconds,
    );
  });

  it('reinicia el contador cuando la ventana anterior había vencido', async () => {
    send
      .mockRejectedValueOnce(
        new ConditionalCheckFailedException({ message: 'vencida', $metadata: {} }),
      )
      .mockResolvedValueOnce({});

    await countAttempt(CORREO, LOGIN_LIMIT);

    expect(send).toHaveBeenCalledTimes(2);
    const input = comando(1);
    expect(input.UpdateExpression).toBe('SET #resetAt = :resetAt, #hits = :one');
    expect(input.ExpressionAttributeValues[':one']).toBe(1);
  });

  it('no propaga el error si DynamoDB falla al contar', async () => {
    send.mockRejectedValue(new Error('tabla no disponible'));
    await expect(countAttempt(CORREO, LOGIN_LIMIT)).resolves.toBeUndefined();
  });
});
