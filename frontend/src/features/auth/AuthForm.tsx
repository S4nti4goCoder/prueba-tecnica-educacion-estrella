import { CheckIcon, CircleIcon, EyeIcon, EyeOffIcon } from 'lucide-react';
import { type FormEvent, useState } from 'react';
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
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import { isCommonPassword } from './commonPasswords';
import { COMMON_PASSWORD_ERROR, PASSWORD_RULES, loginSchema, registerSchema } from './schemas';
import { useSession } from './useSession';

type Mode = 'login' | 'register';

const COPY = {
  login: {
    title: 'Iniciar sesión',
    description: 'Acceda para consultar y enviar sus solicitudes.',
    submit: 'Entrar',
    toggle: '¿No tiene cuenta? Regístrese',
    success: 'Sesión iniciada.',
  },
  register: {
    title: 'Crear cuenta',
    description: 'Regístrese para enviar su solicitud de crédito.',
    submit: 'Crear cuenta',
    toggle: '¿Ya tiene cuenta? Inicie sesión',
    success: 'Cuenta creada. Ya puede enviar su solicitud.',
  },
} as const;

export function AuthForm() {
  const { login, register } = useSession();

  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const copy = COPY[mode];
  const isRegister = mode === 'register';

  function switchMode() {
    setMode(mode === 'login' ? 'register' : 'login');
    setFieldErrors({});
    setFormError(null);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setFieldErrors({});
    setFormError(null);

    // Las mismas reglas que aplicara el servidor, para ver el error sin ir y volver.
    const parsed = (mode === 'login' ? loginSchema : registerSchema).safeParse({ email, password });

    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        errors[issue.path.join('.')] ??= issue.message;
      }
      setFieldErrors(errors);
      return;
    }

    setSubmitting(true);
    try {
      await (mode === 'login' ? login(parsed.data) : register(parsed.data));
      toast.success(copy.success);
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fields).length > 0) {
        setFieldErrors(err.fields);
      } else if (err instanceof ApiError) {
        setFormError(err.message);
      } else {
        setFormError('Ocurrió un error inesperado.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle>{copy.title}</CardTitle>
          <CardDescription>{copy.description}</CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={onSubmit} noValidate className="space-y-4">
            {formError && (
              <Alert variant="destructive">
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Correo electrónico</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="correo@ejemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={Boolean(fieldErrors.email)}
                disabled={submitting}
              />
              {fieldErrors.email && (
                <p className="text-sm text-destructive">{fieldErrors.email}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  placeholder="••••••••"
                  // Al enfocar el campo, un lector de pantalla lee los requisitos.
                  aria-describedby={isRegister ? 'requisitos-contrasena' : undefined}
                  className="pr-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-invalid={Boolean(fieldErrors.password)}
                  disabled={submitting}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={submitting}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  className="absolute inset-y-0 right-0 flex w-10 cursor-pointer items-center justify-center rounded-r-lg text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none"
                >
                  {showPassword ? (
                    <EyeOffIcon className="size-4" />
                  ) : (
                    <EyeIcon className="size-4" />
                  )}
                </button>
              </div>
              {/* Aparecen al empezar a escribir: en blanco solo serian ruido. */}
              {isRegister && password.length > 0 && (
                <ul id="requisitos-contrasena" className="space-y-1 pt-1 text-sm">
                  {PASSWORD_RULES.map((rule) => {
                    const met = rule.test(password);
                    return (
                      <li
                        key={rule.label}
                        className={cn(
                          'flex items-center gap-2',
                          met ? 'text-emerald-600' : 'text-muted-foreground',
                        )}
                      >
                        {met ? (
                          <CheckIcon className="size-3.5 shrink-0" />
                        ) : (
                          <CircleIcon className="size-3.5 shrink-0" />
                        )}
                        {rule.label}
                      </li>
                    );
                  })}
                </ul>
              )}

              {isRegister && !fieldErrors.password && isCommonPassword(password) && (
                <p className="text-sm text-destructive">{COMMON_PASSWORD_ERROR}</p>
              )}

              {fieldErrors.password && (
                <p className="text-sm text-destructive">{fieldErrors.password}</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Enviando...' : copy.submit}
            </Button>
          </form>

          <Button
            type="button"
            variant="link"
            className="mt-2 w-full"
            onClick={switchMode}
            disabled={submitting}
          >
            {copy.toggle}
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
