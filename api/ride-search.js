const admin = require('firebase-admin');
const jwt = require('jsonwebtoken');

function clean(value) { return String(value ?? '').trim().replace(/^['\"]|['\"]$/g, '').replace(/\\n/g, '\n').replace(/\\r/g, '\r'); }
function db() {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: clean(process.env.FIREBASE_PROJECT_ID),
        clientEmail: clean(process.env.FIREBASE_CLIENT_EMAIL),
        privateKey: clean(process.env.FIREBASE_PRIVATE_KEY)
      }),
      databaseURL: clean(process.env.FIREBASE_DATABASE_URL) || 'https://uber-clone-eric-f4327-default-rtdb.firebaseio.com/'
    });
  }
  return admin.database();
}
function auth(req) {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) return null;
  try { return jwt.verify(h.slice(7), process.env.JWT_SECRET); } catch (_) { return null; }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });
  const user = auth(req);
  if (!user?.uid) return res.status(401).json({ error: 'Token inválido ou expirado.' });
  try {
    const database = db();
    const rideId = String(req.body?.rideId || '').trim();
    if (!rideId) return res.status(400).json({ error: 'rideId é obrigatório.' });
    const ref = database.ref(`rides/${rideId}`);
    const snapshot = await ref.get();
    const ride = snapshot.val();
    if (!ride) return res.status(404).json({ error: 'Corrida não encontrada.' });
    if (String(ride.userId) !== String(user.uid)) return res.status(403).json({ error: 'Acesso negado.' });
    if (ride.status !== 'SEARCHING' || ride.driverId) return res.status(409).json({ error: 'A corrida não está disponível para busca.', ride });
    const now = Date.now();
    await ref.update({ updatedAt: now, searchRequestedAt: now });
    return res.status(200).json({ success: true, rideId, status: 'SEARCHING', searchRequestedAt: now });
  } catch (error) {
    console.error('Erro ao iniciar busca da corrida:', error?.stack || error);
    return res.status(500).json({ error: 'Não foi possível iniciar a busca da corrida.' });
  }
};
