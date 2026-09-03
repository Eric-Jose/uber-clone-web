const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const Driver = require('../models/Driver');
const Ride = require('../models/Ride');
const { getFirebaseAdmin } = require('../config/firebaseAdmin');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
const ADMIN_EMAIL = String(process.env.ADMIN_EMAIL || 'admin@uberclone.com').trim().toLowerCase();
const ADMIN_PASSWORD = String(process.env.ADMIN_PASSWORD || 'UberClone@2026!');

function signAdmin() {
  return jwt.sign({ id: 'admin', userType: 'admin' }, JWT_SECRET, { expiresIn: process.env.ADMIN_JWT_EXPIRE || '12h' });
}

function signUser(user) {
  return jwt.sign({ id: user._id.toString(), userType: user.userType }, JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '7d' });
}

function safeUser(user, driverApprovalStatus) {
  return { uid: user._id.toString(), id: user._id.toString(), name: user.name, email: user.email, phone: user.phone,
    userType: user.userType, profileImage: user.profileImage || null, profilePhoto: user.profileImage || null,
    rating: user.rating, totalRides: user.totalRides, createdAt: user.createdAt, driverApprovalStatus };
}

function adminAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Token administrativo não informado.' });
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.userType !== 'admin' || payload.id !== 'admin') return res.status(403).json({ error: 'Acesso administrativo negado.' });
    req.admin = { id: 'admin', userType: 'admin', name: 'Administrador', email: ADMIN_EMAIL };
    next();
  } catch (_) {
    return res.status(401).json({ error: 'Sessão administrativa inválida ou expirada.' });
  }
}

// Reestabelece a sessão do aplicativo a partir da sessão persistente do Firebase.
// O usuário MongoDB existente é preservado e apenas recebe o firebaseUid.
router.post('/auth/firebase-session', async (req, res) => {
  try {
    const firebase = getFirebaseAdmin();
    if (!firebase) return res.status(503).json({ error: 'Firebase Admin não configurado no backend.' });
    const idToken = String(req.body?.idToken || '').trim();
    if (!idToken) return res.status(401).json({ error: 'Token Firebase não informado.' });

    const decoded = await firebase.auth().verifyIdToken(idToken);
    const email = String(decoded.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ error: 'A conta Firebase não possui email.' });

    let user = await User.findOne({ firebaseUid: decoded.uid });
    if (!user) user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado no MongoDB.' });
    if (!user.isActive) return res.status(403).json({ error: 'Usuário desativado.' });

    if (user.firebaseUid !== decoded.uid) {
      user.firebaseUid = decoded.uid;
      await user.save();
    }

    let approval;
    if (user.userType === 'driver') {
      const driver = await Driver.findOne({ userId: user._id });
      approval = driver?.status || 'registration_required';
    }

    return res.json({ token: signUser(user), user: safeUser(user, approval), firebaseUid: decoded.uid });
  } catch (e) {
    console.error('FIREBASE_SESSION_ERROR', e);
    return res.status(401).json({ error: 'Sessão Firebase inválida ou expirada.' });
  }
});

router.post('/auth/admin-login', (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Email ou senha administrativa inválidos.' });
  return res.json({ token: signAdmin(), admin: { id: 'admin', uid: 'admin', name: 'Administrador', email: ADMIN_EMAIL, userType: 'admin' } });
});

router.use(adminAuth);

router.get('/drivers/applications', async (_req, res) => {
  try {
    const drivers = await Driver.find({}).sort({ createdAt: -1 }).lean();
    const ids = drivers.map(d => d.userId).filter(Boolean);
    const users = await User.find({ _id: { $in: ids } }).select('name email phone profileImage createdAt').lean();
    const usersById = new Map(users.map(u => [String(u._id), u]));
    const applications = drivers.map(driver => {
      const user = usersById.get(String(driver.userId));
      return {
        uid: String(driver.userId), fullName: driver.fullName || user?.name || 'Sem nome', email: user?.email || '', phone: user?.phone || '',
        profileImage: user?.profileImage || null, vehicleModel: driver.vehicleModel, vehicleColor: driver.vehicleColor, vehicleYear: driver.vehicleYear,
        licensePlate: driver.licensePlate, cpf: driver.cpf, driverLicense: driver.driverLicense, bankName: driver.bankName, bankAccount: driver.bankAccount,
        bankRoutingNumber: driver.bankRoutingNumber, status: driver.status, approvalReason: driver.approvalReason || '', rejectionReason: driver.rejectionReason || '',
        approvedAt: driver.approvedAt || null, rejectedAt: driver.rejectedAt || null, createdAt: driver.createdAt, updatedAt: driver.updatedAt
      };
    });
    res.json({ applications });
  } catch (e) {
    console.error('ADMIN_DRIVER_APPLICATIONS_ERROR', e);
    res.status(500).json({ error: 'Não foi possível carregar os cadastros de motoristas.' });
  }
});

