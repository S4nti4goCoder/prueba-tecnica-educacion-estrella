import { useState } from 'react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { useSession } from './useSession';

/**
 * El cierre de sesión se confirma, siguiendo la convención de las plataformas
 * financieras y no la de las aplicaciones de consumo, que salen sin preguntar.
 */
export function LogoutButton() {
  const { logout } = useSession();
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    try {
      await logout();
      toast.success('Sesión cerrada.');
    } catch {
      toast.error('No se pudo cerrar la sesión. Inténtelo de nuevo.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm">
          Cerrar sesión
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Cerrar sesión?</AlertDialogTitle>
          <AlertDialogDescription>
            Tendrá que volver a iniciar sesión para consultar o enviar solicitudes.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={() => void confirm()} disabled={busy}>
            {busy ? 'Cerrando…' : 'Cerrar sesión'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
