import { useContext } from 'react';
import { SessionContext, type SessionState } from './SessionContext';

export function useSession(): SessionState {
  const value = useContext(SessionContext);

  if (!value) {
    throw new Error('useSession debe usarse dentro de SessionProvider.');
  }

  return value;
}
