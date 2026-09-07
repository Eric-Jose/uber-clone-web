import { initializeApp } from 'firebase/app';
import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  FacebookAuthProvider,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
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

export async function loginWithFirebasePassword(email, password) {
  if (!auth) throw new Error('Firebase não está configurado no aplicativo.');
  await persistenceReady;
  const result = await signInWithEmailAndPassword(auth, email, password);
  return result.user;
}

export async function syncFirebaseLogin(email, password) {
  if (!auth) return null;
  await persistenceReady;
  try {
    return await loginWithFirebasePassword(email, password);
  } catch (_) {
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

export async function signInWithSocialProvider(providerName) {
  if (!auth) throw new Error('Login social indisponível: Firebase não está configurado no aplicativo.');
  await persistenceReady;
  const provider = providerName === 'facebook' ? new FacebookAuthProvider() : new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const result = await signInWithPopup(auth, provider);
  return result.user;
}

export async function syncBackendSession(firebaseUser) {
  if (!firebaseUser) return null;
  try {
    const idToken = await firebaseUser.getIdToken(true);
    const response = await fetch(`${BACKEND_URL}/api/auth/firebase-session`, {
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

// Recupera contas que continuam autenticadas no Firebase quando o JWT local
// do PreçoFixo17 foi perdido (por exemplo, após limpar o storage, trocar de
// dispositivo ou atualizar o navegador). O backend também recupera o perfil
// por e-mail quando ele estiver salvo sob um UID Firebase legado.
if (auth && typeof window !== 'undefined') {
  onAuthStateChanged(auth, async (firebaseUser) => {
    if (!firebaseUser) return;

    const hadBackendSession = Boolean(localStorage.getItem('token') && localStorage.getItem('user'));
    if (hadBackendSession) return;

    const recoveryKey = `pf17-auth-recovery:${firebaseUser.uid}`;
    if (sessionStorage.getItem(recoveryKey)) return;
    sessionStorage.setItem(recoveryKey, '1');

    try {
      await persistenceReady;
      const data = await syncBackendSession(firebaseUser);
      if (data?.token && data?.user) {
        // O App lê a sessão no carregamento inicial. Recarregar somente quando
        // a sessão backend foi restaurada evita deixar a tela parada em login.
        window.location.reload();
      } else {
        sessionStorage.removeItem(recoveryKey);
      }
    } catch (_) {
      sessionStorage.removeItem(recoveryKey);
    }
  });
}

export async function logoutFirebase() {
  if (auth) await signOut(auth).catch(() => {});
}
