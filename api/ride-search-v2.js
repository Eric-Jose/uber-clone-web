const admin = require('firebase-admin');
const jwt = require('jsonwebtoken');

function clean(value) {
  return String(value ?? '')
    .trim()
    .replace(/^['\"]|['\"]$/g, '')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r');
}

function init() {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: clean(process.env.FIREBASE_PROJECT_ID),
        clientEmail: clean(process.env.FIREBASE_CLIENT_EMAIL),
        privateKey: clean(process.env.FIREBASE_PRIVATE_KEY),
      }),
      databaseURL:
        clean(process.env.FIREBASE_DATABASE_URL) ||
        'https://uber-clone-eric-f4327-default-rtdb.firebaseio.com/',
    });
  }
  return admin.database();
}

function auth(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  try {
    return jwt.verify(header.slice(7), process.env.JWT_SECRET);
  } catch (_) {
    return null;
  }
}

function normalizeLocation(value) {
  const source = value?.location || value?.currentLocation || value || {};
  const lat = Number(source.lat ?? source.latitude);
  const lng = Number(source.lng ?? source.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

function distanceKm(a, b) {
  const lat1 = Number(a?.lat ?? a?.latitude);
  const lon1 = Number(a?.lng ?? a?.longitude);
  const lat2 = Number(b?.lat ?? b?.latitude);
  const lon2 = Number(b?.lng ?? b?.longitude);
  if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) return Infinity;

  const radius = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) ** 2;
  return 2 * radius * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const user = auth(req);
  if (!user?.uid) {
    return res.status(401).json({ error: 'Token inválido ou expirado.' });
  }

  try {
    const database = init();
    const rideId = String(req.body?.rideId || '').trim();
    if (!rideId) return res.status(400).json({ error: 'rideId é obrigatório.' });

    const ref = database.ref(`rides/${rideId}`);
    const ride = (await ref.get()).val();
    if (!ride) return res.status(404).json({ error: 'Corrida não encontrada.' });
    if (String(ride.userId) !== String(user.uid)) {
      return res.status(403).json({ error: 'Acesso negado.' });
    }
    if (ride.status !== 'SEARCHING' || ride.driverId) {
      return res.status(409).json({
        error: 'A corrida não está disponível para busca.',
        ride,
      });
    }

    const now = Date.now();
    await ref.update({ updatedAt: now, searchRequestedAt: now });

    const users = (await database.ref('users').get()).val() || {};
    const locations = (await database.ref('locations').get()).val() || {};
    const origin = normalizeLocation(ride.origin);
    const radiusKm = Number(process.env.RIDE_DISPATCH_RADIUS_KM || 25);

    if (!origin) {
      return res.status(400).json({ error: 'A localização de embarque da corrida é inválida.' });
    }

    const candidates = [];
    for (const [uid, profile] of Object.entries(users)) {
      if (uid === String(user.uid)) continue;
      if (profile?.userType !== 'driver') continue;
      if (profile?.driverApprovalStatus !== 'approved') continue;
      if (profile?.isOnline !== true) continue;

      const loc = normalizeLocation(profile.currentLocation || locations[uid]);
      if (!loc) continue;

      const distance = distanceKm(origin, loc);
      if (Number.isFinite(distance) && distance <= radiusKm) {
        candidates.push({ uid, distance });
      }
    }

    candidates.sort((a, b) => a.distance - b.distance);

    const updates = {};
    for (const candidate of candidates.slice(0, 20)) {
      updates[`driverNotifications/${candidate.uid}/${rideId}`] = {
        rideId,
        status: 'SEARCHING',
        type: 'new-ride-request',
        createdAt: now,
        distanceKm: Number(candidate.distance.toFixed(2)),
        pickupLocation: ride.passengerLocation || ride.origin?.location || null,
        pickupAddress: ride.origin?.address || '',
        dropoffLocation: ride.destination?.location || null,
        dropoffAddress: ride.destination?.address || '',
        price: Number(ride.price ?? 17),
        distance: Number(ride.distance ?? 0),
        passengerName: ride.passengerName || 'Passageiro',
        passengerProfilePhoto: ride.passengerProfilePhoto || null,
      };
    }

    if (Object.keys(updates).length > 0) {
      await database.ref().update(updates);
    }

    return res.status(200).json({
      success: true,
      rideId,
      status: 'SEARCHING',
      driversNotified: candidates.length,
      nearestDriverDistanceKm: candidates.length
        ? Number(candidates[0].distance.toFixed(2))
        : null,
    });
  } catch (error) {
    console.error(
      'Erro ao iniciar busca da corrida:',
      error?.stack || error,
    );
    return res.status(500).json({
      error: 'Não foi possível iniciar a busca da corrida.',
    });
  }
};
