import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

// Ámbito de modulo: la conexión se reutiliza entre invocaciones del mismo contenedor.
const client = new DynamoDBClient({});

// El cliente Document convierte objetos normales de JavaScript al formato tipado de
// DynamoDB, para que los repositorios no traten con envoltorios { S: "..." }.
export const documents = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} no está definida.`);
  }
  return value;
}

export const usersTable = () => requireEnv('USERS_TABLE');
export const applicationsTable = () => requireEnv('APPLICATIONS_TABLE');
export const rateLimitsTable = () => requireEnv('RATE_LIMITS_TABLE');
