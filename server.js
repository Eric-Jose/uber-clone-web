const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const dotenv = require('dotenv');
const admin = require('firebase-admin');
const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'precofixo17-dev-jwt-secret-2026';
process.env.JWT_SECRET = JWT_SECRET;

const requiredFirebaseEnv = ['FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY'];
const missingFirebaseEnv = requiredFirebaseEnv.filter((key) => !process.env[key]);

function getValidFirebaseDatabaseUrl() {
  const fallback = `https://${process.env.FIREBASE_PROJECT_ID}-default-rtdb.firebaseio.com`;
  const configured = String(process.env.FIREBASE_DATABASE_URL || '').trim();
  if (!configured) return fallback;
  try {
    const parsed = new URL(configured);
    if (parsed.protocol !== 'https:' || !parsed.hostname) throw new Error('Firebase Database URL must use https://');
    return parsed.toString().replace(/\/$/, '');
  } catch (error) {
    console.warn(`⚠️ FIREBASE_DATABASE_URL inválida (${error.message}). Usando URL padrão do projeto.`);
    return fallback;
  }
}

let realFirebaseInitialized = false;
if (admin.apps && admin.apps.length > 0) {
  realFirebaseInitialized = admin.apps[0]?.options?.databaseURL !== 'in-memory://precofixo17';
}

if (!realFirebaseInitialized && missingFirebaseEnv.length === 0 && !String(process.env.FIREBASE_PROJECT_ID).includes('seu-projeto')) {
  try {
    const privateKey = String(process.env.FIREBASE_PRIVATE_KEY)
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r');
    const databaseURL = getValidFirebaseDatabaseUrl();
    if (!admin.apps || admin.apps.length === 0) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          privateKey,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        }),
        databaseURL,
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET || undefined,
      });
    }
    realFirebaseInitialized = true;
    console.log('✅ PreçoFixo17: Firebase Admin conectado ao projeto:', process.env.FIREBASE_PROJECT_ID);
  } catch (err) {
    console.warn('⚠️ Falha ao inicializar Firebase Admin (' + err.message + ').');
  }
}

if (!realFirebaseInitialized && (!admin.apps || admin.apps.length === 0)) {
  const { setupFirebaseMock } = require('./backend/mock-firebase');
  setupFirebaseMock(admin);
}

const db = admin.database();
const auth = admin.auth();

const { authenticate } = require('./backend/middleware/auth');
const authRoutes = require('./backend/routes/auth');
const firebaseSessionRoutes = require('./backend/routes/firebase-session');
const passwordResetRoutes = require('./backend/routes/password-reset');
const driverRoutes = require('./backend/routes/drivers');
const rideRoutes = require('./backend/routes/rides');
const pendingRideRoutes = require('./backend/routes/pending-rides');
const locationRoutes = require('./backend/routes/location');
const ratingRoutes = require('./backend/routes/ratings');
const adminStatsRoutes = require('./backend/routes/admin-stats');

const app = express();
const server = http.createServer(app);

const corsOptions = {
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
};
app.use(cors(corsOptions));
app.options('*all', cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const io = socketIo(server, {
  cors: {
    origin: true,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});
rideRoutes.setSocketIo(io);

const healthHandler = (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'precofixo17-backend',
    platform: 'express-node',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
};
app.get('/health', healthHandler);
app.get('/api/health', healthHandler);

app.get('/api/backend-check', (req, res) => {
  const firebaseApp = admin.apps?.[0] || null;
  const databaseURL = firebaseApp?.options?.databaseURL || '';
  res.status(200).json({
    status: 'ok',
    backendInitialized: true,
    firebaseInitialized: Boolean(firebaseApp),
    databaseConfigured: Boolean(databaseURL),
    databaseURLValid: /^https:\/\/.+/.test(String(databaseURL)),
    deploymentCommit: process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || null,
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/auth/firebase-session', firebaseSessionRoutes);
app.use('/api/auth/password-reset', passwordResetRoutes);
app.use('/api/auth', authRoutes);
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
      const matches = user.userType === 'driver' ? String(ride.driverId || '') === String(uid) : String(ride.userId || '') === String(uid);
      if (matches) rides.push(ride);
    });
    rides.sort((a, b) => Number(b.updatedAt || b.createdAt || 0) - Number(a.updatedAt || a.createdAt || 0));
    return res.json({ success: true, rides: rides.slice(0, limit) });
  } catch (error) {
    console.error('Erro no histórico:', error.message);
    return res.status(500).json({ error: 'Não foi possível carregar o histórico.' });
  }
});

app.get('/api/rides/notifications', authenticate, async (req, res) => {
  try {
    const user = (await db.ref(`users/${req.user.uid}`).get()).val();
    if (!user || user.userType !== 'driver') return res.status(403).json({ error: 'Somente motoristas podem consultar notificações de corrida.' });
    const snapshot = await db.ref(`driverNotifications/${req.user.uid}`).get();
    const notifications = [];
    snapshot.forEach((child) => {
      const value = child.val();
      if (value && value.status === 'SEARCHING') notifications.push({ ...value, rideId: value.rideId || child.key });
    });
    notifications.sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0));
    return res.json({ success: true, notifications });
  } catch (error) {
    console.error('Erro nas notificações:', error.message);
    return res.status(500).json({ error: 'Não foi possível carregar as notificações.' });
  }
});

