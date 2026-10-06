import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The same renderer code served as a website. /api is proxied to the gateway so the
// site and API share an origin: no CORS, and the refresh cookie stays first-party.
export default defineConfig({
  root: fileURLToPath(new URL('./src/renderer', import.meta.url)),
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': process.env.ONEBOX_API_URL ?? 'http://localhost:4000' },
  },
  build: {
    outDir: fileURLToPath(new URL('./dist-web', import.meta.url)),
    emptyOutDir: true,
  },
});
