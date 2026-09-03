require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const connectDB = require('./config/database');
const User = require('./models/User');
const Driver = require('./models/Driver');
const Ride = require('./models/Ride');
const mapsRouter = require('./routes/maps');
const adminRouter = require('./routes/admin');
const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: true, credentials: true } });
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
const DISPATCH_RADIUS_KM = Math.max(1, Number(process.env.DISPATCH_RADIUS_KM) || 25);
const DISPATCH_RADIUS_EXTENDED_KM = Math.max(DISPATCH_RADIUS_KM, Number(process.env.DISPATCH_RADIUS_EXTENDED_KM) || 50);
const DISPATCH_RADIUS_LONG_KM = Math.max(DISPATCH_RADIUS_EXTENDED_KM, Number(process.env.DISPATCH_RADIUS_LONG_KM) || 100);
const FRESH_LOCATION_MS = Math.max(30000, Number(process.env.DRIVER_LOCATION_FRESH_MS) || 120000);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '2mb' }));

function signUser(user) {
  return jwt.sign({ id: user._id.toString(), userType: user.userType }, JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '7d' });
}

function safeUser(user, driverApprovalStatus) {
  return { uid: user._id.toString(), id: user._id.toString(), name: user.name, email: user.email, phone: user.phone,
    userType: user.userType, profileImage: user.profileImage || null, profilePhoto: user.profileImage || null,
    rating: user.rating, totalRides: user.totalRides, createdAt: user.createdAt, driverApprovalStatus };
}

function serializeRide(r) {
  if (!r) return null;
  const x = r.toObject ? r.toObject() : r;
  return { ...x, id: x._id ? x._id.toString() : x.id, passengerId: x.passengerId?.toString?.() || x.passengerId || null,
    driverId: x.driverId?.toString?.() || x.driverId || null };
}

function normalizeLocation(value) {
  const lat = Number(value?.lat ?? value?.latitude);
  const lng = Number(value?.lng ?? value?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

function distanceKm(a, b) {
  if (!a || !b) return Infinity;
  const lat1 = Number(a.lat), lon1 = Number(a.lng), lat2 = Number(b.lat), lon2 = Number(b.lng);
  if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) return Infinity;
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const q = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(q), Math.sqrt(1 - q));
}

function freshDriverLocation(driver) {
  const location = normalizeLocation(driver?.currentLocation);
  const updatedAt = driver?.currentLocation?.updatedAt ? new Date(driver.currentLocation.updatedAt).getTime() : 0;
  return location && updatedAt && Date.now() - updatedAt <= FRESH_LOCATION_MS ? location : null;
}

function dispatchRank(ageMs) {
  if (ageMs < 15000) return 1;
  if (ageMs < 30000) return 2;
  if (ageMs < 60000) return 4;
  if (ageMs < 300000) return 8;
  return Number.MAX_SAFE_INTEGER;
}

function dispatchRadiusKm(ageMs) {
  if (ageMs < 60000) return DISPATCH_RADIUS_KM;
  if (ageMs < 300000) return DISPATCH_RADIUS_EXTENDED_KM;
  return DISPATCH_RADIUS_LONG_KM;
}

async function nearestDrivers(originLocation, radiusKm = DISPATCH_RADIUS_KM) {
  const drivers = await Driver.find({ status: 'approved', isOnline: true }).lean();
  return drivers.map(driver => {
    const location = freshDriverLocation(driver);
    if (!location) return null;
    const d = distanceKm(originLocation, location);
    if (!Number.isFinite(d) || d > radiusKm) return null;
    return { ...driver, distanceKm: Number(d.toFixed(2)) };
  }).filter(Boolean).sort((a, b) => a.distanceKm - b.distanceKm);
}

function emitToDriver(userId, event, payload) {
  const id = String(userId);
  for (const socket of io.sockets.sockets.values()) if (socket.data.userId === id) socket.emit(event, payload);
}

async function auth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Token não informado' });
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(payload.id);
    if (!user || !user.isActive) return res.status(401).json({ error: 'Sessão inválida' });
    req.user = user;
    next();
  } catch (_) { return res.status(401).json({ error: 'Token inválido ou expirado' }); }
}

app.get('/', (_req, res) => res.json({ ok: true, service: 'uber-clone-backend', timestamp: new Date().toISOString() }));
app.get('/health', (_req, res) => res.json({ ok: true, db: mongoose.connection.readyState === 1 }));

