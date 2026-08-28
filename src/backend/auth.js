import {
  GoogleAuthProvider, createUserWithEmailAndPassword, onAuthStateChanged,
  sendEmailVerification, signInWithEmailAndPassword, signInWithPopup, signOut,
  updateProfile,
} from 'firebase/auth';
import { firebaseEnabled } from './config.js';
import { auth } from './firebase.js';

const DEMO_KEY = 'smarttrip-demo-user';

/** Shape the rest of the app sees, whichever backend is behind it. */
const shape = (u) => (u ? {
  uid: u.uid,
  name: u.displayName || (u.email ? u.email.split('@')[0] : 'Bạn'),
  email: u.email || '',
  photoURL: u.photoURL || null,
  // claiming an invitation requires a verified address; Google sign-in is
  // verified already, email/password has to confirm the link first
  emailVerified: u.emailVerified === true,
  /* Which button they signed in with. The profile screen explains the
     verification step only to the accounts that actually have to do it —
     a Google account arrives verified and has nothing to click. */
  provider: u.providerData?.[0]?.providerId || u.provider || 'password',
} : null);

/* Firebase surfaces failures as codes; the screens want a sentence in Vietnamese. */
const MESSAGES = {
  'auth/invalid-email': 'Email chưa đúng định dạng.',
  'auth/missing-password': 'Nhập mật khẩu để tiếp tục.',
  'auth/weak-password': 'Mật khẩu cần ít nhất 6 ký tự.',
  'auth/email-already-in-use': 'Email này đã có tài khoản. Hãy đăng nhập.',
  'auth/invalid-credential': 'Email hoặc mật khẩu không đúng.',
  'auth/wrong-password': 'Email hoặc mật khẩu không đúng.',
  'auth/user-not-found': 'Chưa có tài khoản nào dùng email này.',
  'auth/too-many-requests': 'Thử quá nhiều lần. Đợi một lát rồi thử lại.',
  'auth/popup-closed-by-user': 'Cửa sổ đăng nhập đã bị đóng.',
  'auth/popup-blocked': 'Trình duyệt chặn cửa sổ đăng nhập. Cho phép popup rồi thử lại.',
  'auth/network-request-failed': 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.',
  'auth/operation-not-allowed': 'Phương thức đăng nhập này chưa được bật trong Firebase Console.',
};

export const authMessage = (err) =>
  MESSAGES[err?.code] || err?.message || 'Không đăng nhập được. Thử lại giúp mình.';

/* ── demo mode: no project attached ─────────────────────────────────────── */

const demoListeners = new Set();
let demoUser = null;
try {
  const raw = localStorage.getItem(DEMO_KEY);
  if (raw) demoUser = JSON.parse(raw);
} catch { /* private mode */ }

function setDemoUser(u) {
  demoUser = u;
  try {
    if (u) localStorage.setItem(DEMO_KEY, JSON.stringify(u));
    else localStorage.removeItem(DEMO_KEY);
  } catch { /* private mode */ }
  demoListeners.forEach((cb) => cb(u));
}

/* Demo mode models the real verification state rather than hard-coding it to
   true: a Google account is verified on arrival, an email/password account is
   not until it confirms. Otherwise the profile screen has nothing to show in
   the one mode a fresh clone actually runs in. */
const demoSignIn = (email, name, { verified = true, provider = 'password' } = {}) => {
  setDemoUser({
    uid: 'demo-user', name: name || (email ? email.split('@')[0] : 'Minh Trần'),
    email: email || 'demo@smarttrip.vn', photoURL: null,
    emailVerified: verified, provider,
  });
  return Promise.resolve(demoUser);
};

/* ── public API ─────────────────────────────────────────────────────────── */

/** Calls back with the current user (or null) now and on every change. */
export function subscribeAuth(cb) {
  if (!firebaseEnabled) {
    demoListeners.add(cb);
    cb(demoUser);
    return () => demoListeners.delete(cb);
  }
  return onAuthStateChanged(auth(), (u) => cb(shape(u)));
}

export async function signInWithGoogle() {
  if (!firebaseEnabled) {
    return demoSignIn('minh.tran@gmail.com', 'Minh Trần', { provider: 'google.com' });
  }
  const cred = await signInWithPopup(auth(), new GoogleAuthProvider());
  return shape(cred.user);
}

export async function signInWithEmail(email, password) {
  if (!firebaseEnabled) {
    /* Signing back into the same demo address keeps whatever it had confirmed;
       a different address starts unverified, the way a new account would. */
    const known = !!demoUser && demoUser.email?.toLowerCase() === String(email).toLowerCase();
    return demoSignIn(email, known ? demoUser.name : undefined, {
      verified: known ? demoUser.emailVerified === true : false,
    });
  }
  const cred = await signInWithEmailAndPassword(auth(), email, password);
  return shape(cred.user);
}

export async function signUpWithEmail(name, email, password) {
  if (!firebaseEnabled) return demoSignIn(email, name, { verified: false });
  const cred = await createUserWithEmailAndPassword(auth(), email, password);
  if (name) await updateProfile(cred.user, { displayName: name });
  /* Claiming an invitation needs a verified address — the rules insist on it,
     otherwise anyone could sign up as someone else and walk into their trip.
     Google sign-in arrives verified; this path has to ask. */
  try {
    await sendEmailVerification(cred.user);
  } catch (err) {
    console.error('SmartTrip · gửi email xác minh:', err);
  }
  /* Shaped from the real user object, then the name laid over the top:
     updateProfile has landed on the server but the local copy can still be
     one beat behind, and spreading a User instance loses its accessors. */
  const me = shape(cred.user);
  return name ? { ...me, name } : me;
}

/* emailVerified is baked into the session at sign-in, so clicking the link in
   a mail client changes nothing here until the user object is reloaded. This
   is what the "Tôi đã xác minh xong" button calls. */
export async function refreshUser() {
  if (!firebaseEnabled) return demoUser;
  const u = auth().currentUser;
  if (!u) return null;
  await u.reload();
  return shape(auth().currentUser);
}

/** Send the confirmation link again, for an account that never clicked it. */
export async function resendVerification() {
  if (!firebaseEnabled) return;
  const u = auth().currentUser;
  if (u && !u.emailVerified) await sendEmailVerification(u);
}

/* Demo mode has no mailbox, so there is no link to click. This is the stand-in
   for clicking it — the only way to reach the verified state without a Firebase
   project — and it refuses to run when a real one is attached, where the
   address is confirmed by Firebase or not at all. */
export async function verifyDemoEmail() {
  if (firebaseEnabled) throw new Error('Chỉ dùng được ở chế độ thử.');
  if (!demoUser) return null;
  setDemoUser({ ...demoUser, emailVerified: true });
  return demoUser;
}

export async function signOutUser() {
  if (!firebaseEnabled) { setDemoUser(null); return; }
  await signOut(auth());
}
