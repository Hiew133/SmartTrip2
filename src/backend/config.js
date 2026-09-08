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

/* Which Firebase AI Logic backend serves Gemini.

   Vertex AI is the default: it is the enterprise-grade path, it is the one
   with regional control, and the planning features are the reason this app
   exists. Set VITE_FIREBASE_AI_BACKEND=google to go back through the Gemini
   Developer API instead — the request, the schema and the answer are the same
   either way, so this switch is a deployment decision, not a code one. */
export const aiBackend = env.VITE_FIREBASE_AI_BACKEND === 'google' ? 'google' : 'vertex';

/* Region for the Vertex AI backend. Empty means the SDK default, which is
   what a project without a data-residency requirement should use — pinning a
   region you have not enabled is a 404 on the first request. */
export const aiLocation = env.VITE_FIREBASE_AI_LOCATION || '';

/* Place search. Empty is a supported configuration, not a missing one: without
   a key the app falls back to Nominatim (OpenStreetMap), which needs no
   account. Goong is better on Vietnamese addresses, so it wins when present. */
export const goongApiKey = env.VITE_GOONG_API_KEY || '';

/* Goong issues two keys and they are not interchangeable: the REST key above
   opens rsapi.goong.io (geocoding, Direction, DistanceMatrix), and this one
   opens tiles.goong.io for the basemap itself. Either can be set without the
   other, so they are read as two settings rather than one. Empty means the
   map keeps using OpenStreetMap raster tiles. */
export const goongMapTilesKey = env.VITE_GOONG_MAPTILES_KEY || '';

/** Which of Goong's hosted styles to draw; validated against MAP_STYLES in maps.js. */
export const goongMapStyle = env.VITE_GOONG_MAP_STYLE || '';

const REQUIRED = ['apiKey', 'authDomain', 'projectId', 'appId'];

/** True only when a real project is wired up; drives the demo-mode fallback. */
export const firebaseEnabled = REQUIRED.every((k) => typeof firebaseConfig[k] === 'string' && firebaseConfig[k]);

export const missingKeys = REQUIRED
  .filter((k) => !firebaseConfig[k])
  .map((k) => `VITE_FIREBASE_${k.replace(/[A-Z]/g, (c) => `_${c}`).toUpperCase()}`);
