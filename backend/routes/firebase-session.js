const express = require('express');
const admin = require('firebase-admin');
const jwt = require('jsonwebtoken');

const router = express.Router();
const db = admin.database();
const auth = admin.auth();

function createToken(uid, email) {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET não configurado');
  return jwt.sign({ uid, email }, process.env.JWT_SECRET, { expiresIn: '7d' });
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

async function findExistingUserByEmail(email, uid) {
  const snapshot = await db.ref('users')
    .orderByChild('email')
    .equalTo(email)
    .limitToFirst(10)
    .get();

  let match = null;
  snapshot.forEach((child) => {
    if (!match && child.key !== uid && child.val()) match = { key: child.key, value: child.val() };
  });
  return match;
}

async function recoverUserProfile(uid, email, decoded) {
  const userRef = db.ref(`users/${uid}`);
  const directSnapshot = await userRef.get();
  let user = directSnapshot.val();

  if (user) {
    const patch = {};
    if (!user.uid) patch.uid = uid;
    if (!user.email) patch.email = email;
    if (!user.name && decoded.name) patch.name = String(decoded.name).trim();
    if (!user.profilePhoto && decoded.picture) patch.profilePhoto = decoded.picture;
    if (Object.keys(patch).length) {
      await userRef.update(patch);
      user = { ...user, ...patch };
    }
    return user;
  }

  // Recover an existing profile that is stored under a legacy Firebase UID.
  const legacy = await findExistingUserByEmail(email, uid);
  if (legacy) {
    const recovered = {
      ...legacy.value,
      uid,
      email,
      recoveredFromUid: legacy.key,
      recoveredAt: new Date().toISOString(),
    };
    await userRef.set(recovered);
    await db.ref(`users/${legacy.key}`).remove();
    return recovered;
  }

  const provider = decoded.firebase?.sign_in_provider || 'firebase';
  user = {
    uid,
    email,
    name: String(decoded.name || decoded.email?.split('@')[0] || 'Usuário').trim(),
    phone: String(decoded.phone_number || '').trim(),
    userType: 'passenger',
    rating: 5.0,
    totalRides: 0,
    isOnline: false,
    profilePhoto: decoded.picture || null,
    authProvider: provider,
    createdAt: new Date().toISOString(),
  };
  await userRef.set(user);
  return user;
}

router.post('/', async (req, res) => {
  try {
    const idToken = String(req.body?.idToken || '').trim();
    if (!idToken) return res.status(400).json({ error: 'idToken é obrigatório.' });
    const decoded = await auth.verifyIdToken(idToken, true);
    const uid = decoded.uid;
    const email = String(decoded.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ error: 'A conta Firebase não possui email válido.' });

    let user = await recoverUserProfile(uid, email, decoded);
    user = await normalizeUser(user, uid);
    const token = createToken(uid, email);
    return res.json({ success: true, token, user });
  } catch (error) {
    console.error('Erro ao sincronizar sessão Firebase:', error.message);
    if (error?.code === 'auth/id-token-expired' || error?.code === 'auth/id-token-revoked' || error?.code === 'auth/argument-error') return res.status(401).json({ error: 'Sessão Firebase inválida ou expirada.' });
    return res.status(401).json({ error: 'Não foi possível sincronizar a sessão.' });
  }
});

module.exports = router;