app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, phone, password, userType = 'passenger' } = req.body || {};
    if (!name || !email || !phone || !password) return res.status(400).json({ error: 'Preencha todos os campos obrigatórios.' });
    if (!['passenger', 'driver'].includes(userType)) return res.status(400).json({ error: 'Tipo de usuário inválido.' });
    const normalizedEmail = String(email).trim().toLowerCase();
    if (await User.findOne({ email: normalizedEmail })) return res.status(409).json({ error: 'Este email já está cadastrado.' });
    const user = await User.create({ name: String(name).trim(), email: normalizedEmail, phone: String(phone).trim(), password, userType });
    let driverApprovalStatus;
    if (userType === 'driver') driverApprovalStatus = 'registration_required';
    res.status(201).json({ token: signUser(user), user: safeUser(user, driverApprovalStatus) });
  } catch (e) { console.error('REGISTER_ERROR', e); res.status(500).json({ error: e.message || 'Erro ao cadastrar usuário.' }); }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const normalizedEmail = String(req.body?.email || '').trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user || !(await user.comparePassword(String(req.body?.password || '')))) return res.status(401).json({ error: 'Email ou senha inválidos.' });
    let approval;
    if (user.userType === 'driver') {
      const driver = await Driver.findOne({ userId: user._id });
      approval = driver?.status || 'registration_required';
    }
    res.json({ token: signUser(user), user: safeUser(user, approval) });
  } catch (e) { console.error('LOGIN_ERROR', e); res.status(500).json({ error: e.message || 'Erro ao entrar.' }); }
});

app.get('/api/auth/verify', auth, async (req, res) => {
  let approval;
  if (req.user.userType === 'driver') {
    const driver = await Driver.findOne({ userId: req.user._id });
    approval = driver?.status || 'registration_required';
  }
  res.json({ valid: true, user: safeUser(req.user, approval) });
});

app.post('/api/drivers/register', auth, async (req, res) => {
  try {
    const body = req.body || {};
    const required = ['cpf', 'driverLicense', 'vehicleModel', 'vehicleColor', 'vehicleYear', 'licensePlate'];
    for (const key of required) if (!body[key]) return res.status(400).json({ error: `Campo obrigatório: ${key}` });
    const existing = await Driver.findOne({ userId: req.user._id });
    const driverData = { userId: req.user._id, fullName: body.fullName || req.user.name, cpf: String(body.cpf).trim(), driverLicense: String(body.driverLicense).trim(), vehicleModel: String(body.vehicleModel).trim(), vehicleColor: String(body.vehicleColor).trim(), vehicleYear: Number(body.vehicleYear), licensePlate: String(body.licensePlate).trim().toUpperCase(), bankName: body.bankName || 'Não informado', bankAccount: body.bankAccount || 'Não informado', bankRoutingNumber: body.bankRoutingNumber || 'Não informado', status: existing?.status || 'pending', isOnline: existing?.isOnline || false, currentLocation: existing?.currentLocation, documents: Array.isArray(body.documents) ? body.documents.map(d => ({ fileName: d.name || d.fileName || 'documento', fileUrl: d.fileUrl || '', uploadedAt: new Date() })) : (existing?.documents || []) };
    if (existing) { Object.assign(existing, driverData); await existing.save(); } else await Driver.create(driverData);
    if (req.user.userType !== 'driver') { req.user.userType = 'driver'; await req.user.save(); }
    const driver = await Driver.findOne({ userId: req.user._id });
    res.status(existing ? 200 : 201).json({ success: true, application: { status: driver.status }, status: driver.status, driver });
  } catch (e) { console.error('DRIVER_REGISTER_ERROR', e); res.status(400).json({ error: e.code === 11000 ? 'CPF já cadastrado.' : (e.message || 'Não foi possível concluir o cadastro de motorista.') }); }
});

app.get('/api/drivers/me', auth, async (req, res) => res.json({ driver: await Driver.findOne({ userId: req.user._id }) }));

