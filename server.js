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

let realFirebaseInitialized = false;
if (missingFirebaseEnv.length === 0 && !process.env.FIREBASE_PROJECT_ID.includes('seu-projeto')) {
  try {
    const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n').replace(/\\r/g, '\r');
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        privateKey,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      }),
      databaseURL:
        process.env.FIREBASE_DATABASE_URL ||
        `https://${process.env.FIREBASE_PROJECT_ID}-default-rtdb.firebaseio.com`,
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET || undefined,
    });
    realFirebaseInitialized = true;
    console.log('✅ PreçoFixo17: Firebase Admin conectado ao projeto:', process.env.FIREBASE_PROJECT_ID);
  } catch (err) {
    console.warn('⚠️ Credenciais Firebase Admin inválidas (' + err.message + '). Ativando modo mock em memória...');
  }
}

if (!realFirebaseInitialized) {
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

// CORS configuration
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

// Attach Socket.IO
const io = socketIo(server, {
  cors: {
    origin: true,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});
rideRoutes.setSocketIo(io);

// Health check endpoints
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
  res.status(200).json({
    status: 'ok',
    backendInitialized: true,
    firebaseInitialized: admin.apps.length > 0,
    databaseConfigured: Boolean(admin.app().options.databaseURL),
    timestamp: new Date().toISOString(),
  });
});

// Mount modular API routes
app.use('/api/auth/firebase-session', firebaseSessionRoutes);
app.use('/api/auth/password-reset', passwordResetRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/rides/pending', pendingRideRoutes);

// History & Notifications endpoints
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
      const matches =
        user.userType === 'driver'
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

app.get('/api/rides/notifications', authenticate, async (req, res) => {
  try {
    const user = (await db.ref(`users/${req.user.uid}`).get()).val();
    if (!user || user.userType !== 'driver') {
      return res.status(403).json({ error: 'Somente motoristas podem consultar notificações de corrida.' });
    }
    const snapshot = await db.ref(`driverNotifications/${req.user.uid}`).get();
    const notifications = [];
    snapshot.forEach((child) => {
      const value = child.val();
      if (value && value.status === 'SEARCHING') {
        notifications.push({ ...value, rideId: value.rideId || child.key });
      }
    });
    notifications.sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0));
    return res.json({ success: true, notifications });
  } catch (error) {
    console.error('Erro ao buscar notificações de corrida:', error.message);
    return res.status(500).json({ error: 'Erro ao buscar notificações de corrida.' });
  }
});

