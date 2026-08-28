import { firebaseEnabled } from './config.js';
import * as cloud from './firestore.js';
import * as local from './local.js';

/* One repository interface, two implementations. `screens/` never imports
   either directly — it goes through the store, which goes through here. */
export const repo = firebaseEnabled ? cloud : local;

export { firebaseEnabled, missingKeys, AI_MODEL } from './config.js';
export {
  subscribeAuth, signInWithGoogle, signInWithEmail, signUpWithEmail, signOutUser,
  authMessage, resendVerification,
} from './auth.js';
export { generateItinerary, aiAvailable } from './ai.js';