app.post('/api/drivers/:uid/status', auth, async (req, res) => {
  try {
    if (req.params.uid !== req.user._id.toString()) return res.status(403).json({ error: 'Sem permissão.' });
    const driver = await Driver.findOne({ userId: req.user._id });
    if (!driver) return res.status(404).json({ error: 'Cadastro de motorista não encontrado.' });
    if (driver.status !== 'approved') return res.status(403).json({ error: 'Motorista ainda não aprovado.' });
    const isOnline = Boolean(req.body?.isOnline);
    driver.isOnline = isOnline;
    if (req.body?.currentLocation) {
      const location = normalizeLocation(req.body.currentLocation);
      if (!location) return res.status(400).json({ error: 'Localização do motorista inválida.' });
      driver.currentLocation = { ...location, updatedAt: new Date() };
    }
    driver.updatedAt = new Date();
    await driver.save();
    res.json({ success: true, driver });
  } catch (e) { console.error('DRIVER_STATUS_ERROR', e); res.status(500).json({ error: e.message || 'Não foi possível atualizar o status.' }); }
});

app.get('/api/rides/pending', auth, async (req, res) => {
  try {
    const driver = await Driver.findOne({ userId: req.user._id }).lean();
    if (!driver || driver.status !== 'approved' || !driver.isOnline) return res.json({ rides: [] });
    const driverLocation = freshDriverLocation(driver);
    if (!driverLocation) return res.json({ rides: [] });
    const rides = await Ride.find({ status: 'SEARCHING', driverId: null }).sort({ createdAt: 1 }).limit(50).lean();
    const ranked = [];
    for (const ride of rides) {
      const originLocation = normalizeLocation(ride.origin?.location || ride.origin);
      if (!originLocation) continue;
      const ageMs = Date.now() - new Date(ride.createdAt).getTime();
      const radiusKm = dispatchRadiusKm(ageMs);
      const d = distanceKm(driverLocation, originLocation);
      if (!Number.isFinite(d) || d > radiusKm) continue;
      const candidates = await nearestDrivers(originLocation, radiusKm);
      const rankIndex = candidates.findIndex(candidate => String(candidate.userId) === String(driver.userId));
      if (rankIndex < 0) continue;
      const allowedRank = dispatchRank(ageMs);
      if (rankIndex + 1 > allowedRank) continue;
      ranked.push({ ...serializeRide(ride), estimatedDistanceKm: Number(d.toFixed(2)), dispatchRank: rankIndex + 1, dispatchRadiusKm: radiusKm });
    }
    ranked.sort((a, b) => (a.dispatchRank - b.dispatchRank) || (a.estimatedDistanceKm - b.estimatedDistanceKm) || (new Date(a.createdAt) - new Date(b.createdAt)));
    res.json({ rides: ranked.slice(0, 20) });
  } catch (e) { console.error('PENDING_RIDES_ERROR', e); res.status(500).json({ error: e.message || 'Erro ao buscar corridas.' }); }
});

app.get('/api/rides/history', auth, async (req, res) => {
  try {
    const filter = { $or: [{ passengerId: req.user._id }, { driverId: req.user._id }] };
    const rides = await Ride.find(filter).sort({ createdAt: -1 }).limit(Math.min(Number(req.query.limit) || 20, 100)).lean();
    res.json({ rides: rides.map(serializeRide) });
  } catch (e) { console.error('RIDE_HISTORY_ERROR', e); res.status(500).json({ error: e.message || 'Erro ao carregar histórico.' }); }
});

app.post('/api/rides/request', auth, async (req, res) => {
  try {
    if (req.user.userType !== 'passenger') return res.status(403).json({ error: 'Somente passageiros podem solicitar corridas.' });
    const { origin, destination, distance, price } = req.body || {};
    const originLocation = normalizeLocation(origin?.location || origin);
    const destinationLocation = normalizeLocation(destination?.location || destination);
    if (!originLocation || !destinationLocation) return res.status(400).json({ error: 'A localização de origem ou destino é inválida.' });
    const originAddress = String(origin?.address || '').trim();
    const destinationAddress = String(destination?.address || '').trim();
    if (!destinationAddress) return res.status(400).json({ error: 'Informe o endereço de destino.' });
    const numericDistance = Number(distance);
    const numericPrice = Number(price);
    if (!Number.isFinite(numericDistance) || numericDistance <= 0) return res.status(400).json({ error: 'A distância da corrida é inválida.' });
    if (!Number.isFinite(numericPrice) || numericPrice < 0) return res.status(400).json({ error: 'O valor da corrida é inválido.' });
    const active = await Ride.findOne({ passengerId: req.user._id, status: { $in: ['SEARCHING','ACCEPTED','IN_PROGRESS'] } });
    if (active) return res.status(409).json({ error: 'Você já possui uma corrida em andamento.', ride: serializeRide(active) });
    const ride = await Ride.create({ passengerId: req.user._id, passengerName: req.user.name, passengerProfilePhoto: req.user.profileImage || null,
      origin: { address: originAddress || 'Minha localização atual', location: originLocation }, destination: { address: destinationAddress, location: destinationLocation },
      distance: Number(numericDistance.toFixed(2)), price: Number(numericPrice.toFixed(2)), status: 'SEARCHING' });
    const out = serializeRide(ride);
    const nearest = await nearestDrivers(originLocation, DISPATCH_RADIUS_KM);
    if (nearest.length) {
      emitToDriver(nearest[0].userId, 'new-ride-request', { ...out, estimatedDistanceKm: nearest[0].distanceKm, dispatchRank: 1, dispatchRadiusKm: DISPATCH_RADIUS_KM });
      console.log('RIDE_DISPATCHED', out.id, 'driver', String(nearest[0].userId), 'distanceKm', nearest[0].distanceKm);
    } else {
      console.log('RIDE_WAITING_FOR_DRIVER', out.id);
    }
    console.log('RIDE_CREATED', out.id, 'passenger', req.user._id.toString());
    res.status(201).json({ ride: out });
  } catch (e) {
    console.error('RIDE_REQUEST_ERROR', { message: e.message, name: e.name, code: e.code, stack: e.stack });
    res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'Erro interno ao criar corrida. Verifique o backend e tente novamente.' : (e.message || 'Erro interno ao criar corrida.') });
  }
});

