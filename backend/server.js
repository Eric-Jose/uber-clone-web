const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const admin = require('firebase-admin');
const http = require('http');
const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const { authenticate } = require('./middleware/auth');

dotenv.config();

const isPlaceholder = (val) =>
  !val ||
  typeof val !== 'string' ||
  val.includes('seu-') ||
  val.includes('sua-') ||
  val.includes('your-') ||
  val.includes('...') ||
  val.includes('uma-senha');

const DEFAULT_SERVICE_EMAIL = 'firebase-adminsdk-fbsvc@uber-clone-eric-f4327.iam.gserviceaccount.com';
const DEFAULT_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDKtnj9trEtcW/t\nA0Qfdn8RCbWKysr36PTDwCnZ7dzQj7ZWkBp+CxcUzzKGa+VH2QrIsCyCs9F0lsjV\nSl5EGP5xmzNw1qEffULCKX1OJBhgFselEwM7elgkpLE+3Qc9b7UCh26+Vf5GLCA0\n8EVMSAeAgejr2WUXYSn+OVJDshlxabFRkIHqTVcmDMAiU1jhfDsDwCC3uz6o5crm\nfcDdX/YSXutHCe9mdbs+xNNGzV6ZC5xZjb2bSVlrSXwBmt+df+RSpmRT4/sM4nnX\nEaO+MugAy/ySiYRrKSQEjATBOn799WiruV0tu6BhWnBp2nQ2I1iX9xpfkhPmRUTR\nckLw76tpAgMBAAECggEAJdO+KS4dyuqXpcVNwYdFt+K1b1RfYrqkbiDeTm3+Hicr\nMeULJIkiQf5WIdJhgzJDumZxr+QpSlXW3UJW6+M0G/QHud87Stp/iibe3KWMrOWj\nVLEDEebHKvNWpfHt52+AehvWtQrr+6FBU0+gxtbMG5ViZxx2qlG12dxNdxd1ev2W\ne55CdapqG9nN/zz5cdIKFbanIp5RA8obFpQ5qnCA6A/qAskqGoQwGZ888RgroB9P\nnNY9rgJjHZ8RNEHUClKT+icuQcp/swxZkv55BytY72ZTUpv+D2zTEw82uJDkCi8m\nVs3X7Brfp7ynSPB5VfAA7olE6PaAv66Tnms54pQfTwKBgQDvONkmJ2Y+JCVo1hM+\nm+gCndp70hiWOPjYLffVvlZKiug6+x2/za7sA+exVf9tsAjQwLl+HcQ7lqyyTGGr\n1RT1GfHNsNoQxA7CimK4EmHhkhU4lXuwFdFtFs3YJrkUimwL/a6cYTHPxdmG3dZi\nZgNn7vQT3oYwv4oq1N5Ui/kKrwKBgQDY7hzO/RFTAde6aidd0P43a1sHbvJDaZHk\nZhUa/dWiQ9KKhNCWjUnru/NR+ZKyMwVVcAikl2b4bE9cRh704EdiS7hA6rfpDxUT\no2MBsz1nS3Jkzrux/plG1b9kl+r/5pyZVYtBibbLXzMamfkIOj93yCU7JUyIz6SP\nk+qI/RVRZwKBgQClU+eXW9FojvifvJuuQHeXH1s5CdleMN+iIBrRSOtAN0IKSTSl\nM1R53rUItUODng5pn1hTFeVhvV97FhjGdcw3HIglvNzoi2ccAiH5zxKAn8I0yfKi\nnmGPgBwhD5oH3SaRHvDHONEBJF6Su8wHUzN1aAqdlMOu+yFVOqqxSc+DFwKBgQCh\nn2afYTVTHwBXx1dlMpz1NWsw8pxVVYZ5IQWAgrZ0mwt2YNX4FXSJyhLTdJqzYggL\nS9lkp9j0Jd5K5YOS9ra4qamx1C8J2U7evtC5J44MM84bBVwalZIlkIN0sytHVc4+\n/9ktDym+BEPTAfzlAGDhIaF7m6KWG/6DarVHMyh66QKBgDBvXKT3NRr2zyKrUKGw\n7tZ7P0r95DpscpSoR3IzD7RNKBbbVqjEatXDMuUGD5Y4ON1GFzQbSWdb8Rsc7Rid\nBGHNKesbPn6O9VtpuVuhv1Z5zcmN12aSfxugCsPYhduODl88iqBT7uMfiCwiGzVC\n+x3IX2OoR9+4qn+97nqQukvp\n-----END PRIVATE KEY-----\n`;

const rawPrivateKey = (!isPlaceholder(process.env.FIREBASE_PRIVATE_KEY) && process.env.FIREBASE_PRIVATE_KEY)
  ? process.env.FIREBASE_PRIVATE_KEY
  : DEFAULT_PRIVATE_KEY;

const rawClientEmail = (!isPlaceholder(process.env.FIREBASE_CLIENT_EMAIL) && process.env.FIREBASE_CLIENT_EMAIL)
  ? process.env.FIREBASE_CLIENT_EMAIL
  : DEFAULT_SERVICE_EMAIL;

const projectId = (!isPlaceholder(process.env.FIREBASE_PROJECT_ID) && process.env.FIREBASE_PROJECT_ID)
  ? process.env.FIREBASE_PROJECT_ID
  : (process.env.REACT_APP_FIREBASE_PROJECT_ID || 'uber-clone-eric-f4327');

if (!admin.apps.length) {
  let initialized = false;
  try {
    const privateKey = rawPrivateKey.replace(/\\n/g, '\n').replace(/\\r/g, '\r');
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        privateKey,
        clientEmail: rawClientEmail,
      }),
      databaseURL:
        process.env.FIREBASE_DATABASE_URL && !isPlaceholder(process.env.FIREBASE_DATABASE_URL)
          ? process.env.FIREBASE_DATABASE_URL
          : `https://${projectId}-default-rtdb.firebaseio.com`,
      storageBucket:
        process.env.FIREBASE_STORAGE_BUCKET && !isPlaceholder(process.env.FIREBASE_STORAGE_BUCKET)
          ? process.env.FIREBASE_STORAGE_BUCKET
          : `${projectId}.firebasestorage.app`,
    });
    initialized = true;
    console.log('⚡ PreçoFixo17: Firebase Admin inicializado com credenciais ativas para o projeto:', projectId);
  } catch (err) {
    console.warn('⚠️ Falha ao inicializar Firebase Admin com credenciais externas:', err.message);
    initialized = false;
  }

  if (!initialized) {
    const { setupFirebaseMock } = require('./mock-firebase');
    setupFirebaseMock(admin);
    console.log('⚡ PreçoFixo17: Operando em modo de dados resiliente (in-memory mock ativo).');
  }
}

