import { randomUUID } from 'node:crypto';
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { documents, usersTable } from '../lib/dynamo';

export interface User {
  email: string;
  userId: string;
  passwordHash: string;
  createdAt: string;
}

export class EmailAlreadyRegisteredError extends Error {
  constructor() {
    super('El correo electrónico ya está registrado.');
  }
}

export async function findByEmail(email: string): Promise<User | null> {
  const result = await documents.send(
    new GetCommand({ TableName: usersTable(), Key: { email } }),
  );

  return (result.Item as User | undefined) ?? null;
}

/**
 * La unicidad la impone la condición, no una lectura previa: dos registros simultáneos
 * con el mismo correo no pueden tener éxito los dos.
 */
export async function create(email: string, passwordHash: string): Promise<User> {
  const user: User = {
    email,
    userId: randomUUID(),
    passwordHash,
    createdAt: new Date().toISOString(),
  };

  try {
    await documents.send(
      new PutCommand({
        TableName: usersTable(),
        Item: user,
        ConditionExpression: 'attribute_not_exists(email)',
      }),
    );
  } catch (err) {
    if (err instanceof ConditionalCheckFailedException) {
      throw new EmailAlreadyRegisteredError();
    }
    throw err;
  }

  return user;
}
