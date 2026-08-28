import { initializeApp } from 'firebase/app';
import { ReCaptchaEnterpriseProvider, ReCaptchaV3Provider, initializeAppCheck } from 'firebase/app-check';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { appCheckSiteKey, appCheckUseEnterprise, firebaseConfig, firebaseEnabled } from './config.js';

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

/* Firebase AI Logic talks to the Gemini Developer API through the Firebase
   backend, so the Gemini key never ships in the bundle.

   The SDK module is passed in rather than imported here: it is loaded lazily
   by backend/ai.js, and doing it in one place keeps a single dynamic import
   to fail (and to report) instead of two. */
export function ai(mod) {
  if (!getApp()) return null;
  if (!aiInstance) aiInstance = mod.getAI(app, { backend: new mod.GoogleAIBackend() });
  return aiInstance;
}
