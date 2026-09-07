const express = require('express');
const admin = require('firebase-admin');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const db = admin.database();
router.use(authenticate);

async function requireAdmin(req, res, next) {
  try {
    const user = (await db.ref(`users/${req.user.uid}`).get()).val();
    if (!user || (user.userType !== 'admin' && user.role !== 'admin')) {
      return res.status(403).json({ error: 'Acesso administrativo necessário.' });
    }
    req.adminUser = user;
    return next();
  } catch (error) {
    console.error('Falha ao validar administrador:', error.message);
    return res.status(500).json({ error: 'Não foi possível validar o administrador.' });
  }
}

function dateKey(timestamp) {
  return new Date(Number(timestamp) || 0).toISOString().slice(0, 10);
}

function buildOverview(users, rides, applications) {
  const drivers = new Map();
  let passengers = 0;
  users.forEach((child) => {
    const user = child.val() || {};
    if (user.userType === 'passenger') passengers += 1;
    if (user.userType === 'driver') {
      drivers.set(child.key, {
        status: user.driverApprovalStatus || user.driverApplication?.status || 'pending',
        isOnline: user.isOnline === true,
      });
    }
  });
  applications.forEach((child) => {
    const app = child.val() || {};
    const current = drivers.get(child.key) || {};
    drivers.set(child.key, {
      ...current,
      status: app.status || current.status || 'pending',
    });
  });

  let approvedDrivers = 0;
  let pendingDrivers = 0;
  let rejectedDrivers = 0;
  let onlineDrivers = 0;
  for (const driver of drivers.values()) {
    if (driver.status === 'approved') {
      approvedDrivers += 1;
      if (driver.isOnline) onlineDrivers += 1;
    } else if (driver.status === 'rejected') {
      rejectedDrivers += 1;
    } else {
      pendingDrivers += 1;
    }
  }

  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const start7 = startToday - 6 * 86400000;
  let ridesToday = 0;
  let completedToday = 0;
  let cancelledToday = 0;
  let activeRides = 0;
  let revenueToday = 0;
  const daily = Array.from({ length: 7 }, (_, index) => {
    const start = startToday - (6 - index) * 86400000;
    return { date: new Date(start).toISOString().slice(0, 10), rides: 0, completed: 0, cancelled: 0, revenue: 0 };
  });

  const rideList = [];
  rides.forEach((child) => {
    const ride = child.val();
    if (!ride) return;
    rideList.push(ride);
    const ts = Number(ride.createdAt || ride.acceptedAt || ride.updatedAt || 0);
    if (['SEARCHING', 'ACCEPTED', 'IN_PROGRESS'].includes(ride.status)) activeRides += 1;
    if (ts >= startToday) {
      ridesToday += 1;
      if (ride.status === 'COMPLETED') {
        completedToday += 1;
        revenueToday += Number(ride.price) || 0;
      }
      if (ride.status === 'CANCELLED') cancelledToday += 1;
    }
    if (ts >= start7) {
      const bucket = daily.find((item) => item.date === dateKey(ts));
      if (bucket) {
        bucket.rides += 1;
        if (ride.status === 'COMPLETED') {
          bucket.completed += 1;
          bucket.revenue += Number(ride.price) || 0;
        }
        if (ride.status === 'CANCELLED') bucket.cancelled += 1;
      }
    }
  });

  rideList.sort((a, b) => Number(b.updatedAt || b.createdAt || 0) - Number(a.updatedAt || a.createdAt || 0));

  return {
    passengers,
    drivers: drivers.size,
    approvedDrivers,
    pendingDrivers,
    rejectedDrivers,
    onlineDrivers,
    ridesToday,
    activeRides,
    completedToday,
    cancelledToday,
    revenueToday: Number(revenueToday.toFixed(2)),
    daily,
    recentRides: rideList.slice(0, 50),
  };
}

router.get('/overview', requireAdmin, async (req, res) => {
  try {
    const [users, rides, applications] = await Promise.all([
      db.ref('users').get(),
      db.ref('rides').get(),
      db.ref('driverApplications').get(),
    ]);
    return res.json({ success: true, totals: buildOverview(users, rides, applications), daily: buildOverview(users, rides, applications).daily });
  } catch (error) {
    console.error('Erro ao carregar estatísticas administrativas:', error.message);
    return res.status(500).json({ error: 'Erro ao carregar estatísticas administrativas.' });
  }
});

router.get('/data', requireAdmin, async (req, res) => {
  try {
    const [usersSnapshot, ridesSnapshot, ratingsSnapshot, applicationsSnapshot] = await Promise.all([
      db.ref('users').get(),
      db.ref('rides').get(),
      db.ref('ratings').get(),
      db.ref('driverApplications').get(),
    ]);

    const users = [];
    const drivers = [];
    usersSnapshot.forEach((child) => {
      const user = child.val() || {};
      if (user.userType === 'admin') return;
      const base = {
        uid: child.key,
        name: user.name || user.fullName || user.email || 'Usuário',
        email: user.email || '',
        phone: user.phone || '',
        role: user.userType === 'driver' ? 'Motorista' : 'Passageiro',
        status: user.disabled === true ? 'Bloqueado' : 'Ativo',
        createdAt: user.createdAt || null,
      };
      users.push(base);
      if (user.userType === 'driver') {
        const application = applicationsSnapshot.child(child.key).val() || user.driverApplication || {};
        const profile = user.driverProfile || user.vehicle || {};
        drivers.push({
          uid: child.key,
          name: base.name,
          email: base.email,
          vehicle: profile.model || profile.vehicleModel || profile.description || 'Veículo não informado',
          plate: profile.plate || profile.licensePlate || '',
          rating: Number(user.ratingAverage || user.rating || 0).toFixed(1),
          status: user.isOnline === true ? 'Online' : 'Offline',
          approvalStatus: user.driverApprovalStatus || application.status || 'pending',
        });
      }
    });

    const rides = [];
    ridesSnapshot.forEach((child) => {
      const ride = child.val();
      if (!ride) return;
      rides.push({
        id: ride.id || child.key,
        userId: ride.userId || null,
        driverId: ride.driverId || null,
        passengerName: ride.passengerName || 'Passageiro',
        driverName: ride.driverName || '—',
        origin: ride.origin?.address || 'Origem não informada',
        destination: ride.destination?.address || 'Destino não informado',
        price: Number(ride.price) || 0,
        status: ride.status || 'UNKNOWN',
        createdAt: ride.createdAt || ride.updatedAt || 0,
      });
    });
    rides.sort((a, b) => Number(b.createdAt) - Number(a.createdAt));

    const reviews = [];
    ratingsSnapshot.forEach((child) => {
      const item = child.val();
      if (!item) return;
      reviews.push({
        id: child.key,
        rideId: item.rideId || null,
        raterId: item.raterId || null,
        targetId: item.targetId || null,
        score: Number(item.rating) || 0,
        comment: item.comment || '',
        createdAt: item.createdAt || 0,
      });
    });
    reviews.sort((a, b) => Number(b.createdAt) - Number(a.createdAt));

    return res.json({
      success: true,
      users: users.slice(0, 500),
      drivers: drivers.slice(0, 500),
      rides: rides.slice(0, 500),
      reviews: reviews.slice(0, 500),
    });
  } catch (error) {
    console.error('Erro ao carregar dados administrativos:', error.message);
    return res.status(500).json({ error: 'Erro ao carregar dados administrativos.' });
  }
});

module.exports = router;
