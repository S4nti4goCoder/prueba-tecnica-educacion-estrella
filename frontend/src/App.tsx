import { useState } from 'react';
import { ApplicationForm } from '@/features/applications/ApplicationForm';
import { ApplicationList } from '@/features/applications/ApplicationList';
import { AuthForm } from '@/features/auth/AuthForm';
import { LogoutButton } from '@/features/auth/LogoutButton';
import { useSession } from '@/features/auth/useSession';

export default function App() {
  const { session, loading } = useSession();
  // Se incrementa tras enviar con éxito para que la lista se recargue.
  const [reloadToken, setReloadToken] = useState(0);

  if (loading) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <p className="text-muted-foreground text-sm">Cargando…</p>
      </main>
    );
  }

  // Ocultar la interfaz es comodidad. La protección real es que el servidor devuelve
  // 401 en cada endpoint que necesita sesión.
  if (!session) {
    return <AuthForm />;
  }

  return (
    <div className="min-h-dvh bg-muted/40">
      <header className="flex items-center justify-between border-b bg-background px-6 py-3">
        <span className="font-medium whitespace-nowrap">Educación Estrella</span>
        <div className="flex items-center gap-4">
          {/* En pantallas estrechas no caben titulo, correo y boton a la vez. */}
          <span className="hidden text-muted-foreground text-sm sm:inline">{session.email}</span>
          <LogoutButton />
        </div>
      </header>

      {/* Lado a lado en escritorio. El formulario no necesita media pantalla y la
          tabla si: con columnas iguales, Estado se sale del borde. */}
      <main className="mx-auto grid max-w-6xl gap-6 p-6 lg:grid-cols-[26rem_minmax(0,1fr)] lg:items-start">
        <ApplicationForm onCreated={() => setReloadToken((n) => n + 1)} />
        <ApplicationList reloadToken={reloadToken} />
      </main>
    </div>
  );
}
