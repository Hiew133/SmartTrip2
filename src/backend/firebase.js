import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { firebaseConfig, firebaseEnabled } from './config.js';

/* One shared app instance, created lazily so that a build with no config
   never calls initializeApp (which throws on an empty apiKey). */

let app = null;
let authInstance = null;
let dbInstance = null;
let aiInstance = null;

function getApp() {
  if (!firebaseEnabled) return null;
  if (!app) app = initializeApp(firebaseConfig);
  return app;
}

export function auth() {
  if (!getApp()) return null;
  if (!authInstance) authInstance = getAuth(app);
  return authInstance;
}

export function db() {
  if (!getApp()) return null;
  if (!dbInstance) dbInstance = getFirestore(app);
  return dbInstance;
}

/* Firebase AI Logic talks to the Gemini Developer API through the Firebase
   backend, so the Gemini key never ships in the bundle — the project's
   App Check / API restrictions guard it instead of a secret in the client. */
export async function ai() {
  if (!getApp()) return null;
  if (!aiInstance) {
    // dynamic: the Gemini SDK is a large chunk only the AI desk ever needs
    const { getAI, GoogleAIBackend } = await import('firebase/ai');
    aiInstance = getAI(app, { backend: new GoogleAIBackend() });
  }
  return aiInstance;
}
