import { useEffect, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ApiError } from '@/lib/api';
import { type Application, listApplications } from './api';

/** Un estado en vez de tres banderas: "cargando y con error" no se puede representar. */
type State =
  | { phase: 'loading' }
  | { phase: 'ready'; applications: Application[] }
  | { phase: 'error'; message: string };

const STATUS_LABELS: Record<Application['status'], string> = {
  SUBMITTED: 'Enviada',
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const formatAmount = (amount: number) =>
  amount.toLocaleString('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  });

export function ApplicationList({ reloadToken }: { reloadToken: number }) {
  const [state, setState] = useState<State>({ phase: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    // Protege del caso en que la respuesta llegue tras desmontarse el componente.
    let active = true;

    listApplications()
      .then(({ applications }) => {
        if (active) setState({ phase: 'ready', applications });
      })
      .catch((err) => {
        if (!active) return;
        setState({
          phase: 'error',
          message:
            err instanceof ApiError
              ? err.message
              : 'No se pudieron cargar sus solicitudes. Inténtelo de nuevo.',
        });
      });

    return () => {
      active = false;
    };
  }, [reloadToken, attempt]);

  function retry() {
    setState({ phase: 'loading' });
    setAttempt((n) => n + 1);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mis solicitudes</CardTitle>
        <CardDescription>Solo aparecen las solicitudes enviadas desde su cuenta.</CardDescription>
      </CardHeader>

      <CardContent>
        {state.phase === 'loading' && (
          <div className="space-y-2">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        )}

        {state.phase === 'error' && (
          <Alert variant="destructive">
            <AlertDescription className="flex items-center justify-between gap-4">
              <span>{state.message}</span>
              <Button variant="outline" size="sm" onClick={retry}>
                Reintentar
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {state.phase === 'ready' && state.applications.length === 0 && (
          <p className="py-6 text-center text-muted-foreground text-sm">
            Todavía no ha enviado ninguna solicitud.
          </p>
        )}

        {state.phase === 'ready' && state.applications.length > 0 && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Institución</TableHead>
                  <TableHead>Programa</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {state.applications.map((application) => (
                  <TableRow key={application.applicationId}>
                    <TableCell className="whitespace-nowrap">
                      {formatDate(application.createdAt)}
                    </TableCell>
                    <TableCell>{application.institution}</TableCell>
                    <TableCell>{application.program}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatAmount(application.amount)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{STATUS_LABELS[application.status]}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
