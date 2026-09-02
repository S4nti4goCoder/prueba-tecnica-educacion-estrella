import { randomUUID } from 'node:crypto';
import { PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { applicationsTable, documents } from '../lib/dynamo';
import type { ApplicationInput } from '../schemas/application';

/** Un único estado por ahora: el flujo de aprobación está fuera de alcance. */
export type ApplicationStatus = 'SUBMITTED';

export interface Application extends ApplicationInput {
  userId: string;
  applicationId: string;
  createdAt: string;
  status: ApplicationStatus;
  /** Clave de ordenación: la fecha primero, así el Query devuelve lo mas reciente sin esfuerzo. */
  createdAtId: string;
}

export async function create(userId: string, input: ApplicationInput): Promise<Application> {
  const applicationId = randomUUID();
  const createdAt = new Date().toISOString();

  const application: Application = {
    ...input,
    userId,
    applicationId,
    createdAt,
    createdAtId: `${createdAt}#${applicationId}`,
    status: 'SUBMITTED',
  };

  await documents.send(
    new PutCommand({ TableName: applicationsTable(), Item: application }),
  );

  return application;
}

/**
 * La clave de partición ES el usuario, así que esta consulta no puede alcanzar filas de otro.
 * No hay filtro que olvidar ni scan que equivocar.
 */
export async function listByUser(userId: string): Promise<Application[]> {
  const result = await documents.send(
    new QueryCommand({
      TableName: applicationsTable(),
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: { ':userId': userId },
      ScanIndexForward: false,
    }),
  );

  return (result.Items ?? []) as Application[];
}
