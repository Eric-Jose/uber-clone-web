// Vercel Function entrypoint for the unified PreçoFixo17 backend.
// The HTTP API stays in Express while Socket.IO remains disabled here because
// Vercel Functions do not provide a persistent server process for the socket server.
const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');
const dotenv = require('dotenv');
const { authenticate } = require('../backend/middleware/auth');

dotenv.config();

function stripWrappingQuotes(value) {
  const text = String(value ?? '').trim();
  if (text.length >= 2) {
    const first = text[0];
    const last = text[text.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return text.slice(1, -1);
    }
  }
  return text;
}

const required = ['FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY', 'FIREBASE_DATABASE_URL', 'JWT_SECRET'];
const missing = required.filter((name) => !process.env[name]);

if (missing.length) {
  throw new Error(`Configuração incompleta do backend: ${missing.join(', ')}`);
}

if (!admin.apps.length) {
  const privateKey = stripWrappingQuotes(process.env.FIREBASE_PRIVATE_KEY)
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r');

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: stripWrappingQuotes(process.env.FIREBASE_PROJECT_ID),
      clientEmail: stripWrappingQuotes(process.env.FIREBASE_CLIENT_EMAIL),
      privateKey,
    }),
    databaseURL: stripWrappingQuotes(process.env.FIREBASE_DATABASE_URL),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET
      ? stripWrappingQuotes(process.env.FIREBASE_STORAGE_BUCKET)
      : undefined,
  });
}

const db = admin.database();
const app = express();
const allowedOrigins = [
  'https://uber-clone-web.vercel.app',
  'https://uber-clone-web-eric-jose.vercel.app',
  'https://uber-clone-web-git-main-eric-jose.vercel.app',
  'https://uber-clone-eric.vercel.app',
  'http://localhost:3000',
];
const isAllowedOrigin = (origin) => (
  !origin || allowedOrigins.includes(origin) || /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin)
);
const corsOptions = {
  origin: (origin, callback) => (isAllowedOrigin(origin)
    ? callback(null, true)
    : callback(new Error('Bloqueado pelo CORS'))),
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  credentials: true,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json({ limit: '1mb' }));

const authRoutes = require('../backend/routes/auth');
const firebaseSessionRoutes = require('../backend/routes/firebase-session');
const passwordResetRoutes = require('../backend/routes/password-reset');
const driverRoutes = require('../backend/routes/drivers');
const rideRoutes = require('../backend/routes/rides');
const pendingRideRoutes = require('../backend/routes/pending-rides');
const locationRoutes = require('../backend/routes/location');
const ratingRoutes = require('../backend/routes/ratings');
const adminStatsRoutes = require('../backend/routes/admin-stats');

// No Socket.IO bootstrap in Vercel. The ride API and driver polling remain fully available.
rideRoutes.setSocketIo(null);

app.get('/health', (req, res) => res.status(200).json({
  status: 'ok',
  service: 'precofixo17-backend',
  platform: 'vercel',
  timestamp: new Date().toISOString(),
}));
app.get('/api/health', (req, res) => res.status(200).json({
  status: 'ok',
  service: 'precofixo17-backend',
  platform: 'vercel',
  timestamp: new Date().toISOString(),
}));

app.use('/api/auth', authRoutes);
app.use('/api/auth/firebase-session', firebaseSessionRoutes);
app.use('/api/auth/password-reset', passwordResetRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/rides/pending', pendingRideRoutes);

app.get('/api/rides/history', authenticate, async (req, res) => {
  try {
    const uid = req.user.uid;
    const parsedLimit = Number.parseInt(req.query.limit, 10);
    const limit = Number.isInteger(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 100) : 30;
    const user = (await db.ref(`users/${uid}`).get()).val();
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });

    const snapshot = await db.ref('rides').get();
    const rides = [];
    snapshot.forEach((child) => {
      const ride = child.val();
      if (!ride) return;
      const matches = user.userType === 'driver'
        ? String(ride.driverId || '') === String(uid)
        : String(ride.userId || '') === String(uid);
      if (matches) rides.push(ride);
    });
    rides.sort((a, b) => Number(b.updatedAt || b.createdAt || 0) - Number(a.updatedAt || a.createdAt || 0));
    return res.json({ success: true, rides: rides.slice(0, limit) });
  } catch (error) {
    console.error('Erro ao buscar histórico de corridas:', error.message);
    return res.status(500).json({ error: 'Erro ao buscar histórico de corridas.' });
  }
});

app.get('/api/rides/:rideId([A-Za-z0-9_-]{10,})', authenticate, async (req, res) => {
  try {
    const ride = (await db.ref(`rides/${req.params.rideId}`).get()).val();
    if (!ride) return res.status(404).json({ error: 'Corrida não encontrada.' });
    if (ride.userId !== req.user.uid && ride.driverId !== req.user.uid) {
      return res.status(403).json({ error: 'Acesso negado.' });
    }
    return res.json({ success: true, ride });
  } catch (error) {
    console.error('Erro ao buscar corrida:', error.message);
    return res.status(500).json({ error: 'Erro interno ao buscar corrida.' });
  }
});

app.use('/api/rides', rideRoutes);
app.use('/api/location', locationRoutes);
app.use('/api/ratings', ratingRoutes);
app.use('/api/admin-stats', adminStatsRoutes);

app.use((error, req, res, next) => {
  console.error('Erro não tratado na API:', error?.stack || error);
  if (res.headersSent) return next(error);
  return res.status(500).json({ error: 'Erro interno do servidor.' });
});

module.exports = app;
