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

router.post('/', async (req, res) => {
  try {
    const idToken = String(req.body?.idToken || '').trim();
    if (!idToken) return res.status(400).json({ error: 'idToken é obrigatório.' });
    const decoded = await auth.verifyIdToken(idToken, true);
    const uid = decoded.uid;
    const email = String(decoded.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ error: 'A conta Firebase não possui email válido.' });
    const userRef = db.ref(`users/${uid}`);
    const userSnapshot = await userRef.get();
    let user = userSnapshot.val();
    if (!user) {
      const provider = decoded.firebase?.sign_in_provider || 'firebase';
      user = { uid, email, name: String(decoded.name || decoded.email?.split('@')[0] || 'Usuário').trim(), phone: String(decoded.phone_number || '').trim(), userType: 'passenger', rating: 5.0, totalRides: 0, isOnline: false, profilePhoto: decoded.picture || null, authProvider: provider, createdAt: new Date().toISOString() };
      await userRef.set(user);
    } else {
      const patch = {};
      if (!user.uid) patch.uid = uid;
      if (!user.email) patch.email = email;
      if (!user.name && decoded.name) patch.name = String(decoded.name).trim();
      if (!user.profilePhoto && decoded.picture) patch.profilePhoto = decoded.picture;
      if (Object.keys(patch).length) { await userRef.update(patch); user = { ...user, ...patch }; }
    }
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
