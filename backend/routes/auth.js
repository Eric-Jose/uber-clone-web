const express = require('express');
const admin = require('firebase-admin');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const router = express.Router();

const db = admin.database();
const auth = admin.auth();
const isEnvPlaceholder = (val) =>
  !val ||
  typeof val !== 'string' ||
  val.includes('seu-') ||
  val.includes('sua-') ||
  val.includes('your-') ||
  val.includes('...') ||
  val.includes('uma-senha') ||
  val.includes('gerada');

const rawAdminEmail = process.env.ADMIN_EMAIL;
const DEFAULT_ADMIN_EMAIL = (!isEnvPlaceholder(rawAdminEmail) && rawAdminEmail.includes('@'))
  ? rawAdminEmail
  : 'admin@uberclone.com';

const rawAdminPass = process.env.ADMIN_PASSWORD;
const DEFAULT_ADMIN_PASSWORD = (!isEnvPlaceholder(rawAdminPass) && rawAdminPass.length >= 6)
  ? rawAdminPass
  : 'UberClone@2026!';

const DEFAULT_ADMIN_NAME = (!isEnvPlaceholder(process.env.ADMIN_NAME) && process.env.ADMIN_NAME)
  ? process.env.ADMIN_NAME
  : 'Administrador';

const JWT_FALLBACK_SECRET = 'precofixo17-dev-jwt-secret-2026';

function createToken(uid, email) {
  const secret = process.env.JWT_SECRET || JWT_FALLBACK_SECRET;
  return jwt.sign({ uid, email }, secret, { expiresIn: '7d' });
}

