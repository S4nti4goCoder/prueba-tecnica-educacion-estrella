import { createContext } from 'react';
import type { Session } from './api';
import type { LoginInput, RegisterInput } from './schemas';

export interface SessionState {
  session: Session | null;
  /** Cierto hasta que responde el primer /auth/me, para no enseñar el login un instante. */
  loading: boolean;
  register: (input: RegisterInput) => Promise<void>;
  login: (input: LoginInput) => Promise<void>;
  logout: () => Promise<void>;
}

export const SessionContext = createContext<SessionState | null>(null);
