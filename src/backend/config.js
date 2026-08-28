/* Firebase configuration, read from Vite env vars at build time.

   The app has to stay runnable with no Firebase project attached — that is how
   the design mockups get reviewed and how a fresh clone behaves before anyone
   creates a project. So every backend module below ships two implementations
   behind one interface: Firestore/Auth/AI Logic when a config is present, and
   a localStorage stand-in when it is not. Nothing in `screens/` knows which. */

const env = import.meta.env;

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

/* App Check: the reCAPTCHA site key from Firebase Console → App Check.
   Firebase AI Logic will not serve a project unless App Check is enforced. */
export const appCheckSiteKey = env.VITE_FIREBASE_APPCHECK_SITE_KEY || '';
export const appCheckUseEnterprise = env.VITE_FIREBASE_APPCHECK_ENTERPRISE === 'true';

/** The Gemini model used by the AI desk. Override per project if needed. */
export const AI_MODEL = env.VITE_GEMINI_MODEL || 'gemini-3.5-flash';

const REQUIRED = ['apiKey', 'authDomain', 'projectId', 'appId'];

/** True only when a real project is wired up; drives the demo-mode fallback. */
export const firebaseEnabled = REQUIRED.every((k) => typeof firebaseConfig[k] === 'string' && firebaseConfig[k]);

export const missingKeys = REQUIRED
  .filter((k) => !firebaseConfig[k])
  .map((k) => `VITE_FIREBASE_${k.replace(/[A-Z]/g, (c) => `_${c}`).toUpperCase()}`);