app.post('/api/rides/accept', auth, async (req, res) => {
  try {
    const driver = await Driver.findOne({ userId: req.user._id });
    if (!driver || driver.status !== 'approved' || !driver.isOnline) return res.status(403).json({ error: 'Motorista não aprovado ou offline.' });
    const rideId = req.body?.rideId;
    const currentRide = await Ride.findById(rideId).lean();
    if (!currentRide || currentRide.status !== 'SEARCHING' || currentRide.driverId) return res.status(409).json({ error: 'Esta corrida já foi aceita ou não está disponível.' });
    const originLocation = normalizeLocation(currentRide.origin?.location || currentRide.origin);
    const driverLocation = freshDriverLocation(driver);
    if (!originLocation || !driverLocation) return res.status(409).json({ error: 'Localização do motorista desatualizada. Atualize sua localização e tente novamente.' });
    const ageMs = Date.now() - new Date(currentRide.createdAt).getTime();
    const radiusKm = dispatchRadiusKm(ageMs);
    const candidates = await nearestDrivers(originLocation, radiusKm);
    const rankIndex = candidates.findIndex(candidate => String(candidate.userId) === String(req.user._id));
    if (rankIndex < 0) return res.status(409).json({ error: 'Você está fora da área de atendimento desta corrida.' });
    const allowedRank = dispatchRank(ageMs);
    if (rankIndex + 1 > allowedRank) return res.status(409).json({ error: 'A corrida ainda está sendo oferecida a um motorista mais próximo.' });
    const ride = await Ride.findOneAndUpdate({ _id: rideId, status: 'SEARCHING', driverId: null },
      { $set: { driverId: req.user._id, driverName: req.user.name, driverProfilePhoto: req.user.profileImage || null, status: 'ACCEPTED', updatedAt: new Date() } }, { new: true });
    if (!ride) return res.status(409).json({ error: 'Esta corrida já foi aceita ou não está disponível.' });
    const out = serializeRide(ride); io.to(`ride:${out.id}`).emit('ride-accepted', out); res.json({ ride: out });
  } catch (e) { console.error('RIDE_ACCEPT_ERROR', e); res.status(500).json({ error: e.message || 'Erro ao aceitar corrida.' }); }
});

