import type { LambdaFunctionURLEvent } from 'aws-lambda';
import { type HttpResponse, ok, unauthorized } from '../lib/http';
import { getSession } from '../middleware/auth';
import { listByUser } from '../repositories/applications';

export async function listApplications(event: LambdaFunctionURLEvent): Promise<HttpResponse> {
  const session = await getSession(event);
  if (!session) {
    return unauthorized();
  }

  const applications = await listByUser(session.userId);

  return ok({ applications });
}
