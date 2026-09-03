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
const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: true, credentials: true } });
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '2mb' }));

function signUser(user) { return jwt.sign({ id: user._id.toString(), userType: user.userType }, JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '7d' }); }
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
    res.status(201).json({ token: signUser(user), user: safeUser(user, userType === 'driver' ? 'pending' : undefined) });
  } catch (e) { res.status(500).json({ error: e.message || 'Erro ao cadastrar usuário.' }); }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const normalizedEmail = String(req.body?.email || '').trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user || !(await user.comparePassword(String(req.body?.password || '')))) return res.status(401).json({ error: 'Email ou senha inválidos.' });
    let approval;
    if (user.userType === 'driver') approval = (await Driver.findOne({ userId: user._id }))?.status || 'pending';
    res.json({ token: signUser(user), user: safeUser(user, approval) });
  } catch (e) { res.status(500).json({ error: e.message || 'Erro ao entrar.' }); }
});

app.get('/api/auth/verify', auth, async (req, res) => {
  const approval = req.user.userType === 'driver' ? (await Driver.findOne({ userId: req.user._id }))?.status || 'pending' : undefined;
  res.json({ valid: true, user: safeUser(req.user, approval) });
});

app.post('/api/drivers/register', auth, async (req, res) => {
  try {
    const body = req.body || {};
    const required = ['cpf', 'driverLicense', 'vehicleModel', 'vehicleColor', 'vehicleYear', 'licensePlate'];
    for (const key of required) if (!body[key]) return res.status(400).json({ error: `Campo obrigatório: ${key}` });
    const existing = await Driver.findOne({ userId: req.user._id });
    const driverData = {
      userId: req.user._id, fullName: body.fullName || req.user.name, cpf: String(body.cpf).trim(), driverLicense: String(body.driverLicense).trim(),
      vehicleModel: String(body.vehicleModel).trim(), vehicleColor: String(body.vehicleColor).trim(), vehicleYear: Number(body.vehicleYear), licensePlate: String(body.licensePlate).trim().toUpperCase(),
      bankName: body.bankName || 'Não informado', bankAccount: body.bankAccount || 'Não informado', bankRoutingNumber: body.bankRoutingNumber || 'Não informado',
      status: existing?.status || 'pending', documents: Array.isArray(body.documents) ? body.documents.map(d => ({ fileName: d.name || d.fileName || 'documento', fileUrl: d.fileUrl || '', uploadedAt: new Date() })) : (existing?.documents || [])
    };
    if (existing) Object.assign(existing, driverData), await existing.save(); else await Driver.create(driverData);
    if (req.user.userType !== 'driver') { req.user.userType = 'driver'; await req.user.save(); }
    const driver = await Driver.findOne({ userId: req.user._id });
    res.status(existing ? 200 : 201).json({ success: true, application: { status: driver.status }, status: driver.status, driver });
  } catch (e) { res.status(400).json({ error: e.code === 11000 ? 'CPF já cadastrado.' : (e.message || 'Não foi possível concluir o cadastro de motorista.') }); }
});

app.get('/api/drivers/me', auth, async (req, res) => res.json({ driver: await Driver.findOne({ userId: req.user._id }) }));

app.post('/api/drivers/:uid/status', auth, async (req, res) => {
  try {
    if (req.params.uid !== req.user._id.toString()) return res.status(403).json({ error: 'Sem permissão.' });
    const driver = await Driver.findOne({ userId: req.user._id });
    if (!driver) return res.status(404).json({ error: 'Cadastro de motorista não encontrado.' });
    if (driver.status !== 'approved') return res.status(403).json({ error: 'Motorista ainda não aprovado.' });
    driver.isOnline = Boolean(req.body?.isOnline);
    if (req.body?.currentLocation) driver.currentLocation = { lat: Number(req.body.currentLocation.lat), lng: Number(req.body.currentLocation.lng), updatedAt: new Date() };
    await driver.save();
    res.json({ success: true, driver });
  } catch (e) { res.status(500).json({ error: e.message || 'Não foi possível atualizar o status.' }); }
});

app.get('/api/rides/pending', auth, async (req, res) => {
  try {
    const driver = await Driver.findOne({ userId: req.user._id });
    if (!driver || driver.status !== 'approved') return res.json({ rides: [] });
    const rides = await Ride.find({ status: 'SEARCHING', driverId: null }).sort({ createdAt: 1 }).limit(20).lean();
    res.json({ rides: rides.map(serializeRide) });
  } catch (e) { res.status(500).json({ error: e.message || 'Erro ao buscar corridas.' }); }
});

