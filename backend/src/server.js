require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { Server } = require('socket.io');
const connectDB = require('./config/database');
const User = require('./models/User');
const Driver = require('./models/Driver');
const mapsRouter = require('./routes/maps');
const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: true, credentials: true }
});

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '2mb' }));

const rides = new Map();

function signUser(user) {
  return jwt.sign({ id: user._id.toString(), userType: user.userType }, JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '7d' });
}

function safeUser(user) {
  return {
    uid: user._id.toString(),
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    phone: user.phone,
    userType: user.userType,
    profileImage: user.profileImage || null,
    profilePhoto: user.profileImage || null,
    rating: user.rating,
    totalRides: user.totalRides,
    createdAt: user.createdAt
  };
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
  } catch (_) {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
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
    const token = signUser(user);
    res.status(201).json({ token, user: safeUser(user) });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Erro ao cadastrar usuário.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user || !(await user.comparePassword(String(password || '')))) return res.status(401).json({ error: 'Email ou senha inválidos.' });
    const token = signUser(user);
    let driverApprovalStatus;
    if (user.userType === 'driver') {
      const driver = await Driver.findOne({ userId: user._id });
      driverApprovalStatus = driver?.status || 'pending';
    }
    res.json({ token, user: { ...safeUser(user), driverApprovalStatus } });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Erro ao entrar.' });
  }
});

app.get('/api/auth/verify', auth, async (req, res) => {
  let driverApprovalStatus;
  if (req.user.userType === 'driver') {
    const driver = await Driver.findOne({ userId: req.user._id });
    driverApprovalStatus = driver?.status || 'pending';
  }
  res.json({ valid: true, user: { ...safeUser(req.user), driverApprovalStatus } });
});

app.post('/api/drivers/register', auth, async (req, res) => {
  try {
    if (req.user.userType !== 'driver') req.user.userType = 'driver';
    const body = req.body || {};
    const existing = await Driver.findOne({ userId: req.user._id });
    const driverData = {
      userId: req.user._id,
      fullName: body.fullName || req.user.name,
      cpf: body.cpf,
      driverLicense: body.driverLicense,
      vehicleModel: body.vehicleModel,
      vehicleColor: body.vehicleColor,
      vehicleYear: Number(body.vehicleYear),
      licensePlate: body.licensePlate,
      bankName: body.bankName || 'Não informado',
      bankAccount: body.bankAccount || 'Não informado',
      bankRoutingNumber: body.bankRoutingNumber || 'Não informado',
      status: existing?.status || 'pending',
      documents: Array.isArray(body.documents) ? body.documents : (existing?.documents || [])
    };
    if (existing) Object.assign(existing, driverData); else await Driver.create(driverData);
    await req.user.save();
    const driver = await Driver.findOne({ userId: req.user._id });
    res.status(existing ? 200 : 201).json({ success: true, status: driver.status, driver });
  } catch (e) {
    res.status(400).json({ error: e.code === 11000 ? 'CPF já cadastrado.' : (e.message || 'Não foi possível concluir o cadastro de motorista.') });
  }
});

app.get('/api/drivers/me', auth, async (req, res) => {
  const driver = await Driver.findOne({ userId: req.user._id });
  res.json({ driver: driver || null });
});

app.get('/api/rides/history', auth, async (req, res) => {
  const list = Array.from(rides.values()).filter(r => r.passengerId === req.user._id.toString() || r.driverId === req.user._id.toString()).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ rides: list.slice(0, Math.min(Number(req.query.limit) || 20, 100)) });
});

app.post('/api/rides/request', auth, async (req, res) => {
  try {
    if (req.user.userType !== 'passenger') return res.status(403).json({ error: 'Somente passageiros podem solicitar corridas.' });
    const { origin, destination, distance, price } = req.body || {};
    if (!origin?.location || !destination?.location) return res.status(400).json({ error: 'Origem e destino são obrigatórios.' });
    const active = Array.from(rides.values()).find(r => r.passengerId === req.user._id.toString() && ['SEARCHING','ACCEPTED','IN_PROGRESS'].includes(r.status));
    if (active) return res.status(409).json({ error: 'Você já possui uma corrida em andamento.', ride: active });
    const ride = {
      id: new mongoose.Types.ObjectId().toString(),
      passengerId: req.user._id.toString(),
      passengerName: req.user.name,
      passengerProfilePhoto: req.user.profileImage || null,
      origin,
      destination,
      distance: Number(distance) || 0,
      price: Number(price) || 0,
      status: 'SEARCHING',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    rides.set(ride.id, ride);
    io.emit('ride-requested', ride);
    res.status(201).json({ ride });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Erro interno ao criar corrida.' });
  }
});

app.patch('/api/rides/:id/status', auth, async (req, res) => {
  const ride = rides.get(req.params.id);
  if (!ride) return res.status(404).json({ error: 'Corrida não encontrada.' });
  if (![ride.passengerId, ride.driverId].includes(req.user._id.toString())) return res.status(403).json({ error: 'Sem permissão.' });
  const status = String(req.body?.status || '').toUpperCase();
  const allowed = ['SEARCHING','ACCEPTED','IN_PROGRESS','COMPLETED','CANCELLED'];
  if (!allowed.includes(status)) return res.status(400).json({ error: 'Status inválido.' });
  ride.status = status;
  if (req.body?.cancellationReason) ride.cancellationReason = req.body.cancellationReason;
  if (status === 'COMPLETED') ride.completedAt = new Date().toISOString();
  ride.updatedAt = new Date().toISOString();
  rides.set(ride.id, ride);
  io.to(`ride:${ride.id}`).emit(`ride-${status.toLowerCase()}`, { rideId: ride.id, ride });
  res.json({ ride });
});

app.use('/api/maps', mapsRouter);

io.on('connection', socket => {
  socket.on('join-ride', rideId => { if (rideId) socket.join(`ride:${rideId}`); });
  socket.on('joinRideRoom', rideId => { if (rideId) socket.join(`ride:${rideId}`); });
  socket.on('request-ride', data => { if (data?.rideId) io.to(`ride:${data.rideId}`).emit('ride-requested', rides.get(data.rideId) || data); });
  socket.on('cancel-ride', rideId => { if (rideId) io.to(`ride:${rideId}`).emit('ride-cancelled', { rideId }); });
  socket.on('driver-location-update', data => { if (data?.rideId) io.to(`ride:${data.rideId}`).emit('update-driver-location', data); });
});

(async () => {
  await connectDB();
  server.listen(PORT, () => console.log(`🚗 Uber Clone backend ouvindo na porta ${PORT}`));
})();
