import { initializeApp } from 'firebase/app';
import { ReCaptchaEnterpriseProvider, ReCaptchaV3Provider, initializeAppCheck } from 'firebase/app-check';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import {
  aiBackend, aiLocation, appCheckSiteKey, appCheckUseEnterprise, firebaseConfig, firebaseEnabled,
} from './config.js';

/* One shared app instance, created lazily so that a build with no config
   never calls initializeApp (which throws on an empty apiKey). */

let app = null;
let authInstance = null;
let dbInstance = null;
let aiInstance = null;

/* App Check proves the request came from this app rather than a script with a
   copy of the public config. Firebase AI Logic refuses to serve a project at
   all unless App Check is enforced, so without this the AI desk gets a 403.

   Imported statically, not lazily: it has to attach to the app before Auth or
   Firestore send anything, otherwise those first requests carry no token. */
function attachAppCheck(instance) {
  if (!appCheckSiteKey) return;
  try {
    if (import.meta.env.DEV) {
      // prints a debug token to the console; register it under
      // App Check → Apps → Manage debug tokens so localhost is allowed
      self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    }
    initializeAppCheck(instance, {
      provider: appCheckUseEnterprise
        ? new ReCaptchaEnterpriseProvider(appCheckSiteKey)
        : new ReCaptchaV3Provider(appCheckSiteKey),
      isTokenAutoRefreshEnabled: true,
    });
  } catch (err) {
    // a bad site key must not take the whole app down with it
    console.error('SmartTrip · App Check:', err);
  }
}

function getApp() {
  if (!firebaseEnabled) return null;
  if (!app) {
    app = initializeApp(firebaseConfig);
    attachAppCheck(app);
  }
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

/* Firebase AI Logic talks to Gemini through the Firebase backend, so no Gemini
   or Google Cloud credential ever ships in the bundle — the request is
   authorised by App Check plus the signed-in user.

   Two backends serve the same models: Vertex AI (the default here) and the
   Gemini Developer API. Same SDK, same schemas, same answers; what differs is
   which Google Cloud API the project has to have enabled, and whether the
   inference is pinned to a region.

   The SDK module is passed in rather than imported here: it is loaded lazily
   by backend/ai.js, and doing it in one place keeps a single dynamic import
   to fail (and to report) instead of two. */
function aiBackendFrom(mod) {
  if (aiBackend === 'google') return new mod.GoogleAIBackend();

  /* Google renamed the Vertex AI Gemini API to "Agent Platform" and firebase
     12.18 deprecated VertexAIBackend in favour of AgentPlatformBackend. Both
     reach Vertex; prefer the current name and fall back so an older SDK — or
     a newer one that finally drops the deprecated class — still boots.
     Note the two defaults differ: 'global' for the new class, 'us-central1'
     for the old, which is why an explicit location is worth setting. */
  const Vertex = mod.AgentPlatformBackend || mod.VertexAIBackend;
  return aiLocation ? new Vertex(aiLocation) : new Vertex();
}

export function ai(mod) {
  if (!getApp()) return null;
  if (!aiInstance) aiInstance = mod.getAI(app, { backend: aiBackendFrom(mod) });
  return aiInstance;
}