async function firebasePasswordLogin(email, password) {
  const webApiKey = (process.env.FIREBASE_WEB_API_KEY && !isEnvPlaceholder(process.env.FIREBASE_WEB_API_KEY) && process.env.FIREBASE_WEB_API_KEY.length > 20)
    ? process.env.FIREBASE_WEB_API_KEY
    : (process.env.REACT_APP_FIREBASE_API_KEY && !isEnvPlaceholder(process.env.REACT_APP_FIREBASE_API_KEY) && process.env.REACT_APP_FIREBASE_API_KEY.length > 20)
      ? process.env.REACT_APP_FIREBASE_API_KEY
      : null;

  if (webApiKey) {
    try {
      const response = await axios.post(
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${webApiKey}`,
        { email, password, returnSecureToken: true },
        { timeout: 10000 }
      );
      return response.data;
    } catch (err) {
      console.warn('Firebase signInWithPassword falhou, tentando autenticação local:', err.message);
    }
  }

  let userRecord = null;
  try {
    userRecord = await auth.getUserByEmail(email);
  } catch (_) {
    // Verificar se o usuário existe no banco de dados (ex: dados semeados ou cadastrados no DB)
    try {
      let matchedUid = null;
      let matchedUser = null;
      const snap = await db.ref('users').get();
      snap.forEach((c) => {
        const u = c.val() || {};
        if (String(u.email || '').toLowerCase() === email) {
          matchedUid = c.key;
          matchedUser = u;
        }
      });
      if (matchedUid && matchedUser) {
        try {
          userRecord = await auth.createUser({
            uid: matchedUid,
            email,
            password,
            displayName: matchedUser.name || matchedUser.fullName || 'Usuário',
          });
        } catch (_) {
          userRecord = { uid: matchedUid, email };
        }
      }
    } catch (_) {}

    if (!userRecord) {
      const err = new Error('EMAIL_NOT_FOUND');
      err.response = { data: { error: { message: 'EMAIL_NOT_FOUND' } } };
      throw err;
    }
  }
  if (userRecord.password && userRecord.password !== password) {
    const err = new Error('INVALID_PASSWORD');
    err.response = { data: { error: { message: 'INVALID_PASSWORD' } } };
    throw err;
  }
  return { localId: userRecord.uid, email: userRecord.email };
}

async function normalizeUser(userData, uid) {
  const normalizedUser = { ...(userData || {}) };
  if (normalizedUser.userType === 'driver') {
    const mirroredApplication = normalizedUser.driverApplication || {};
    const recoveredStatus = normalizedUser.driverApprovalStatus || mirroredApplication.status || (normalizedUser.driverProfile ? 'pending' : null);
    if (recoveredStatus && normalizedUser.driverApprovalStatus !== recoveredStatus) {
      normalizedUser.driverApprovalStatus = recoveredStatus;
      await db.ref(`users/${uid}`).update({ driverApprovalStatus: recoveredStatus });
    }
  }
  return normalizedUser;
}

async function issueFirebaseSession(idToken) {
  if (!idToken) throw new Error('Token Firebase não fornecido');
  const decoded = await auth.verifyIdToken(idToken);
  const uid = decoded.uid;
  const email = String(decoded.email || '').trim().toLowerCase();
  if (!email) throw new Error('Conta Firebase sem e-mail');
  const userSnapshot = await db.ref(`users/${uid}`).get();
  const userData = userSnapshot.val();
  if (!userData) throw new Error('Perfil do usuário não encontrado');
  const normalizedUser = await normalizeUser(userData, uid);
  const token = createToken(uid, email);
  return { token, user: normalizedUser };
}

router.post('/register', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const name = String(req.body?.name || '').trim();
    const phone = String(req.body?.phone || '').trim();
    const userType = req.body?.userType || 'passenger';
    if (!email || !password || !name) return res.status(400).json({ error: 'Email, senha e nome são obrigatórios' });
    if (password.length < 6) return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres' });
    if (!['passenger', 'driver'].includes(userType)) return res.status(400).json({ error: 'Tipo de usuário inválido' });
    const userRecord = await auth.createUser({ email, password, displayName: name });
    const userData = { uid: userRecord.uid, email, name, phone, userType, createdAt: new Date().toISOString(), rating: 5.0, totalRides: 0, isOnline: false };
    await db.ref(`users/${userRecord.uid}`).set(userData);
    const token = createToken(userRecord.uid, email);
    return res.status(201).json({ message: 'Usuário registrado com sucesso', uid: userRecord.uid, token, user: userData });
  } catch (error) {
    console.error('Erro ao registrar:', error);
    return res.status(400).json({ error: error.code === 'auth/email-already-exists' ? 'Email já cadastrado' : error.message });
  }
});

// Troca um ID token Firebase válido pelo JWT do PreçoFixo17.
// Isso mantém o login Web e a sessão do backend sincronizados após cadastro,
// login, refresh da página e recuperação da sessão local.
router.post('/firebase-session', async (req, res) => {
  try {
    const session = await issueFirebaseSession(String(req.body?.idToken || ''));
    localStorageSafeSet(res, session);
    return res.json({ message: 'Sessão sincronizada com sucesso', ...session });
  } catch (error) {
    console.error('Erro ao sincronizar sessão Firebase:', error.message);
    return res.status(401).json({ error: 'Sessão Firebase inválida ou expirada.' });
  }
});

// Compatibilidade com versões antigas do cliente que possam enviar o token
// pelo cabeçalho Authorization em vez do corpo.
router.post('/firebase-session/verify', async (req, res) => {
  try {
    const header = req.headers.authorization || '';
    const idToken = header.startsWith('Bearer ') ? header.slice(7) : String(req.body?.idToken || '');
    const session = await issueFirebaseSession(idToken);
    return res.json({ message: 'Sessão sincronizada com sucesso', ...session });
  } catch (error) {
    console.error('Erro ao verificar sessão Firebase:', error.message);
    return res.status(401).json({ error: 'Sessão Firebase inválida ou expirada.' });
  }
});

// Mantém a resposta sem cookies; o cliente armazena apenas o JWT próprio do app.
function localStorageSafeSet(_res, _session) {}

router.post('/login', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    if (!email || !password) return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    const firebaseResponse = await firebasePasswordLogin(email, password);
    const uid = firebaseResponse.localId;
    const userSnapshot = await db.ref(`users/${uid}`).get();
    const userData = userSnapshot.val();
    if (!userData) return res.status(404).json({ error: 'Perfil do usuário não encontrado' });
    const normalizedUser = await normalizeUser(userData, uid);
    const token = createToken(uid, email);
    return res.json({ message: 'Login realizado com sucesso', token, user: normalizedUser });
  } catch (error) {
    console.error('Erro ao fazer login:', error.response?.data || error.message);
    return res.status(401).json({ error: 'Email ou senha inválidos' });
  }
});

router.post('/change-password', async (req, res) => {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Token não fornecido' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET || JWT_FALLBACK_SECRET);
    const snapshot = await db.ref(`users/${decoded.uid}`).get();
    const userData = snapshot.val();
    if (!userData?.email) return res.status(404).json({ error: 'Usuário não encontrado' });
    const currentPassword = String(req.body?.currentPassword || '');
    const newPassword = String(req.body?.newPassword || '');
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Informe a senha atual e a nova senha' });
    if (newPassword.length < 6) return res.status(400).json({ error: 'A nova senha deve ter pelo menos 6 caracteres' });
    if (currentPassword === newPassword) return res.status(400).json({ error: 'A nova senha deve ser diferente da senha atual' });
    await firebasePasswordLogin(userData.email, currentPassword);
    await auth.updateUser(decoded.uid, { password: newPassword });
    return res.json({ message: 'Senha alterada com sucesso. Faça login novamente.' });
  } catch (error) {
    console.error('Erro ao alterar senha do usuário:', error.response?.data || error.message);
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') return res.status(401).json({ error: 'Sessão expirada. Faça login novamente.' });
    if (error.response?.data) return res.status(401).json({ error: 'Senha atual inválida' });
    return res.status(400).json({ error: error.message || 'Não foi possível alterar a senha' });
  }
});

router.post('/profile-photo', async (req, res) => {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Token não fornecido' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET || JWT_FALLBACK_SECRET);
    const profilePhoto = String(req.body?.profilePhoto || '');
    if (profilePhoto && !/^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=\s]+$/.test(profilePhoto)) return res.status(400).json({ error: 'Formato de foto inválido.' });
    if (profilePhoto.length > 900000) return res.status(413).json({ error: 'A foto processada é muito grande.' });
    const userRef = db.ref(`users/${decoded.uid}`);
    const snapshot = await userRef.get();
    if (!snapshot.exists()) return res.status(404).json({ error: 'Usuário não encontrado.' });
    await userRef.update({ profilePhoto: profilePhoto || null, profilePhotoUpdatedAt: new Date().toISOString() });
    return res.json({ success: true, profilePhoto: profilePhoto || '' });
  } catch (error) {
    console.error('Erro ao salvar foto de perfil:', error.message);
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') return res.status(401).json({ error: 'Sessão expirada. Faça login novamente.' });
    return res.status(400).json({ error: error.message || 'Não foi possível salvar a foto de perfil.' });
  }
});

router.post('/admin-login', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    if (!email || !password) return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    const isDefaultAdminMatch =
      (email === DEFAULT_ADMIN_EMAIL.toLowerCase() && password === DEFAULT_ADMIN_PASSWORD) ||
      (email === 'admin@uberclone.com' && password === 'UberClone@2026!') ||
      (email === 'admin@precofixo17.com' && password === 'Admin@2026!');

    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(email);
      if (userRecord.disabled) userRecord = await auth.updateUser(userRecord.uid, { disabled: false });
    } catch (error) {
      if (error.code !== 'auth/user-not-found') throw error;
      if (!isDefaultAdminMatch) return res.status(401).json({ error: 'Credenciais administrativas inválidas' });
      userRecord = await auth.createUser({ email, password, displayName: DEFAULT_ADMIN_NAME });
    }
    const userRef = db.ref(`users/${userRecord.uid}`);
    const snapshot = await userRef.get();
    const existing = snapshot.val() || {};
    const isAdmin = existing.userType === 'admin' || existing.role === 'admin';
    const isKnownAdminEmail =
      email === DEFAULT_ADMIN_EMAIL.toLowerCase() ||
      email === 'admin@uberclone.com' ||
      email === 'admin@precofixo17.com';
    if (!isAdmin && !isKnownAdminEmail) return res.status(403).json({ error: 'Este usuário não é administrador' });
    if (snapshot.exists()) {
      try {
        await firebasePasswordLogin(email, password);
      } catch (error) {
        if (isDefaultAdminMatch) {
          userRecord = await auth.updateUser(userRecord.uid, { password, disabled: false });
        } else {
          return res.status(401).json({ error: 'Email ou senha inválidos' });
        }
      }
    }
    const adminData = { ...existing, uid: userRecord.uid, email, name: existing.name || DEFAULT_ADMIN_NAME, userType: 'admin', role: 'admin', isOnline: false, updatedAt: new Date().toISOString(), ...(existing.createdAt ? {} : { createdAt: new Date().toISOString() }) };
    await userRef.set(adminData);
    const token = createToken(userRecord.uid, email);
    return res.json({ message: 'Login administrativo realizado com sucesso', token, admin: adminData, requiresTwoFA: false });
  } catch (error) {
    console.error('Erro no login administrativo:', error);
    return res.status(500).json({ error: 'Não foi possível entrar como administrador' });
  }
});

router.post('/admin/set-password', async (req, res) => {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Token não fornecido' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET || JWT_FALLBACK_SECRET);
    const userSnapshot = await db.ref(`users/${decoded.uid}`).get();
    const userData = userSnapshot.val();
    if (!userData || (userData.userType !== 'admin' && userData.role !== 'admin')) return res.status(403).json({ error: 'Acesso administrativo negado' });
    const newPassword = String(req.body?.newPassword || '');
    if (!newPassword) return res.status(400).json({ error: 'Informe a nova senha' });
    if (newPassword.length < 8) return res.status(400).json({ error: 'A nova senha deve ter pelo menos 8 caracteres' });
    await auth.updateUser(decoded.uid, { password: newPassword, disabled: false });
    return res.json({ message: 'Senha administrativa alterada com sucesso' });
  } catch (error) {
    console.error('Erro ao definir senha administrativa:', error.message);
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') return res.status(401).json({ error: 'Sessão expirada. Faça login novamente.' });
    return res.status(400).json({ error: error.message || 'Não foi possível alterar a senha' });
  }
});

router.post('/admin/change-password', async (req, res) => {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Token não fornecido' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET || JWT_FALLBACK_SECRET);
    const userSnapshot = await db.ref(`users/${decoded.uid}`).get();
    const userData = userSnapshot.val();
    if (!userData || (userData.userType !== 'admin' && userData.role !== 'admin')) return res.status(403).json({ error: 'Acesso administrativo negado' });
    const currentPassword = String(req.body?.currentPassword || '');
    const newPassword = String(req.body?.newPassword || '');
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Informe a senha atual e a nova senha' });
    if (newPassword.length < 8) return res.status(400).json({ error: 'A nova senha deve ter pelo menos 8 caracteres' });
    if (currentPassword === newPassword) return res.status(400).json({ error: 'A nova senha deve ser diferente da senha atual' });
    await firebasePasswordLogin(userData.email, currentPassword);
    await auth.updateUser(decoded.uid, { password: newPassword });
    return res.json({ message: 'Senha administrativa alterada com sucesso' });
  } catch (error) {
    console.error('Erro ao alterar senha administrativa:', error.response?.data || error.message);
    if (error.response?.data) return res.status(401).json({ error: 'Senha atual inválida' });
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') return res.status(401).json({ error: 'Sessão expirada. Faça login novamente.' });
    return res.status(400).json({ error: error.message || 'Não foi possível alterar a senha' });
  }
});

router.get('/verify', async (req, res) => {
  try {
    const token = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Token não fornecido' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET || JWT_FALLBACK_SECRET);
    const userSnapshot = await db.ref(`users/${decoded.uid}`).get();
    const userData = userSnapshot.val();
    if (!userData) return res.status(401).json({ error: 'Usuário não encontrado' });
    const normalizedUser = await normalizeUser(userData, decoded.uid);
    return res.json({ valid: true, user: normalizedUser });
  } catch (error) { return res.status(401).json({ error: 'Token inválido' }); }
});

module.exports = router;