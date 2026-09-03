import { LogOutIcon } from 'lucide-react';
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
  AlertDialogMedia,
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
          <AlertDialogMedia className="bg-destructive/10 text-destructive">
            <LogOutIcon />
          </AlertDialogMedia>
          <AlertDialogTitle>Cerrar sesión</AlertDialogTitle>
          <AlertDialogDescription>
            ¿Seguro que quiere cerrar sesión? Tendrá que volver a iniciar sesión para acceder.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => void confirm()}
            disabled={busy}
          >
            {busy ? 'Cerrando...' : 'Sí, cerrar sesión'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