app.patch('/api/rides/:id/status', auth, async (req, res) => {
  try {
    const ride = await Ride.findById(req.params.id);
    if (!ride) return res.status(404).json({ error: 'Corrida não encontrada.' });
    const uid = req.user._id.toString();
    if (![ride.passengerId?.toString(), ride.driverId?.toString()].includes(uid)) return res.status(403).json({ error: 'Sem permissão.' });
    const status = String(req.body?.status || '').toUpperCase();
    const allowed = ['SEARCHING','ACCEPTED','IN_PROGRESS','COMPLETED','CANCELLED'];
    if (!allowed.includes(status)) return res.status(400).json({ error: 'Status inválido.' });
    const validTransition = (ride.status === 'SEARCHING' && ['CANCELLED','ACCEPTED'].includes(status)) ||
      (ride.status === 'ACCEPTED' && ['IN_PROGRESS','CANCELLED'].includes(status)) ||
      (ride.status === 'IN_PROGRESS' && ['COMPLETED','CANCELLED'].includes(status)) || ride.status === status;
    if (!validTransition) return res.status(409).json({ error: `Não é possível mudar de ${ride.status} para ${status}.` });
    ride.status = status; ride.updatedAt = new Date();
    if (req.body?.cancellationReason) ride.cancellationReason = req.body.cancellationReason;
    if (status === 'COMPLETED') ride.completedAt = new Date();
    await ride.save();
    const out = serializeRide(ride); io.to(`ride:${out.id}`).emit(`ride-${status.toLowerCase()}`, { rideId: out.id, ride: out }); res.json({ ride: out });
  } catch (e) { console.error('RIDE_STATUS_ERROR', e); res.status(500).json({ error: e.message || 'Erro ao atualizar corrida.' }); }
});

app.use('/api/maps', mapsRouter);
app.use('/api', adminRouter);

io.on('connection', async socket => {
  try {
    const token = socket.handshake.auth?.token;
    if (token) {
      const payload = jwt.verify(token, JWT_SECRET);
      const user = await User.findById(payload.id).select('_id userType isActive').lean();
      if (!user || !user.isActive) {
        socket.disconnect(true);
        return;
      }
      socket.data.userId = String(user._id);
      socket.data.userType = user.userType;
    }
  } catch (_) {
    socket.data.userId = null;
    socket.data.userType = null;
    socket.disconnect(true);
    return;
  }

  socket.on('join-ride-room', id => id && socket.join(`ride:${id}`));
  socket.on('leave-ride-room', id => id && socket.leave(`ride:${id}`));
  socket.on('join-drivers-room', () => { if (socket.data.userType === 'driver') socket.join('drivers'); });
  socket.on('join-ride', id => id && socket.join(`ride:${id}`));
  socket.on('joinRideRoom', id => id && socket.join(`ride:${id}`));
  socket.on('request-ride', async data => {
    if (!data?.rideId) return;
    const ride = await Ride.findById(data.rideId).catch(() => null);
    if (!ride || ride.status !== 'SEARCHING' || ride.driverId) return;
    const originLocation = normalizeLocation(ride.origin?.location || ride.origin);
    if (!originLocation) return;
    const ageMs = Date.now() - new Date(ride.createdAt).getTime();
    const radiusKm = dispatchRadiusKm(ageMs);
    const nearest = await nearestDrivers(originLocation, radiusKm);
    if (nearest.length) emitToDriver(nearest[0].userId, 'new-ride-request', { ...serializeRide(ride), estimatedDistanceKm: nearest[0].distanceKm, dispatchRank: 1, dispatchRadiusKm: radiusKm });
  });
  socket.on('driver-presence-location', async data => {
    try {
      if (socket.data.userType !== 'driver' || !socket.data.userId) return;
      const location = normalizeLocation(data);
      if (!location) return;
      const driver = await Driver.findOne({ userId: socket.data.userId });
      if (!driver || driver.status !== 'approved') return;
      driver.currentLocation = { ...location, updatedAt: new Date() };
      await driver.save();
    } catch (e) { console.error('DRIVER_PRESENCE_ERROR', e); }
  });
  socket.on('driver-location', async data => {
    try {
      if (!data?.rideId || socket.data.userType !== 'driver') return;
      const ride = await Ride.findById(data.rideId).catch(() => null);
      if (!ride || String(ride.driverId) !== String(socket.data.userId)) return;
      const location = normalizeLocation(data);
      if (!location) return;
      ride.driverLocation = location; ride.updatedAt = new Date(); await ride.save();
      const driver = await Driver.findOne({ userId: socket.data.userId });
      if (driver) { driver.currentLocation = { ...location, updatedAt: new Date() }; driver.isOnline = true; await driver.save(); }
      io.to(`ride:${data.rideId}`).emit('update-driver-location', { ...data, latitude: location.lat, longitude: location.lng });
    } catch (e) { console.error('DRIVER_LOCATION_ERROR', e); }
  });
  socket.on('cancel-ride', data => { const id = typeof data === 'string' ? data : data?.rideId; if (id) io.to(`ride:${id}`).emit('ride-cancelled', { rideId: id }); });
});

(async () => { await connectDB(); server.listen(PORT, () => console.log(`🚗 Uber Clone backend ouvindo na porta ${PORT}`)); })();
