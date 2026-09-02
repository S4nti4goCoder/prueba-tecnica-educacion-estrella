import type { LambdaFunctionURLEvent } from 'aws-lambda';
import {
  type HttpResponse,
  badRequest,
  created,
  fieldErrors,
  parseJsonBody,
  unauthorized,
} from '../lib/http';
import { VERIFICATION_MESSAGES, verifyUploadedVideo } from '../lib/video';
import { getSession } from '../middleware/auth';
import { create } from '../repositories/applications';
import { applicationSchema } from '../schemas/application';

export async function createApplication(event: LambdaFunctionURLEvent): Promise<HttpResponse> {
  const session = await getSession(event);
  if (!session) {
    return unauthorized();
  }

  const parsed = applicationSchema.safeParse(parseJsonBody(event));
  if (!parsed.success) {
    return badRequest(
      'VALIDATION_ERROR',
      'Revise los datos del formulario.',
      fieldErrors(parsed.error),
    );
  }

  // El video fue del navegador a S3 directamente, así que el servidor no lo vio.
  // Aquí es donde se entera de que llego de verdad.
  const video = await verifyUploadedVideo(session.userId, parsed.data.videoKey);
  if (!video.ok) {
    return badRequest('INVALID_FILE', VERIFICATION_MESSAGES[video.reason]);
  }

  // El userId sale del token, nunca del cuerpo de la petición.
  const application = await create(session.userId, parsed.data);

  return created(application);
}
