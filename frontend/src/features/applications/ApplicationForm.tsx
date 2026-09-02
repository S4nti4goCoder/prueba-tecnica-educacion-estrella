import { type DragEvent, type FormEvent, useRef, useState } from 'react';
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
import { cn } from '@/lib/utils';
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

/** El monto se guarda como dígitos y se muestra con separador de miles: 12000000 -> 12.000.000. */
const onlyDigits = (value: string) => value.replace(/\D/g, '').slice(0, 12);
const withSeparators = (digits: string) =>
  digits === '' ? '' : Number(digits).toLocaleString('es-CO');

export function ApplicationForm({ onCreated }: { onCreated: () => void }) {
  const [values, setValues] = useState(EMPTY);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
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
   * Se ejecuta al elegir o soltar el archivo, antes de cualquier petición. Es lo que evita
   * que un archivo inválido o demasiado grande consuma ancho de banda.
   */
  function acceptFile(chosen: File | null) {
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

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    if (!busy) acceptFile(event.dataTransfer.files?.[0] ?? null);
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

  const textFields = [
    { name: 'fullName', label: 'Nombre completo', placeholder: 'Ana María Torres' },
    { name: 'idDocument', label: 'Documento de identidad', placeholder: '1020304050' },
    { name: 'institution', label: 'Institución educativa', placeholder: 'Universidad Nacional' },
    { name: 'program', label: 'Programa académico', placeholder: 'Ingeniería de Sistemas' },
  ] as const;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nueva solicitud de crédito</CardTitle>
        <CardDescription>
          Complete sus datos y adjunte el video de la entrevista. Todos los campos son
          obligatorios.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          {formError && (
            <Alert variant="destructive">
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}

          {textFields.map((field) => (
            <div key={field.name} className="space-y-2">
              <Label htmlFor={field.name}>{field.label}</Label>
              <Input
                id={field.name}
                type="text"
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
            <Label htmlFor="amount">Monto solicitado (COP)</Label>
            <Input
              id="amount"
              type="text"
              inputMode="numeric"
              placeholder="12.000.000"
              value={withSeparators(values.amount)}
              onChange={(e) => set('amount', onlyDigits(e.target.value))}
              aria-invalid={Boolean(fieldErrors.amount)}
              disabled={busy}
              className="tabular-nums"
            />
            {fieldErrors.amount && (
              <p className="text-sm text-destructive">{fieldErrors.amount}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="video">Video de la entrevista</Label>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                if (!busy) setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={cn(
                'rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors',
                dragging && 'border-primary bg-accent',
                !dragging && fieldErrors.video && 'border-destructive',
                !dragging && !fieldErrors.video && 'border-input',
                busy && 'opacity-60',
              )}
            >
              <input
                id="video"
                ref={fileInputRef}
                type="file"
                accept=".mp4,.webm,video/mp4,video/webm"
                onChange={(e) => acceptFile(e.target.files?.[0] ?? null)}
                disabled={busy}
                className="sr-only"
              />

              {file ? (
                <>
                  <p className="font-medium text-sm">{file.name}</p>
                  <p className="text-muted-foreground text-xs">{megabytes(file.size)}</p>
                </>
              ) : (
                <>
                  <p className="text-sm">Arrastre el video aquí</p>
                  <p className="text-muted-foreground text-xs">MP4 o WebM, hasta 200 MB</p>
                </>
              )}

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3 cursor-pointer"
                disabled={busy}
                onClick={() => fileInputRef.current?.click()}
              >
                {file ? 'Cambiar video' : 'Elegir archivo'}
              </Button>
            </div>

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
                className="cursor-pointer"
                onClick={() => uploadRef.current?.abort()}
              >
                Cancelar subida
              </Button>
            </div>
          )}

          {phase === 'saving' && (
            <p className="text-muted-foreground text-sm">
              Verificando el video y registrando la solicitud…
            </p>
          )}

          <Button type="submit" className="w-full cursor-pointer" disabled={busy}>
            {phase === 'idle' ? 'Enviar solicitud' : 'Procesando…'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
