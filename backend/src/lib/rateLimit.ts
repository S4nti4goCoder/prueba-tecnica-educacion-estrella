import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { documents, rateLimitsTable } from './dynamo';

export interface Limit {
  /** Prefijo de la clave: separa los contadores de cada operación. */
  name: string;
  attempts: number;
  windowSeconds: number;
}

/**
 * Se cuenta por cuenta, no por IP.
 *
 * Comprobado contra el despliegue: Amplify reenvía X-Forwarded-For tal y como llega y no
 * añade la IP real al final, así que la cabecera entera la controla quien llama y un
 * límite por IP se esquiva cambiando un texto. El correo, en cambio, es el dato que el
 * atacante está intentando forzar: cambiarlo es dejar de atacar esa cuenta.
 *
 * A cambio, quien conozca un correo registrado puede mantenerlo bloqueado fallando a
 * propósito. Se asume: la ventana es corta y la alternativa era no tener protección.
 */
export const LOGIN_LIMIT: Limit = { name: 'login', attempts: 5, windowSeconds: 15 * 60 };

/**
 * Por IP y por lo tanto burlable: frena el uso torpe, no a un atacante.
 *
 * Diez y no tres porque quien comparte salida a internet comparte contador, y en una
 * oficina o un campus varios estudiantes legítimos se bloquearían entre ellos.
 */
export const REGISTER_LIMIT: Limit = { name: 'register', attempts: 10, windowSeconds: 60 * 60 };

export interface Blocked {
  retryAfterSeconds: number;
}

const now = () => Math.floor(Date.now() / 1000);

/** El sujeto es un correo o una IP según el límite; el TTL lo borra en ambos casos. */
const keyFor = (limit: Limit, subject: string) => `${limit.name}#${subject}`;

const NAMES = { '#resetAt': 'resetAt', '#hits': 'hits' };

/**
 * Consulta si un sujeto agotó su cupo. No escribe nada.
 *
 * Ante cualquier fallo de DynamoDB devuelve false y deja pasar la petición: una avería
 * del limitador no puede tumbar el inicio de sesión. La defensa de fondo contra la fuerza
 * bruta sigue siendo el coste de bcrypt, que no depende de esta tabla.
 */
export async function isBlocked(subject: string, limit: Limit): Promise<Blocked | false> {
  let item: Record<string, unknown> | undefined;

  try {
    const result = await documents.send(
      new GetCommand({
        TableName: rateLimitsTable(),
        Key: { id: keyFor(limit, subject) },
        // Consistente: una lectura eventual podría no ver el fallo recién contado.
        ConsistentRead: true,
      }),
    );
    item = result.Item;
  } catch (err) {
    console.error(JSON.stringify({ rateLimit: 'lectura', limit: limit.name, error: String(err) }));
    return false;
  }

  if (!item) return false;

  const resetAt = Number(item.resetAt ?? 0);
  const hits = Number(item.hits ?? 0);
  const remaining = resetAt - now();

  if (remaining <= 0 || hits < limit.attempts) return false;

  return { retryAfterSeconds: remaining };
}

/**
 * Suma un intento, abriendo ventana nueva si la anterior venció.
 *
 * La condición es lo que reinicia la ventana de verdad. Confiar en el TTL no serviría:
 * DynamoDB puede tardar hasta 48 horas en borrar la fila, y hasta entonces el contador
 * seguiría vivo y el sujeto bloqueado mucho más de los 15 minutos prometidos.
 */
export async function countAttempt(subject: string, limit: Limit): Promise<void> {
  const table = rateLimitsTable();
  const id = keyFor(limit, subject);
  const current = now();
  const resetAt = current + limit.windowSeconds;

  try {
    await documents.send(
      new UpdateCommand({
        TableName: table,
        Key: { id },
        UpdateExpression: 'SET #resetAt = if_not_exists(#resetAt, :resetAt) ADD #hits :one',
        ConditionExpression: 'attribute_not_exists(#resetAt) OR #resetAt > :now',
        ExpressionAttributeNames: NAMES,
        ExpressionAttributeValues: { ':resetAt': resetAt, ':one': 1, ':now': current },
      }),
    );
  } catch (err) {
    if (err instanceof ConditionalCheckFailedException) {
      await openWindow(table, id, resetAt);
      return;
    }
    console.error(JSON.stringify({ rateLimit: 'conteo', limit: limit.name, error: String(err) }));
  }
}

/** La ventana anterior había vencido: el contador arranca de nuevo en uno. */
async function openWindow(table: string, id: string, resetAt: number): Promise<void> {
  try {
    await documents.send(
      new UpdateCommand({
        TableName: table,
        Key: { id },
        UpdateExpression: 'SET #resetAt = :resetAt, #hits = :one',
        ExpressionAttributeNames: NAMES,
        ExpressionAttributeValues: { ':resetAt': resetAt, ':one': 1 },
      }),
    );
  } catch (err) {
    console.error(JSON.stringify({ rateLimit: 'reinicio', error: String(err) }));
  }
}