router.patch('/drivers/:uid/approval', async (req, res) => {
  try {
    const status = String(req.body?.status || '').toLowerCase();
    if (!['approved', 'rejected', 'pending'].includes(status)) return res.status(400).json({ error: 'Status de aprovação inválido.' });
    if (!mongoose.isValidObjectId(req.params.uid)) return res.status(400).json({ error: 'ID do motorista inválido.' });
    const driver = await Driver.findOne({ userId: req.params.uid });
    if (!driver) return res.status(404).json({ error: 'Cadastro de motorista não encontrado.' });
    const now = new Date();
    driver.status = status; driver.updatedAt = now;
    if (status === 'approved') { driver.approvedAt = now; driver.rejectedAt = null; driver.rejectionReason = ''; driver.isOnline = false; }
    else if (status === 'rejected') { driver.rejectedAt = now; driver.approvedAt = null; driver.rejectionReason = String(req.body?.reason || 'Cadastro rejeitado pelo administrador.'); driver.isOnline = false; }
    else { driver.approvedAt = null; driver.rejectedAt = null; driver.rejectionReason = ''; driver.isOnline = false; }
    if (status === 'approved') driver.approvalReason = String(req.body?.reason || 'Cadastro aprovado.');
    await driver.save();
    res.json({ success: true, status: driver.status, driver });
  } catch (e) {
    console.error('ADMIN_DRIVER_APPROVAL_ERROR', e);
    res.status(500).json({ error: 'Não foi possível atualizar a aprovação do motorista.' });
  }
});

router.get('/admin-stats/overview', async (_req, res) => {
  try {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(start); end.setDate(end.getDate() + 1);
    const [passengers, drivers, onlineDrivers, ridesToday, activeRides, completedToday, cancelledToday, revenueAgg] = await Promise.all([
      User.countDocuments({ userType: 'passenger', isActive: true }), Driver.countDocuments({}), Driver.countDocuments({ status: 'approved', isOnline: true }),
      Ride.countDocuments({ createdAt: { $gte: start, $lt: end } }), Ride.countDocuments({ status: { $in: ['SEARCHING', 'ACCEPTED', 'IN_PROGRESS'] } }),
      Ride.countDocuments({ status: 'COMPLETED', completedAt: { $gte: start, $lt: end } }), Ride.countDocuments({ status: 'CANCELLED', updatedAt: { $gte: start, $lt: end } }),
      Ride.aggregate([{ $match: { status: 'COMPLETED', completedAt: { $gte: start, $lt: end } } }, { $group: { _id: null, total: { $sum: { $ifNull: ['$price', 0] } } } }])
    ]);
    const since = new Date(start); since.setDate(since.getDate() - 6);
    const dailyAgg = await Ride.aggregate([{ $match: { createdAt: { $gte: since, $lt: end } } }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, rides: { $sum: 1 } } }, { $sort: { _id: 1 } }]);
    const dailyMap = new Map(dailyAgg.map(d => [d._id, d.rides]));
    const daily = [];
    for (let i = 0; i < 7; i++) { const date = new Date(since); date.setDate(since.getDate() + i); const key = date.toISOString().slice(0, 10); daily.push({ date: key, rides: dailyMap.get(key) || 0 }); }
    res.json({ totals: { passengers, drivers, onlineDrivers, ridesToday, activeRides, completedToday, cancelledToday, revenueToday: Number(revenueAgg[0]?.total || 0) }, daily });
  } catch (e) {
    console.error('ADMIN_STATS_ERROR', e);
    res.status(500).json({ error: 'Não foi possível carregar as estatísticas administrativas.' });
  }
});

module.exports = router;
