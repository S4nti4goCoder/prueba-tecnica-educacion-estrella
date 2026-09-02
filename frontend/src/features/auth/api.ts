import { get, post } from '@/lib/api';
import type { LoginInput, RegisterInput } from './schemas';

export interface Session {
  userId: string;
  email: string;
}

export const registerUser = (input: RegisterInput) => post<Session>('/auth/register', input);
export const loginUser = (input: LoginInput) => post<Session>('/auth/login', input);
export const logoutUser = () => post<{ ok: true }>('/auth/logout');

/** Se llama al cargar: la cookie es HttpOnly, así que solo el servidor sabe quien eres. */
export const fetchSession = () => get<Session>('/auth/me');
