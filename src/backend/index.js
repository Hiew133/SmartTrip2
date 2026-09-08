import { firebaseEnabled } from './config.js';
import * as cloud from './firestore.js';
import * as local from './local.js';

/* One repository interface, two implementations. `screens/` never imports
   either directly — it goes through the store, which goes through here. */
export const repo = firebaseEnabled ? cloud : local;

export { firebaseEnabled, missingKeys, AI_MODEL } from './config.js';
export {
  subscribeAuth, signInWithGoogle, signInWithEmail, signUpWithEmail, signOutUser,
  authMessage, resendVerification, refreshUser, verifyDemoEmail,
} from './auth.js';
export { generateItinerary, generateGuide, askAssistant, translateText, aiAvailable } from './ai.js';
/* The device's own store, not a repository: it has one implementation and it
   is the same one in demo mode and in production. See backend/offline.js. */
export { readPhrases, savePhrase, forgetPhrases } from './offline.js';
