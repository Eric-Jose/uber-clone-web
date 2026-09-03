import { initializeApp } from 'firebase/app';
import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { BACKEND_URL } from './config';

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Object.values(firebaseConfig).every(Boolean);

let auth = null;
let persistenceReady = Promise.resolve(false);

if (isFirebaseConfigured) {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  persistenceReady = setPersistence(auth, browserLocalPersistence).then(() => true).catch(() => false);
}

export { auth, onAuthStateChanged };

export async function syncFirebaseLogin(email, password) {
  if (!auth) return null;
  await persistenceReady;
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    return result.user;
  } catch (error) {
    if (error?.code === 'auth/user-not-found') {
      try {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        return result.user;
      } catch (_) { return null; }
    }
    return null;
  }
}

export async function syncFirebaseRegistration(email, password) {
  if (!auth) return null;
  await persistenceReady;
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    return result.user;
  } catch (error) {
    if (error?.code === 'auth/email-already-in-use') {
      try {
        const result = await signInWithEmailAndPassword(auth, email, password);
        return result.user;
      } catch (_) { return null; }
    }
    return null;
  }
}

export async function syncBackendSession(firebaseUser) {
  if (!firebaseUser) return null;
  try {
    const idToken = await firebaseUser.getIdToken();
    const response = await fetch(`${BACKEND_URL}/api/admin/auth/firebase-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
      cache: 'no-store',
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.token || !data.user) return null;
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    return data;
  } catch (_) {
    return null;
  }
}

export async function logoutFirebase() {
  if (auth) await signOut(auth).catch(() => {});
}