const db = admin.database();
const auth = admin.auth();
const authRoutes = require('./routes/auth');
const firebaseSessionRoutes = require('./routes/firebase-session');
const passwordResetRoutes = require('./routes/password-reset');
const driverRoutes = require('./routes/drivers');
const rideRoutes = require('./routes/rides');
const pendingRideRoutes = require('./routes/pending-rides');
const locationRoutes = require('./routes/location');
const ratingRoutes = require('./routes/ratings');
const adminStatsRoutes = require('./routes/admin-stats');

const app = express();
const server = http.createServer(app);
const allowedOrigins = ['https://uber-clone-web.vercel.app', 'https://uber-clone-web-eric-jose.vercel.app', 'https://uber-clone-web-git-main-eric-jose.vercel.app', 'https://uber-clone-eric.vercel.app', 'http://localhost:3000'];
const isAllowedOrigin = (origin) => !origin || allowedOrigins.includes(origin) || /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin) || origin.includes('run.app') || origin.includes('localhost');
const corsOptions = { origin: true, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'], credentials: true };
app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));

const io = socketIo(server, { cors: { origin: true, methods: ['GET', 'POST'], credentials: true } });
rideRoutes.setSocketIo(io);
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
    return res.status(500).json({ error: 'Erro interno ao buscar corrida.' });
  }
});

app.use('/api/rides', rideRoutes);
app.use('/api/location', locationRoutes);
app.use('/api/ratings', ratingRoutes);
app.use('/api/admin-stats', adminStatsRoutes);

const healthHandler = (req, res) => res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
app.get('/health', healthHandler);
app.get('/api/health', healthHandler);
app.use((error, req, res, next) => { console.error('Erro não tratado na API:', error?.stack || error); if (res.headersSent) return next(error); return res.status(500).json({ error: 'Erro interno do servidor.' }); });

