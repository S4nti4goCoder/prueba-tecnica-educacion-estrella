import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm';

const client = new SSMClient({});

// El ámbito de modulo sobrevive entre invocaciones de un contenedor caliente, así que
// se llama a SSM una vez por arranque en frío, no una por petición.
let cachedSecret: string | undefined;

export async function getJwtSecret(): Promise<Uint8Array> {
  if (!cachedSecret) {
    const name = process.env.JWT_SECRET_PARAMETER;
    if (!name) {
      throw new Error('JWT_SECRET_PARAMETER no está definida.');
    }

    // WithDecryption es lo que convierte un SecureString en su valor real.
    const result = await client.send(
      new GetParameterCommand({ Name: name, WithDecryption: true }),
    );

    const value = result.Parameter?.Value;
    if (!value) {
      throw new Error(`El parámetro ${name} no tiene valor.`);
    }

    cachedSecret = value;
  }

  return new TextEncoder().encode(cachedSecret);
}
