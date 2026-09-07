// Vercel Function entrypoint for the unified PreçoFixo17 backend.
let app = null;
let bootstrapError = null;

function health(req, res) {
  return res.status(200).json({
    status: 'ok',
    service: 'precofixo17-backend',
    platform: 'vercel',
    backendInitialized: Boolean(app) && !bootstrapError,
    firebaseInitialized: false,
    timestamp: new Date().toISOString(),
  });
}

function cleanEnv(value) {
  return String(value ?? '')
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r');
}

function normalizeDatabaseUrl(projectId) {
  const configured = cleanEnv(process.env.FIREBASE_DATABASE_URL).replace(/\/+$/, '');
  try {
    const parsed = new URL(configured);
    if (!/^https?:$/.test(parsed.protocol) || !parsed.hostname) throw new Error('Invalid protocol');
    return `${parsed.protocol}//${parsed.host}${parsed.pathname.replace(/\/+$/, '')}/`;
  } catch (_) {
    return `https://${projectId}-default-rtdb.firebaseio.com/`;
  }
}

function bootstrap() {
  if (app || bootstrapError) return;

  try {
    const express = require('express');
    const cors = require('cors');
    const dotenv = require('dotenv');
    const admin = require('firebase-admin');
    dotenv.config();

    const required = [
      'FIREBASE_PROJECT_ID',
      'FIREBASE_CLIENT_EMAIL',
      'FIREBASE_PRIVATE_KEY',
      'JWT_SECRET',
    ];
    const missing = required.filter((name) => !process.env[name]);
    if (missing.length) throw new Error(`Variáveis ausentes: ${missing.join(', ')}`);

    const projectId = cleanEnv(process.env.FIREBASE_PROJECT_ID);
    const clientEmail = cleanEnv(process.env.FIREBASE_CLIENT_EMAIL);
    const privateKey = cleanEnv(process.env.FIREBASE_PRIVATE_KEY);
    const databaseURL = normalizeDatabaseUrl(projectId);

    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
        databaseURL,
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET
          ? cleanEnv(process.env.FIREBASE_STORAGE_BUCKET)
          : undefined,
      });
    }

    const db = admin.database();
    const application = express();
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
      origin: (origin, callback) => (
        isAllowedOrigin(origin) ? callback(null, true) : callback(new Error('Bloqueado pelo CORS'))
      ),
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      credentials: true,
    };
    application.use(cors(corsOptions));
    application.options('*', cors(corsOptions));
    application.use(express.json({ limit: '1mb' }));

    const { authenticate } = require('../backend/middleware/auth');
    const authRoutes = require('../backend/routes/auth');
    const firebaseSessionRoutes = require('../backend/routes/firebase-session');
    const passwordResetRoutes = require('../backend/routes/password-reset');
    const driverRoutes = require('../backend/routes/drivers');
    const rideRoutes = require('../backend/routes/rides');
    const pendingRideRoutes = require('../backend/routes/pending-rides');
    const locationRoutes = require('../backend/routes/location');
    const ratingRoutes = require('../backend/routes/ratings');
    const adminStatsRoutes = require('../backend/routes/admin-stats');

    rideRoutes.setSocketIo(null);

    application.get('/health', health);
    application.get('/api/health', health);
    application.get('/api/backend-check', (req, res) => res.status(200).json({
      status: 'ok',
      backendInitialized: true,
      firebaseInitialized: admin.apps.length > 0,
      databaseConfigured: Boolean(admin.app().options.databaseURL),
      databaseURLValid: Boolean(admin.app().options.databaseURL),
      timestamp: new Date().toISOString(),
    }));

    application.use('/api/auth', authRoutes);
    application.use('/api/auth/firebase-session', firebaseSessionRoutes);
    application.use('/api/auth/password-reset', passwordResetRoutes);
    application.use('/api/drivers', driverRoutes);
    application.use('/api/rides/pending', pendingRideRoutes);

    application.get('/api/rides/history', authenticate, async (req, res) => {
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

    application.get('/api/rides/:rideId([A-Za-z0-9_-]{10,})', authenticate, async (req, res) => {
      try {
        const ride = (await db.ref(`rides/${req.params.rideId}`).get()).val();
        if (!ride) return res.status(404).json({ error: 'Corrida não encontrada.' });
        if (ride.userId !== req.user.uid && ride.driverId !== req.user.uid) return res.status(403).json({ error: 'Acesso negado.' });
        return res.json({ success: true, ride });
      } catch (error) {
        console.error('Erro ao buscar corrida:', error.message);
        return res.status(500).json({ error: 'Erro interno ao buscar corrida.' });
      }
    });

    application.use('/api/rides', rideRoutes);
    application.use('/api/location', locationRoutes);
    application.use('/api/ratings', ratingRoutes);
    application.use('/api/admin-stats', adminStatsRoutes);

    application.use((error, req, res, next) => {
      console.error('Erro não tratado na API:', error?.stack || error);
      if (res.headersSent) return next(error);
      return res.status(500).json({ error: 'Erro interno do servidor.' });
    });

    app = application;
  } catch (error) {
    bootstrapError = error instanceof Error ? error : new Error(String(error));
    console.error('Falha ao inicializar backend Vercel:', bootstrapError.stack || bootstrapError.message);
  }
}

module.exports = (req, res) => {
  const path = String(req.url || '').split('?')[0];
  if (path === '/health' || path === '/api/health') return health(req, res);
  bootstrap();
  if (bootstrapError) {
    return res.status(500).json({
      error: 'Backend não pôde ser inicializado.',
      details: bootstrapError.message,
    });
  }
  return app(req, res);
};
