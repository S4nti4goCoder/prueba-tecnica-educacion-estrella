import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from '@/components/ui/sonner';
import App from './App.tsx';
import { SessionProvider } from './features/auth/SessionProvider.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SessionProvider>
      <App />
      <Toaster richColors position="top-center" />
    </SessionProvider>
  </StrictMode>,
);
