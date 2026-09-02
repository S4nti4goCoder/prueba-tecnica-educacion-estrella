import { URL, fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = env.API_PROXY_TARGET;

  if (mode === 'development' && !target) {
    console.warn('\n  API_PROXY_TARGET no está definido en .env.local: las llamadas a /api fallarán.\n');
  }

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      // Refleja el rewrite de Amplify: mismo origen tambien en desarrollo, para que la
      // cookie de sesión se comporte igual aquí y en producción.
      proxy: target
        ? {
            '/api': {
              target,
              changeOrigin: true,
              rewrite: (path) => path.replace(/^\/api/, ''),
            },
          }
        : undefined,
    },
  };
});
