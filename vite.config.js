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
           they get their own chunks and stay cached across deploys.

           Firebase is split by SDK rather than shipped as one 700 kB lump.
           This is not a smaller download — all three are needed at boot — but
           they version independently, so updating one no longer invalidates
           the cache for the others, and the split shows where the weight
           actually is: firestore 567 kB, auth 127 kB, app 26 kB.

           The 500 kB warning still fires, on firestore. Splitting cannot fix
           that; only not shipping it can, and it ships even in demo mode
           because backend/index.js imports both repositories statically to
           choose between them. Making the cloud one a dynamic import would
           fix it, and would turn `repo` into something every call site has
           to await. */
        manualChunks: {
          'firebase-core': ['firebase/app', 'firebase/app-check'],
          'firebase-auth': ['firebase/auth'],
          'firebase-firestore': ['firebase/firestore'],
          leaflet: ['leaflet'],
        },
      },
    },
  },
});
