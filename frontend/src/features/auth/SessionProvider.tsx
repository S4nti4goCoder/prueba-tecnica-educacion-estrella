import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { type Session, fetchSession, loginUser, logoutUser, registerUser } from './api';
import { SessionContext, type SessionState } from './SessionContext';

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSession()
      .then(setSession)
      .catch(() => setSession(null))
      .finally(() => setLoading(false));
  }, []);

  const value = useMemo<SessionState>(
    () => ({
      session,
      loading,
      register: async (input) => setSession(await registerUser(input)),
      login: async (input) => setSession(await loginUser(input)),
      logout: async () => {
        await logoutUser();
        setSession(null);
      },
    }),
    [session, loading],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
