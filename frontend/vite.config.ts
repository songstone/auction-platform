import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The target is a server-side development/test setting; it is never a browser secret.
const apiProxy = { '/api': { target: process.env.AUCTION_API_TARGET ?? 'http://127.0.0.1:8080', changeOrigin: false } };

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: apiProxy,
  },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true, proxy: apiProxy },
});
