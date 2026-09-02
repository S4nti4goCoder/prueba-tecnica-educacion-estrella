export type UploadFailureReason = 'ABORTED' | 'NETWORK' | 'REJECTED';

export class UploadFailure extends Error {
  readonly reason: UploadFailureReason;

  constructor(reason: UploadFailureReason, message: string) {
    super(message);
    this.reason = reason;
  }
}

export interface Upload {
  done: Promise<void>;
  abort: () => void;
}

/**
 * Sube directamente a S3 con un presigned POST.
 *
 * XMLHttpRequest y no fetch: fetch no informa del progreso de subida en ningún
 * navegador, así que una barra construida sobre el seria falsa. XHR además da abort()
 * gratis, que es lo que necesita el botón de cancelar.
 */
export function uploadToS3(options: {
  url: string;
  fields: Record<string, string>;
  file: File;
  onProgress: (percent: number) => void;
}): Upload {
  const { url, fields, file, onProgress } = options;

  const form = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    form.append(name, value);
  }
  // S3 ignora todo lo que vaya después del campo del archivo, así que va el ultimo.
  form.append('file', file);

  const xhr = new XMLHttpRequest();

  const done = new Promise<void>((resolve, reject) => {
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }
      // Aquí es donde S3 aplica las condiciones de tamaño y tipo de la política.
      reject(
        new UploadFailure(
          'REJECTED',
          'El almacenamiento rechazó el archivo. Compruebe el formato y el tamaño.',
        ),
      );
    });

    xhr.addEventListener('error', () =>
      reject(
        new UploadFailure(
          'NETWORK',
          'Se perdió la conexión durante la subida. Inténtelo de nuevo.',
        ),
      ),
    );

    xhr.addEventListener('timeout', () =>
      reject(new UploadFailure('NETWORK', 'La subida tardó demasiado. Inténtelo de nuevo.')),
    );

    xhr.addEventListener('abort', () =>
      reject(new UploadFailure('ABORTED', 'Subida cancelada.')),
    );

    xhr.open('POST', url);
    xhr.send(form);
  });

  return { done, abort: () => xhr.abort() };
}
