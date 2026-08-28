import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  /* firebase/ai is only ever reached through a dynamic import (see backend/ai.js),
     so Vite does not see it while scanning static imports at startup. It would
     discover it the first time someone opens the AI desk, re-optimise, and change
     the dep hash — leaving the import already in flight pointing at a URL that no
     longer exists ("Failed to fetch dynamically imported module"). Naming it here
     pre-bundles it up front; the dynamic import still keeps it out of the
     production entry chunk. */
  optimizeDeps: { include: ['firebase/ai'] },
  build: {
    rollupOptions: {
      output: {
        /* Firebase and Leaflet change far less often than the app itself, so
           they get their own chunks and stay cached across deploys. */
        manualChunks: {
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          leaflet: ['leaflet'],
        },
      },
    },
  },
});
