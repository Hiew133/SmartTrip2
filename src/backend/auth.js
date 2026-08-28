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

const demoSignIn = (email, name) => {
  setDemoUser({
    uid: 'demo-user', name: name || (email ? email.split('@')[0] : 'Minh Trần'),
    email: email || 'demo@smarttrip.vn', photoURL: null, emailVerified: true,
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
  if (!firebaseEnabled) return demoSignIn('minh.tran@gmail.com', 'Minh Trần');
  const cred = await signInWithPopup(auth(), new GoogleAuthProvider());
  return shape(cred.user);
}

export async function signInWithEmail(email, password) {
  if (!firebaseEnabled) return demoSignIn(email);
  const cred = await signInWithEmailAndPassword(auth(), email, password);
  return shape(cred.user);
}

export async function signUpWithEmail(name, email, password) {
  if (!firebaseEnabled) return demoSignIn(email, name);
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
  return shape({ ...cred.user, displayName: name || cred.user.displayName });
}

/** Send the confirmation link again, for an account that never clicked it. */
export async function resendVerification() {
  if (!firebaseEnabled) return;
  const u = auth().currentUser;
  if (u && !u.emailVerified) await sendEmailVerification(u);
}

export async function signOutUser() {
  if (!firebaseEnabled) { setDemoUser(null); return; }
  await signOut(auth());
}