app.get('/api/rides/history', auth, async (req, res) => {
  try {
    const filter = { $or: [{ passengerId: req.user._id }, { driverId: req.user._id }] };
    const rides = await Ride.find(filter).sort({ createdAt: -1 }).limit(Math.min(Number(req.query.limit) || 20, 100)).lean();
    res.json({ rides: rides.map(serializeRide) });
  } catch (e) { res.status(500).json({ error: e.message || 'Erro ao carregar histórico.' }); }
});

app.post('/api/rides/request', auth, async (req, res) => {
  try {
    if (req.user.userType !== 'passenger') return res.status(403).json({ error: 'Somente passageiros podem solicitar corridas.' });
    const { origin, destination, distance, price } = req.body || {};
    if (!origin?.location || !destination?.location) return res.status(400).json({ error: 'Origem e destino são obrigatórios.' });
    const active = await Ride.findOne({ passengerId: req.user._id, status: { $in: ['SEARCHING','ACCEPTED','IN_PROGRESS'] } });
    if (active) return res.status(409).json({ error: 'Você já possui uma corrida em andamento.', ride: serializeRide(active) });
    const ride = await Ride.create({ passengerId: req.user._id, passengerName: req.user.name, passengerProfilePhoto: req.user.profileImage || null,
      origin, destination, distance: Number(distance) || 0, price: Number(price) || 0, status: 'SEARCHING' });
    const out = serializeRide(ride);
    io.to('drivers').emit('new-ride-request', out);
    res.status(201).json({ ride: out });
  } catch (e) { res.status(500).json({ error: e.message || 'Erro interno ao criar corrida.' }); }
});

app.post('/api/rides/accept', auth, async (req, res) => {
  try {
    const driver = await Driver.findOne({ userId: req.user._id });
    if (!driver || driver.status !== 'approved') return res.status(403).json({ error: 'Motorista não aprovado.' });
    const ride = await Ride.findOneAndUpdate({ _id: req.body?.rideId, status: 'SEARCHING', driverId: null },
      { $set: { driverId: req.user._id, driverName: req.user.name, driverProfilePhoto: req.user.profileImage || null, status: 'ACCEPTED', updatedAt: new Date() } }, { new: true });
    if (!ride) return res.status(409).json({ error: 'Esta corrida já foi aceita ou não está disponível.' });
    const out = serializeRide(ride); io.to(`ride:${out.id}`).emit('ride-accepted', out); res.json({ ride: out });
  } catch (e) { res.status(500).json({ error: e.message || 'Erro ao aceitar corrida.' }); }
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
  } catch (e) { res.status(500).json({ error: e.message || 'Erro ao atualizar corrida.' }); }
});

app.use('/api/maps', mapsRouter);

io.on('connection', socket => {
  socket.on('join-ride-room', id => id && socket.join(`ride:${id}`));
  socket.on('leave-ride-room', id => id && socket.leave(`ride:${id}`));
  socket.on('join-drivers-room', () => socket.join('drivers'));
  socket.on('join-ride', id => id && socket.join(`ride:${id}`));
  socket.on('joinRideRoom', id => id && socket.join(`ride:${id}`));
  socket.on('request-ride', async data => { if (data?.rideId) { const ride = await Ride.findById(data.rideId).catch(() => null); if (ride) io.to('drivers').emit('new-ride-request', serializeRide(ride)); } });
  socket.on('accept-ride', async data => { if (!data?.rideId) return; });
  socket.on('driver-presence-location', async data => { socket.broadcast.to('drivers').emit('driver-presence-location', data); });
  socket.on('driver-location', async data => { if (!data?.rideId) return; const ride = await Ride.findById(data.rideId).catch(() => null); if (!ride) return; ride.driverLocation = { lat: Number(data.latitude), lng: Number(data.longitude) }; ride.updatedAt = new Date(); await ride.save().catch(() => {}); io.to(`ride:${data.rideId}`).emit('update-driver-location', data); });
  socket.on('cancel-ride', data => { const id = typeof data === 'string' ? data : data?.rideId; if (id) io.to(`ride:${id}`).emit('ride-cancelled', { rideId: id }); });
});

(async () => { await connectDB(); server.listen(PORT, () => console.log(`🚗 Uber Clone backend ouvindo na porta ${PORT}`)); })();