app.get('/api/rides/:rideId', authenticate, async (req, res, next) => {
  try {
    const { rideId } = req.params;
    if (!rideId || !/^[A-Za-z0-9_-]{10,}$/.test(rideId)) {
      return next();
    }
    const ride = (await db.ref(`rides/${rideId}`).get()).val();
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

// Socket.IO authentication & events
io.use((socket, next) => {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) return next(new Error('Não autenticado'));
    socket.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (error) {
    next(new Error('Token inválido ou expirado'));
  }
});

function distanceKm(a, b) {
  const lat1 = Number(a?.lat ?? a?.latitude);
  const lon1 = Number(a?.lng ?? a?.longitude);
  const lat2 = Number(b?.lat ?? b?.latitude);
  const lon2 = Number(b?.lng ?? b?.longitude);
  if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) return Infinity;
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

async function findNearestDrivers(origin) {
  const [usersSnapshot, locationsSnapshot] = await Promise.all([
    db.ref('users').get(),
    db.ref('locations').get(),
  ]);
  const users = usersSnapshot.val() || {};
  const locations = locationsSnapshot.val() || {};
  const originLocation = origin?.location || origin?.currentLocation || origin;
  const drivers = [];
  for (const [uid, user] of Object.entries(users)) {
    if (user?.userType !== 'driver' || user?.driverApprovalStatus !== 'approved' || user?.isOnline !== true) {
      continue;
    }
    const location = user.currentLocation || locations[uid];
    const distance = distanceKm(originLocation, location);
    if (Number.isFinite(distance)) drivers.push({ uid, distance });
  }
  return drivers.sort((a, b) => a.distance - b.distance);
}

async function saveDriverLocation(driverId, latitude, longitude) {
  const location = { latitude, longitude, lat: latitude, lng: longitude, timestamp: Date.now() };
  await db.ref(`locations/${driverId}`).set(location);
  await db.ref(`users/${driverId}`).update({
    currentLocation: { lat: latitude, lng: longitude },
    lastLocationUpdate: new Date().toISOString(),
  });
  return location;
}

io.on('connection', async (socket) => {
  socket.driverReady = false;
  socket.driverRoomLoading = false;

  socket.on('join-ride-room', async (rideId, acknowledge) => {
    const reply = typeof acknowledge === 'function' ? acknowledge : () => {};
    if (!rideId) return reply({ ok: false, reason: 'rideId ausente' });
    try {
      const snap = await db.ref(`rides/${rideId}`).get();
      const ride = snap.val();
      const uid = socket.user.uid;
      if (!ride || (ride.userId !== uid && ride.driverId !== uid)) {
        return reply({ ok: false, reason: 'corrida não pertence ao usuário' });
      }
      socket.join(`ride_${rideId}`);
      reply({ ok: true });
    } catch (error) {
      console.error('Erro ao entrar na corrida:', error.message);
      reply({ ok: false, reason: 'erro interno' });
    }
  });

  socket.on('leave-ride-room', (rideId) => {
    if (rideId) socket.leave(`ride_${rideId}`);
  });

  socket.on('join-drivers-room', async (acknowledge) => {
    const reply = typeof acknowledge === 'function' ? acknowledge : () => {};
    if (socket.driverReady || socket.driverRoomLoading) {
      return reply({
        ok: socket.driverReady,
        reason: socket.driverReady ? undefined : 'sincronização em andamento',
      });
    }
    socket.driverRoomLoading = true;
    try {
      const snap = await db.ref(`users/${socket.user.uid}`).get();
      const driver = snap.val();
      const approvedOnline =
        driver?.userType === 'driver' &&
        driver?.driverApprovalStatus === 'approved' &&
        driver?.isOnline === true;
      if (approvedOnline) {
        socket.join('available_drivers');
        socket.join(`driver_${socket.user.uid}`);
        socket.driverReady = true;
        reply({ ok: true });
      } else {
        reply({ ok: false, reason: 'motorista não está aprovado e online' });
      }
    } catch (error) {
      console.error('Erro ao entrar na sala de motoristas:', error.message);
      reply({ ok: false, reason: 'erro interno' });
    } finally {
      socket.driverRoomLoading = false;
    }
  });

  socket.on('driver-presence-location', async (data = {}) => {
    const latitude = Number(data.latitude ?? data.lat);
    const longitude = Number(data.longitude ?? data.lng);
    const driverId = socket.user.uid;
    if (
      !socket.driverReady ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      return;
    }
    try {
      await saveDriverLocation(driverId, latitude, longitude);
    } catch (error) {
      console.error('Erro na localização do motorista online:', error.message);
    }
  });

  socket.on('driver-location', async (data = {}) => {
    const { rideId } = data;
    const latitude = Number(data.latitude ?? data.lat);
    const longitude = Number(data.longitude ?? data.lng);
    const driverId = socket.user.uid;
    if (
      !rideId ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      return;
    }
    try {
      const snap = await db.ref(`rides/${rideId}`).get();
      const ride = snap.val();
      if (!ride || ride.driverId !== driverId || !['ACCEPTED', 'IN_PROGRESS'].includes(ride.status)) {
        return;
      }
      const location = await saveDriverLocation(driverId, latitude, longitude);
      io.to(`ride_${rideId}`).emit('update-driver-location', { driverId, ...location });
    } catch (error) {
      console.error('Erro na localização:', error.message);
    }
  });

  socket.on('passenger-location', async (data = {}) => {
    const rideId = data.rideId;
    const passengerId = socket.user.uid;
    const latitude = Number(data.latitude ?? data.lat);
    const longitude = Number(data.longitude ?? data.lng);
    if (
      !rideId ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      return;
    }
    try {
      const ref = db.ref(`rides/${rideId}`);
      const snap = await ref.get();
      const ride = snap.val();
      if (!ride || ride.userId !== passengerId || !['SEARCHING', 'ACCEPTED', 'IN_PROGRESS'].includes(ride.status)) {
        return;
      }
      const location = { lat: latitude, lng: longitude, timestamp: Date.now() };
      await ref.update({ passengerLocation: location, 'origin/location': { lat: latitude, lng: longitude } });
      if (ride.driverId) io.to(`driver_${ride.driverId}`).emit('passenger-location-update', { rideId, passengerId, location });
      io.to(`ride_${rideId}`).emit('passenger-location-update', { rideId, passengerId, location });
    } catch (error) {
      console.error('Erro na localização do passageiro:', error.message);
    }
  });

  socket.on('request-ride', async (data = {}) => {
    if (!data.rideId) return;
    try {
      const rideRef = db.ref(`rides/${data.rideId}`);
      const snap = await rideRef.get();
      const ride = snap.val();
      if (!ride || ride.userId !== socket.user.uid || ride.status !== 'SEARCHING') return;
      const nearestDrivers = await findNearestDrivers(ride.origin);
      const request = {
        rideId: data.rideId,
        passengerId: socket.user.uid,
        passengerName: ride.passengerName || 'Passageiro',
        passengerProfilePhoto: ride.passengerProfilePhoto || null,
        origin: ride.origin,
        destination: ride.destination,
        passengerLocation: ride.passengerLocation || ride.origin?.location || null,
        price: ride.price,
        distance: ride.distance,
      };
      const eligibleDrivers = nearestDrivers.filter((driver) => driver.distance <= 25);
      let offered = false;
      for (const driver of eligibleDrivers.slice(0, 10)) {
        const current = (await rideRef.get()).val();
        if (!current || current.status !== 'SEARCHING' || current.driverId) break;
        io.to(`driver_${driver.uid}`).emit('new-ride-request', {
          ...request,
          estimatedDistanceKm: Number(driver.distance.toFixed(2)),
          dispatchRadiusKm: 25,
          source: 'socket-dispatch',
        });
        offered = true;
        await new Promise((resolve) => setTimeout(resolve, 8000));
        const afterOffer = (await rideRef.get()).val();
        if (!afterOffer || afterOffer.status !== 'SEARCHING' || afterOffer.driverId) break;
      }
      if (!offered) console.log('Nenhum motorista elegível para corrida:', data.rideId);
    } catch (error) {
      console.error('Erro ao despachar corrida:', error.message);
    }
  });

  socket.on('accept-ride', (data = {}) => {
    if (!data.rideId) return;
    io.to(`ride_${data.rideId}`).emit('ride-accepted', { rideId: data.rideId, driverId: socket.user.uid });
  });

  socket.on('ride-cancelled', (data = {}) => {
    if (data.rideId) io.to(`ride_${data.rideId}`).emit('ride-cancelled', data);
  });
  socket.on('start-ride', (data = {}) => {
    if (data.rideId) io.to(`ride_${data.rideId}`).emit('ride-started', data);
  });
  socket.on('end-ride', (data = {}) => {
    if (data.rideId) io.to(`ride_${data.rideId}`).emit('ride-ended', data);
  });
});

// Serve static React SPA from build directory
const buildPath = path.join(__dirname, 'build');
app.use(express.static(buildPath));

// SPA Fallback for client routes (Express v5 friendly)
app.use((req, res, next) => {
  if (
    req.method === 'GET' &&
    !req.path.startsWith('/api') &&
    !req.path.startsWith('/socket.io') &&
    !req.path.startsWith('/health')
  ) {
    const indexPath = path.join(buildPath, 'index.html');
    return res.sendFile(indexPath, (err) => {
      if (err) {
        res.status(200).send('<!DOCTYPE html><html><body><h1>PreçoFixo17</h1><p>Building client assets...</p></body></html>');
      }
    });
  }
  next();
});

const PORT = 3000;
if (require.main === module) {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`PreçoFixo17 full-stack server running on http://0.0.0.0:${PORT}`);
  });
}

module.exports = { app, server, io, db, auth };
