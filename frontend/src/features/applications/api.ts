import { get, post } from '@/lib/api';
import type { ApplicationFormInput, VideoContentType } from './schemas';

export interface Application extends ApplicationFormInput {
  applicationId: string;
  createdAt: string;
  status: 'SUBMITTED';
  videoKey: string;
}

export interface Presign {
  url: string;
  fields: Record<string, string>;
  key: string;
}

/** Devuelve el permiso que necesita el navegador para subir directamente a S3. */
export const requestPresign = (input: { contentType: VideoContentType; size: number }) =>
  post<Presign>('/uploads/presign', input);

export const createApplication = (input: ApplicationFormInput & { videoKey: string }) =>
  post<Application>('/applications', input);

export const listApplications = () => get<{ applications: Application[] }>('/applications');
