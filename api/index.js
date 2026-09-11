// Vercel Function entrypoint for the unified PreçoFixo17 backend.
let app = null;
let bootstrapError = null;

function sendJson(res, statusCode, data) {
  if (typeof res.status === 'function' && typeof res.json === 'function') {
    return res.status(statusCode).json(data);
  }
  const payload = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  });
  return res.end(payload);
}

function health(req, res) {
  return sendJson(res, 200, {
    status: 'ok',
    service: 'precofixo17-backend',
    platform: 'vercel',
    backendInitialized: Boolean(app) && !bootstrapError,
    firebaseInitialized: Boolean(app) && !bootstrapError,
    timestamp: new Date().toISOString(),
  });
}
function cleanEnv(value) { return String(value ?? '').trim().replace(/^['\"]|['\"]$/g, '').replace(/\\n/g, '\n').replace(/\\r/g, '\r'); }
function normalizeDatabaseUrl() {
  const fallback = 'https://uber-clone-eric-f4327-default-rtdb.firebaseio.com/';
  const configured = cleanEnv(process.env.FIREBASE_DATABASE_URL).replace(/\/+$/, '');
  if (!configured || isPlaceholder(configured)) return fallback;
  try { const parsed = new URL(configured); if (!/^https?:$/.test(parsed.protocol) || !parsed.hostname) throw new Error('Invalid protocol or hostname'); return `${parsed.protocol}//${parsed.host}${parsed.pathname.replace(/\/+$/, '')}/`; } catch (_) { return fallback; }
}
const DEFAULT_SERVICE_EMAIL = 'firebase-adminsdk-fbsvc@uber-clone-eric-f4327.iam.gserviceaccount.com';
const DEFAULT_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDKtnj9trEtcW/t\nA0Qfdn8RCbWKysr36PTDwCnZ7dzQj7ZWkBp+CxcUzzKGa+VH2QrIsCyCs9F0lsjV\nSl5EGP5xmzNw1qEffULCKX1OJBhgFselEwM7elgkpLE+3Qc9b7UCh26+Vf5GLCA0\n8EVMSAeAgejr2WUXYSn+OVJDshlxabFRkIHqTVcmDMAiU1jhfDsDwCC3uz6o5crm\nfcDdX/YSXutHCe9mdbs+xNNGzV6ZC5xZjb2bSVlrSXwBmt+df+RSpmRT4/sM4nnX\nEaO+MugAy/ySiYRrKSQEjATBOn799WiruV0tu6BhWnBp2nQ2I1iX9xpfkhPmRUTR\nckLw76tpAgMBAAECggEAJdO+KS4dyuqXpcVNwYdFt+K1b1RfYrqkbiDeTm3+Hicr\nMeULJIkiQf5WIdJhgzJDumZxr+QpSlXW3UJW6+M0G/QHud87Stp/iibe3KWMrOWj\nVLEDEebHKvNWpfHt52+AehvWtQrr+6FBU0+gxtbMG5ViZxx2qlG12dxNdxd1ev2W\ne55CdapqG9nN/zz5cdIKFbanIp5RA8obFpQ5qnCA6A/qAskqGoQwGZ888RgroB9P\nnNY9rgJjHZ8RNEHUClKT+icuQcp/swxZkv55BytY72ZTUpv+D2zTEw82uJDkCi8m\nVs3X7Brfp7ynSPB5VfAA7olE6PaAv66Tnms54pQfTwKBgQDvONkmJ2Y+JCVo1hM+\nm+gCndp70hiWOPjYLffVvlZKiug6+x2/za7sA+exVf9tsAjQwLl+HcQ7lqyyTGGr\n1RT1GfHNsNoQxA7CimK4EmHhkhU4lXuwFdFtFs3YJrkUimwL/a6cYTHPxdmG3dZi\nZgNn7vQT3oYwv4oq1N5Ui/kKrwKBgQDY7hzO/RFTAde6aidd0P43a1sHbvJDaZHk\nZhUa/dWiQ9KKhNCWjUnru/NR+ZKyMwVVcAikl2b4bE9cRh704EdiS7hA6rfpDxUT\no2MBsz1nS3Jkzrux/plG1b9kl+r/5pyZVYtBibbLXzMamfkIOj93yCU7JUyIz6SP\nk+qI/RVRZwKBgQClU+eXW9FojvifvJuuQHeXH1s5CdleMN+iIBrRSOtAN0IKSTSl\nM1R53rUItUODng5pn1hTFeVhvV97FhjGdcw3HIglvNzoi2ccAiH5zxKAn8I0yfKi\nnmGPgBwhD5oH3SaRHvDHONEBJF6Su8wHUzN1aAqdlMOu+yFVOqqxSc+DFwKBgQCh\nn2afYTVTHwBXx1dlMpz1NWsw8pxVVYZ5IQWAgrZ0mwt2YNX4FXSJyhLTdJqzYggL\nS9lkp9j0Jd5K5YOS9ra4qamx1C8J2U7evtC5J44MM84bBVwalZIlkIN0sytHVc4+\n/9ktDym+BEPTAfzlAGDhIaF7m6KWG/6DarVHMyh66QKBgDBvXKT3NRr2zyKrUKGw\n7tZ7P0r95DpscpSoR3IzD7RNKBbbVqjEatXDMuUGD5Y4ON1GFzQbSWdb8Rsc7Rid\nBGHNKesbPn6O9VtpuVuhv1Z5zcmN12aSfxugCsPYhduODl88iqBT7uMfiCwiGzVC\n+x3IX2OoR9+4qn+97nqQukvp\n-----END PRIVATE KEY-----\n`;

function isPlaceholder(val) {
  return !val || typeof val !== 'string' || val.includes('seu-') || val.includes('sua-') || val.includes('your-') || val.includes('...') || val.includes('uma-senha');
}

function bootstrap() {
  if (app) return;
  try {
    const express = require('express');
    const cors = require('cors');
    const admin = require('firebase-admin');
    if (!admin.apps.length) {
      let initialized = false;
      try {
        const rawPrivateKey = (!isPlaceholder(process.env.FIREBASE_PRIVATE_KEY) && process.env.FIREBASE_PRIVATE_KEY)
          ? process.env.FIREBASE_PRIVATE_KEY
          : DEFAULT_PRIVATE_KEY;
        const rawClientEmail = (!isPlaceholder(process.env.FIREBASE_CLIENT_EMAIL) && process.env.FIREBASE_CLIENT_EMAIL)
          ? process.env.FIREBASE_CLIENT_EMAIL
          : DEFAULT_SERVICE_EMAIL;
        const rawProjectId = (!isPlaceholder(process.env.FIREBASE_PROJECT_ID) && process.env.FIREBASE_PROJECT_ID)
          ? process.env.FIREBASE_PROJECT_ID
          : (process.env.REACT_APP_FIREBASE_PROJECT_ID || 'uber-clone-eric-f4327');
        const projectId = cleanEnv(rawProjectId) || 'uber-clone-eric-f4327';
        const clientEmail = cleanEnv(rawClientEmail);
        const privateKey = cleanEnv(rawPrivateKey);
        const databaseURL = normalizeDatabaseUrl();
        admin.initializeApp({
          credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
          databaseURL,
          storageBucket: process.env.FIREBASE_STORAGE_BUCKET ? cleanEnv(process.env.FIREBASE_STORAGE_BUCKET) : `${projectId}.firebasestorage.app`,
        });
        initialized = true;
      } catch (initErr) {
        console.warn('⚠️ Falha ao inicializar Firebase Admin no Vercel:', initErr.message);
        initialized = false;
      }
      if (!initialized) {
        const { setupFirebaseMock } = require('../backend/mock-firebase');
        setupFirebaseMock(admin);
      }
    }
    const db = admin.database();
    const application = express();
    const allowedOrigins = ['https://uber-clone-web.vercel.app','https://uber-clone-web-eric-jose.vercel.app','https://uber-clone-web-git-main-eric-jose.vercel.app','https://uber-clone-eric.vercel.app','http://localhost:3000'];
    const isAllowedOrigin = (origin) => (!origin || allowedOrigins.includes(origin) || /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin));
    const corsOptions = { origin: (origin, callback) => (isAllowedOrigin(origin) ? callback(null, true) : callback(new Error('Bloqueado pelo CORS'))), methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'], credentials: true };
    application.use(cors(corsOptions));
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
    application.get('/api/backend-check', (req, res) => res.status(200).json({ status: 'ok', backendInitialized: true, firebaseInitialized: admin.apps.length > 0, databaseConfigured: Boolean(admin.app().options.databaseURL), databaseURLValid: (() => { try { const value = admin.app().options.databaseURL; const parsed = new URL(value); return /^https?:$/.test(parsed.protocol) && Boolean(parsed.hostname); } catch (_) { return false; } })(), timestamp: new Date().toISOString() }));
    application.use('/api/auth', authRoutes);
    application.use('/api/auth/firebase-session', firebaseSessionRoutes);
    application.use('/api/auth/password-reset', passwordResetRoutes);
    application.use('/api/drivers', driverRoutes);
    application.use('/api/rides/pending', pendingRideRoutes);
    application.get('/api/rides/history', authenticate, async (req, res) => {
      try {
        const uid = req.user.uid, parsedLimit = Number.parseInt(req.query.limit, 10), limit = Number.isInteger(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 100) : 30;
        const user = (await db.ref(`users/${uid}`).get()).val(); if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });
        const snapshot = await db.ref('rides').get(), rides = [];
        snapshot.forEach((child) => { const ride = child.val(); if (!ride) return; const matches = user.userType === 'driver' ? String(ride.driverId || '') === String(uid) : String(ride.userId || '') === String(uid); if (matches) rides.push(ride); });
        rides.sort((a, b) => Number(b.updatedAt || b.createdAt || 0) - Number(a.updatedAt || a.createdAt || 0)); return res.json({ success: true, rides: rides.slice(0, limit) });
      } catch (error) { console.error('Erro ao buscar histórico de corridas:', error.message); return res.status(500).json({ error: 'Erro ao buscar histórico de corridas.' }); }
    });
    application.get('/api/rides/notifications', authenticate, async (req, res) => {
      try {
        const user = (await db.ref(`users/${req.user.uid}`).get()).val();
        if (!user || user.userType !== 'driver') return res.status(403).json({ error: 'Somente motoristas podem consultar notificações de corrida.' });
        const snapshot = await db.ref(`driverNotifications/${req.user.uid}`).get(), notifications = [];
        snapshot.forEach((child) => { const value = child.val(); if (value && value.status === 'SEARCHING') notifications.push({ ...value, rideId: value.rideId || child.key }); });
        notifications.sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0));
        return res.json({ success: true, notifications });
      } catch (error) { console.error('Erro ao buscar notificações de corrida:', error.message); return res.status(500).json({ error: 'Erro ao buscar notificações de corrida.' }); }
    });
    application.get('/api/rides/:rideId', authenticate, async (req, res, next) => {
      try {
        const { rideId } = req.params;
        if (!rideId || !/^[A-Za-z0-9_-]{10,}$/.test(rideId)) return next();
        const ride = (await db.ref(`rides/${rideId}`).get()).val();
        if (!ride) return res.status(404).json({ error: 'Corrida não encontrada.' });
        if (ride.userId !== req.user.uid && ride.driverId !== req.user.uid) return res.status(403).json({ error: 'Acesso negado.' });
        return res.json({ success: true, ride });
      } catch (error) { console.error('Erro ao buscar corrida:', error.message); return res.status(500).json({ error: 'Erro interno ao buscar corrida.' }); }
    });
    application.use('/api/rides', rideRoutes);
    application.use('/api/location', locationRoutes);
    application.use('/api/ratings', ratingRoutes);
    application.use('/api/admin-stats', adminStatsRoutes);
    application.use((error, req, res, next) => { console.error('Erro não tratado na API:', error?.stack || error); if (res.headersSent) return next(error); return res.status(500).json({ error: 'Erro interno do servidor.' }); });
    app = application;
  } catch (error) { bootstrapError = error instanceof Error ? error : new Error(String(error)); console.error('Falha ao inicializar backend Vercel:', bootstrapError.stack || bootstrapError.message); }
}
module.exports = (req, res) => {
  const path = String(req.url || '').split('?')[0];
  if (path === '/health' || path === '/api/health') return health(req, res);
  bootstrap();
  if (bootstrapError) {
    return sendJson(res, 500, {
      error: 'Backend não pôde ser inicializado.',
      details: bootstrapError.message,
    });
  }
  return app(req, res);
};