app.get('/api/rides/:rideId', authenticate, async (req, res, next) => {
  try {
    const { rideId } = req.params;
    if (!rideId || !/^[A-Za-z0-9_-]{10,}$/.test(rideId)) return next();
    const ride = (await db.ref(`rides/${rideId}`).get()).val();
    if (!ride) return res.status(404).json({ error: 'Corrida não encontrada.' });
    if (ride.userId !== req.user.uid && ride.driverId !== req.user.uid) return res.status(403).json({ error: 'Acesso negado.' });
    return res.json({ success: true, ride });
  } catch (error) {
    console.error('Erro ao buscar corrida:', error.message);
    return res.status(500).json({ error: 'Não foi possível buscar a corrida.' });
  }
});

app.use('/api/rides', rideRoutes);
app.use('/api/location', locationRoutes);
app.use('/api/ratings', ratingRoutes);
app.use('/api/admin-stats', adminStatsRoutes);

io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) return next(new Error('Não autenticado'));
    const decoded = jwt.verify(token, JWT_SECRET);
    socket.user = decoded;
    next();
  } catch (error) {
    next(new Error('Token inválido'));
  }
});

io.on('connection', (socket) => {
  const uid = socket.user?.uid;
  if (!uid) return;
  socket.join(`user:${uid}`);
  socket.join(`user_${uid}`);
  socket.on('join-ride-room', (rideId) => {
    if (!rideId) return;
    socket.join(`ride:${rideId}`);
    socket.join(`ride_${rideId}`);
  });
  socket.on('leave-ride-room', (rideId) => {
    if (!rideId) return;
    socket.leave(`ride:${rideId}`);
    socket.leave(`ride_${rideId}`);
  });
  socket.on('join-drivers-room', async () => {
    try {
      const user = (await db.ref(`users/${uid}`).get()).val();
      if (user?.userType === 'driver' && user?.driverApprovalStatus === 'approved') socket.join('drivers');
    } catch (error) { console.error('join-drivers-room:', error.message); }
  });
  socket.on('driver-presence-location', async (payload) => {
    try {
      const lat = Number(payload?.latitude ?? payload?.lat);
      const lng = Number(payload?.longitude ?? payload?.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      await db.ref(`users/${uid}`).update({ isOnline: true, currentLocation: { lat, lng }, lastLocationUpdate: new Date().toISOString() });
      await db.ref(`locations/${uid}`).set({ lat, lng, latitude: lat, longitude: lng, timestamp: new Date().toISOString() });
    } catch (e) { console.error('driver-presence-location:', e.message); }
  });
  socket.on('driver-location', async (payload) => {
    try {
      const rideId = payload?.rideId;
      const lat = Number(payload?.latitude ?? payload?.lat);
      const lng = Number(payload?.longitude ?? payload?.lng);
      if (!rideId || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
      const ride = (await db.ref(`rides/${rideId}`).get()).val();
      if (!ride || String(ride.driverId) !== String(uid)) return;
      await db.ref(`rides/${rideId}`).update({ driverLocation: { lat, lng }, updatedAt: Date.now() });
      io.to(`ride:${rideId}`).emit('update-driver-location', { rideId, driverId: uid, location: { lat, lng }, latitude: lat, longitude: lng });
      io.to(`ride_${rideId}`).emit('update-driver-location', { rideId, driverId: uid, location: { lat, lng }, latitude: lat, longitude: lng });
    } catch (e) { console.error('driver-location:', e.message); }
  });
  socket.on('passenger-location', async (payload) => {
    try {
      const rideId = payload?.rideId;
      const lat = Number(payload?.latitude ?? payload?.lat);
      const lng = Number(payload?.longitude ?? payload?.lng);
      if (!rideId || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
      const ride = (await db.ref(`rides/${rideId}`).get()).val();
      if (!ride || String(ride.userId) !== String(uid)) return;
      await db.ref(`rides/${rideId}`).update({ passengerLocation: { lat, lng }, updatedAt: Date.now() });
      io.to(`ride:${rideId}`).emit('update-passenger-location', { rideId, userId: uid, location: { lat, lng }, latitude: lat, longitude: lng });
      io.to(`ride_${rideId}`).emit('update-passenger-location', { rideId, userId: uid, location: { lat, lng }, latitude: lat, longitude: lng });
    } catch (e) { console.error('passenger-location:', e.message); }
  });
  socket.on('request-ride', async (payload, ack) => {
    try {
      const rideId = payload?.rideId;
      if (!rideId) return typeof ack === 'function' && ack({ ok: false, error: 'rideId ausente' });
      const ride = (await db.ref(`rides/${rideId}`).get()).val();
      if (!ride || String(ride.userId) !== String(uid)) return typeof ack === 'function' && ack({ ok: false, error: 'Corrida inválida.' });
      const drivers = await findNearestDrivers(ride.origin);
      const nearest = drivers.slice(0, 10);
      for (const driver of nearest) {
        io.to('drivers').emit('new-ride-request', { ...ride, id: rideId, driverDistance: Number(driver.distance.toFixed(2)) });
        io.to(`driver:${driver.uid}`).emit('new-ride-request', { ...ride, id: rideId, driverDistance: Number(driver.distance.toFixed(2)) });
        io.to(`driver_${driver.uid}`).emit('new-ride-request', { ...ride, id: rideId, driverDistance: Number(driver.distance.toFixed(2)) });
        await db.ref(`driverNotifications/${driver.uid}/${rideId}`).set({ ...ride, rideId, status: 'SEARCHING', createdAt: Date.now() });
      }
      if (nearest.length === 0) await db.ref(`rides/${rideId}`).update({ status: 'SEARCHING', noDriversAvailable: true, updatedAt: Date.now() });
      if (typeof ack === 'function') ack({ ok: true, driversNotified: nearest.length });
    } catch (error) {
      console.error('request-ride:', error.message);
      if (typeof ack === 'function') ack({ ok: false, error: 'Não foi possível procurar motorista.' });
    }
  });
  socket.on('accept-ride', async (rideId, ack) => {
    try {
      const ride = (await db.ref(`rides/${rideId}`).get()).val();
      if (!ride) return typeof ack === 'function' && ack({ ok: false, error: 'Corrida não encontrada.' });
      if (ride.driverId && String(ride.driverId) !== String(uid)) return typeof ack === 'function' && ack({ ok: false, error: 'Corrida já aceita por outro motorista.' });
      await db.ref(`rides/${rideId}`).update({ driverId: uid, status: 'ACCEPTED', updatedAt: Date.now() });
      io.to(`ride:${rideId}`).emit('ride-accepted', { ...ride, id: rideId, driverId: uid, status: 'ACCEPTED' });
      io.to(`ride_${rideId}`).emit('ride-accepted', { ...ride, id: rideId, driverId: uid, status: 'ACCEPTED' });
      if (typeof ack === 'function') ack({ ok: true });
    } catch (error) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Não foi possível aceitar a corrida.' });
    }
  });
  socket.on('ride-cancelled', (rideId) => {
    if (!rideId) return;
    io.to(`ride:${rideId}`).emit('ride-cancelled', { rideId });
    io.to(`ride_${rideId}`).emit('ride-cancelled', { rideId });
  });
  socket.on('start-ride', (rideId) => {
    if (!rideId) return;
    io.to(`ride:${rideId}`).emit('ride-started', { rideId, status: 'IN_PROGRESS' });
    io.to(`ride_${rideId}`).emit('ride-started', { rideId, status: 'IN_PROGRESS' });
  });
  socket.on('end-ride', (rideId) => {
    if (!rideId) return;
    io.to(`ride:${rideId}`).emit('ride-ended', { rideId, status: 'COMPLETED' });
    io.to(`ride_${rideId}`).emit('ride-ended', { rideId, status: 'COMPLETED' });
  });
});

const buildDir = path.join(__dirname, 'build');
if (require('fs').existsSync(buildDir)) {
  app.use(express.static(buildDir));
  app.get('*all', (req, res, next) => {
    if (req.path.startsWith('/api/') || req.path === '/health' || req.path.startsWith('/socket.io')) return next();
    return res.sendFile(path.join(buildDir, 'index.html'));
  });
}

if (require.main === module) {
  const PORT = process.env.PORT || 3001;
  server.listen(PORT, () => console.log(`🚗 PreçoFixo17 backend ativo na porta ${PORT}`));
}

module.exports = { app, server, io, db, auth };