io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) return next(new Error('Não autenticado'));
    socket.user = jwt.verify(token, process.env.JWT_SECRET || 'precofixo17-dev-jwt-secret-2026');
    next();
  } catch (error) { next(new Error('Token inválido ou expirado')); }
});

function distanceKm(a, b) {
  const lat1 = Number(a?.lat ?? a?.latitude), lon1 = Number(a?.lng ?? a?.longitude), lat2 = Number(b?.lat ?? b?.latitude), lon2 = Number(b?.lng ?? b?.longitude);
  if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) return Infinity;
  const R = 6371, dLat = (lat2 - lat1) * Math.PI / 180, dLon = (lon2 - lon1) * Math.PI / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

async function findNearestDrivers(origin) {
  const [usersSnapshot, locationsSnapshot] = await Promise.all([db.ref('users').get(), db.ref('locations').get()]);
  const users = usersSnapshot.val() || {}, locations = locationsSnapshot.val() || {}, originLocation = origin?.location || origin?.currentLocation || origin;
  const drivers = [];
  for (const [uid, user] of Object.entries(users)) {
    if (user?.userType !== 'driver' || user?.driverApprovalStatus !== 'approved' || user?.isOnline !== true) continue;
    const location = user.currentLocation || locations[uid], distance = distanceKm(originLocation, location);
    if (Number.isFinite(distance)) drivers.push({ uid, distance });
  }
  return drivers.sort((a, b) => a.distance - b.distance);
}

async function saveDriverLocation(driverId, latitude, longitude) {
  const location = { latitude, longitude, lat: latitude, lng: longitude, timestamp: Date.now() };
  await db.ref(`locations/${driverId}`).set(location);
  await db.ref(`users/${driverId}`).update({ currentLocation: { lat: latitude, lng: longitude }, lastLocationUpdate: new Date().toISOString() });
  return location;
}

