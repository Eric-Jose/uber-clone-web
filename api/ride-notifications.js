const admin = require('firebase-admin');
const jwt = require('jsonwebtoken');

function clean(value) { return String(value ?? '').trim().replace(/^['\"]|['\"]$/g, '').replace(/\\n/g, '\n').replace(/\\r/g, '\r'); }
function initFirebase() {
  if (admin.apps.length) return admin.database();
  const projectId = clean(process.env.FIREBASE_PROJECT_ID);
  const clientEmail = clean(process.env.FIREBASE_CLIENT_EMAIL);
  const privateKey = clean(process.env.FIREBASE_PRIVATE_KEY);
  if (!projectId || !clientEmail || !privateKey || !process.env.JWT_SECRET) throw new Error('Backend Firebase não configurado.');
  admin.initializeApp({ credential: admin.credential.cert({ projectId, clientEmail, privateKey }), databaseURL: clean(process.env.FIREBASE_DATABASE_URL) || 'https://uber-clone-eric-f4327-default-rtdb.firebaseio.com/' });
  return admin.database();
}
function authenticate(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;
  try { return jwt.verify(token, process.env.JWT_SECRET); } catch (_) { return null; }
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido.' });
  try {
    const user = authenticate(req);
    if (!user?.uid) return res.status(401).json({ error: 'Token inválido ou expirado.' });
    const db = initFirebase();
    const profile = (await db.ref(`users/${user.uid}`).get()).val();
    if (!profile || profile.userType !== 'driver') return res.status(403).json({ error: 'Somente motoristas podem consultar notificações.' });
    const snapshot = await db.ref(`driverNotifications/${user.uid}`).get();
    const notifications = [];
    const stale = [];
    for (const child of snapshot.exists() ? Object.values(snapshot.val()) : []) {
      const rideId = child?.rideId || child?.id;
      if (!rideId) continue;
      const ride = (await db.ref(`rides/${rideId}`).get()).val();
      if (!ride || ride.status !== 'SEARCHING' || ride.driverId) {
        stale.push(rideId);
        continue;
      }
      notifications.push({ ...child, ...ride, rideId, source: 'vercel-authoritative-notification' });
    }
    await Promise.all(stale.map((rideId) => db.ref(`driverNotifications/${user.uid}/${rideId}`).remove()));
    notifications.sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0));
    return res.status(200).json({ success: true, notifications });
  } catch (error) {
    console.error('Erro nas notificações Vercel:', error?.message || error);
    return res.status(500).json({ error: 'Não foi possível sincronizar as corridas.' });
  }
};
