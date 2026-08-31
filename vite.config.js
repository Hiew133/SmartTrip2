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
    /* 567 kB is firebase-firestore, and it is vendor code in its own chunk:
       nothing in it can be split out, it changes only when the SDK version
       does, and it is cached across deploys. Splitting further does not make
       it smaller — only not shipping it would, and that is blocked on
       backend/firebase.js importing getFirestore statically so that db() can
       stay synchronous for every call site in backend/firestore.js. Moving
       that import into the repository and loading the repository with a
       dynamic import would drop the whole chunk in demo mode.

       Until then the number is stated rather than warned about. The limit is
       set just above the real figure on purpose: if a chunk grows past this,
       something new has landed and it is worth looking at again. */
    chunkSizeWarningLimit: 600,
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
