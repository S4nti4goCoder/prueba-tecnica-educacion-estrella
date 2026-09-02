import { type ChangeEvent, type FormEvent, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { ApiError } from '@/lib/api';
import { type Upload, UploadFailure, uploadToS3 } from '@/lib/upload';
import { createApplication, requestPresign } from './api';
import {
  MAX_VIDEO_BYTES,
  VIDEO_TYPES,
  applicationFormSchema,
  isAllowedVideoType,
} from './schemas';

type Phase = 'idle' | 'uploading' | 'saving';

const EMPTY = { fullName: '', idDocument: '', institution: '', program: '', amount: '' };

const megabytes = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

export function ApplicationForm({ onCreated }: { onCreated: () => void }) {
  const [values, setValues] = useState(EMPTY);
  const [file, setFile] = useState<File | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState(0);

  const uploadRef = useRef<Upload | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const busy = phase !== 'idle';

  function set(field: keyof typeof EMPTY, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  /**
   * Se ejecuta al elegir el archivo, antes de cualquier petición. Es lo que evita que un
   * archivo inválido o demasiado grande consuma ancho de banda.
   */
  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const chosen = event.target.files?.[0] ?? null;
    setFieldErrors((prev) => ({ ...prev, video: '' }));
    setFormError(null);

    if (!chosen) {
      setFile(null);
      return;
    }

    if (!isAllowedVideoType(chosen.type)) {
      setFile(null);
      setFieldErrors((prev) => ({ ...prev, video: 'El video debe estar en formato MP4 o WebM.' }));
      return;
    }

    if (chosen.size > MAX_VIDEO_BYTES) {
      setFile(null);
      setFieldErrors((prev) => ({
        ...prev,
        video: `El video pesa ${megabytes(chosen.size)} y el máximo son 200 MB.`,
      }));
      return;
    }

    setFile(chosen);
  }

  function reset() {
    setValues(EMPTY);
    setFile(null);
    setProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setFieldErrors({});
    setFormError(null);

    const parsed = applicationFormSchema.safeParse({
      ...values,
      amount: values.amount === '' ? Number.NaN : Number(values.amount),
    });

    const errors: Record<string, string> = {};
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        errors[issue.path.join('.')] ??= issue.message;
      }
    }
    if (!file) {
      errors.video ??= 'Adjunte el video de la entrevista.';
    }

    if (Object.keys(errors).length > 0 || !parsed.success || !file) {
      setFieldErrors(errors);
      return;
    }

    try {
      setPhase('uploading');
      setProgress(0);

      const presign = await requestPresign({
        contentType: file.type as keyof typeof VIDEO_TYPES,
        size: file.size,
      });

      const upload = uploadToS3({ ...presign, file, onProgress: setProgress });
      uploadRef.current = upload;
      await upload.done;
      uploadRef.current = null;

      // Solo ahora se entera el servidor de que hubo subida, y la comprueba.
      setPhase('saving');
      await createApplication({ ...parsed.data, videoKey: presign.key });

      toast.success('Solicitud enviada correctamente.');
      reset();
      onCreated();
    } catch (err) {
      if (err instanceof UploadFailure) {
        if (err.reason === 'ABORTED') {
          toast.info(err.message);
        } else {
          setFormError(err.message);
        }
      } else if (err instanceof ApiError && Object.keys(err.fields).length > 0) {
        setFieldErrors(err.fields);
      } else if (err instanceof ApiError) {
        setFormError(err.message);
      } else {
        setFormError('Ocurrió un error inesperado. Inténtelo de nuevo.');
      }
    } finally {
      uploadRef.current = null;
      setPhase('idle');
    }
  }

  const fields = [
    { name: 'fullName', label: 'Nombre completo', type: 'text', placeholder: 'Ana María Torres' },
    { name: 'idDocument', label: 'Documento de identidad', type: 'text', placeholder: '1020304050' },
    { name: 'institution', label: 'Institución educativa', type: 'text', placeholder: 'Universidad Nacional' },
    { name: 'program', label: 'Programa académico', type: 'text', placeholder: 'Ingeniería de Sistemas' },
    { name: 'amount', label: 'Monto solicitado (COP)', type: 'number', placeholder: '12000000' },
  ] as const;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nueva solicitud de crédito</CardTitle>
        <CardDescription>
          Complete sus datos y adjunte el video de la entrevista.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          {formError && (
            <Alert variant="destructive">
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}

          {fields.map((field) => (
            <div key={field.name} className="space-y-2">
              <Label htmlFor={field.name}>{field.label}</Label>
              <Input
                id={field.name}
                type={field.type}
                placeholder={field.placeholder}
                value={values[field.name]}
                onChange={(e) => set(field.name, e.target.value)}
                aria-invalid={Boolean(fieldErrors[field.name])}
                disabled={busy}
              />
              {fieldErrors[field.name] && (
                <p className="text-sm text-destructive">{fieldErrors[field.name]}</p>
              )}
            </div>
          ))}

          <div className="space-y-2">
            <Label htmlFor="video">Video de la entrevista</Label>
            <Input
              id="video"
              ref={fileInputRef}
              type="file"
              accept=".mp4,.webm,video/mp4,video/webm"
              onChange={onFileChange}
              aria-invalid={Boolean(fieldErrors.video)}
              disabled={busy}
            />
            <p className="text-muted-foreground text-xs">
              MP4 o WebM, hasta 200 MB.
              {file && ` Seleccionado: ${file.name} (${megabytes(file.size)}).`}
            </p>
            {fieldErrors.video && <p className="text-sm text-destructive">{fieldErrors.video}</p>}
          </div>

          {phase === 'uploading' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Subiendo el video…</span>
                <span className="tabular-nums">{progress}%</span>
              </div>
              <Progress value={progress} />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => uploadRef.current?.abort()}
              >
                Cancelar subida
              </Button>
            </div>
          )}

          {phase === 'saving' && (
            <p className="text-muted-foreground text-sm">Verificando el video y registrando la solicitud…</p>
          )}

          <Button type="submit" className="w-full" disabled={busy}>
            {phase === 'idle' ? 'Enviar solicitud' : 'Procesando…'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