io.on('connection', async (socket) => {
  console.log('Cliente Socket.IO conectado:', socket.id, socket.user?.uid);
  socket.driverReady = false;
  socket.driverRoomLoading = false;

  socket.on('join-ride-room', async (rideId, acknowledge) => {
    const reply = typeof acknowledge === 'function' ? acknowledge : () => {};
    if (!rideId) return reply({ ok: false, reason: 'rideId ausente' });
    try {
      const snap = await db.ref(`rides/${rideId}`).get(), ride = snap.val(), uid = socket.user.uid;
      if (!ride || (ride.userId !== uid && ride.driverId !== uid)) return reply({ ok: false, reason: 'corrida não pertence ao usuário' });
      socket.join(`ride_${rideId}`);
      reply({ ok: true });
    } catch (error) {
      console.error('Erro ao entrar na corrida:', error.message);
      reply({ ok: false, reason: 'erro interno' });
    }
  });
  socket.on('leave-ride-room', (rideId) => { if (rideId) socket.leave(`ride_${rideId}`); });

  socket.on('join-drivers-room', async (acknowledge) => {
    const reply = typeof acknowledge === 'function' ? acknowledge : () => {};
    if (socket.driverReady || socket.driverRoomLoading) return reply({ ok: socket.driverReady, reason: socket.driverReady ? undefined : 'sincronização em andamento' });
    socket.driverRoomLoading = true;
    try {
      const snap = await db.ref(`users/${socket.user.uid}`).get(), driver = snap.val();
      const approvedOnline = driver?.userType === 'driver' && driver?.driverApprovalStatus === 'approved' && driver?.isOnline === true;
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
    } finally { socket.driverRoomLoading = false; }
  });

  socket.on('driver-presence-location', async (data = {}) => {
    const latitude = Number(data.latitude ?? data.lat), longitude = Number(data.longitude ?? data.lng), driverId = socket.user.uid;
    if (!socket.driverReady || !Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return;
    try { await saveDriverLocation(driverId, latitude, longitude); } catch (error) { console.error('Erro na localização do motorista online:', error.message); }
  });

  socket.on('driver-location', async (data = {}) => {
    const { rideId } = data, latitude = Number(data.latitude ?? data.lat), longitude = Number(data.longitude ?? data.lng), driverId = socket.user.uid;
    if (!rideId || !Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return;
    try {
      const snap = await db.ref(`rides/${rideId}`).get(), ride = snap.val();
      if (!ride || ride.driverId !== driverId || !['ACCEPTED', 'IN_PROGRESS'].includes(ride.status)) return;
      const location = await saveDriverLocation(driverId, latitude, longitude);
      io.to(`ride_${rideId}`).emit('update-driver-location', { driverId, ...location });
    } catch (error) { console.error('Erro na localização:', error.message); }
  });

  socket.on('passenger-location', async (data = {}) => {
    const rideId = data.rideId, passengerId = socket.user.uid;
    const latitude = Number(data.latitude ?? data.lat), longitude = Number(data.longitude ?? data.lng);
    if (!rideId || !Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return;
    try {
      const ref = db.ref(`rides/${rideId}`), snap = await ref.get(), ride = snap.val();
      if (!ride || ride.userId !== passengerId || !['SEARCHING', 'ACCEPTED', 'IN_PROGRESS'].includes(ride.status)) return;
      const location = { lat: latitude, lng: longitude, timestamp: Date.now() };
      await ref.update({ passengerLocation: location, 'origin/location': { lat: latitude, lng: longitude } });
      if (ride.driverId) io.to(`driver_${ride.driverId}`).emit('passenger-location-update', { rideId, passengerId, location });
      io.to(`ride_${rideId}`).emit('passenger-location-update', { rideId, passengerId, location });
    } catch (error) { console.error('Erro na localização do passageiro:', error.message); }
  });

  socket.on('request-ride', async (data = {}) => {
    if (!data.rideId) return;
    try {
      const rideRef = db.ref(`rides/${data.rideId}`), snap = await rideRef.get(), ride = snap.val();
      if (!ride || ride.userId !== socket.user.uid || ride.status !== 'SEARCHING') return;
      const nearestDrivers = await findNearestDrivers(ride.origin), request = { rideId: data.rideId, passengerId: socket.user.uid, passengerName: ride.passengerName || 'Passageiro', passengerProfilePhoto: ride.passengerProfilePhoto || null, origin: ride.origin, destination: ride.destination, passengerLocation: ride.passengerLocation || ride.origin?.location || null, price: ride.price, distance: ride.distance };
      const eligibleDrivers = nearestDrivers.filter((driver) => driver.distance <= 25);
      let offered = false;
      for (const driver of eligibleDrivers.slice(0, 10)) {
        const current = (await rideRef.get()).val();
        if (!current || current.status !== 'SEARCHING' || current.driverId) break;
        io.to(`driver_${driver.uid}`).emit('new-ride-request', { ...request, estimatedDistanceKm: Number(driver.distance.toFixed(2)), dispatchRadiusKm: 25, source: 'socket-dispatch' });
        offered = true;
        await new Promise(resolve => setTimeout(resolve, 8000));
        const afterOffer = (await rideRef.get()).val();
        if (!afterOffer || afterOffer.status !== 'SEARCHING' || afterOffer.driverId) break;
      }
      if (!offered) console.log('Nenhum motorista elegível recebeu a oferta da corrida:', data.rideId);
    } catch (error) { console.error('Erro ao encontrar motorista:', error.message); }
  });

  socket.on('accept-ride', (data = {}) => {
    if (!data.rideId) return;
    io.to(`ride_${data.rideId}`).emit('ride-accepted', { rideId: data.rideId, driverId: socket.user.uid });
  });

  socket.on('ride-cancelled', (data = {}) => { if (data.rideId) io.to(`ride_${data.rideId}`).emit('ride-cancelled', data); });
  socket.on('start-ride', (data = {}) => { if (data.rideId) io.to(`ride_${data.rideId}`).emit('ride-started', data); });
  socket.on('end-ride', (data = {}) => { if (data.rideId) io.to(`ride_${data.rideId}`).emit('ride-ended', data); });

  socket.on('disconnect', (reason) => console.log('Cliente Socket.IO desconectado:', socket.id, 'motivo:', reason));
});

const PORT = Number(process.env.PORT || 5000);
if (!process.env.VERCEL) {
  server.listen(PORT, () => {
    console.log(`Socket.IO ativo na porta ${PORT}`);
    console.log(`Servidor rodando na porta ${PORT}`);
  });
}

module.exports = { app, io, db, auth, server };
