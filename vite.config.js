import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
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
