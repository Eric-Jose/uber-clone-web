const express = require('express');
const admin = require('firebase-admin');
const { authenticate } = require('../middleware/auth');
const router = express.Router();
const db = admin.database();
let io = null;
const dispatchingRideIds = new Set();
const acceptingRideIds = new Set();
const VALID_STATUSES = ['SEARCHING', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
const ACTIVE_STATUSES = ['SEARCHING', 'ACCEPTED', 'IN_PROGRESS'];
const DISPATCH_RADIUS_KM = Math.max(1, Number(process.env.DISPATCH_RADIUS_KM) || 25);
const DISPATCH_RADIUS_EXTENDED_KM = Math.max(DISPATCH_RADIUS_KM, Number(process.env.DISPATCH_RADIUS_EXTENDED_KM) || 50);
const DISPATCH_RADIUS_LONG_KM = Math.max(DISPATCH_RADIUS_EXTENDED_KM, Number(process.env.DISPATCH_RADIUS_LONG_KM) || 100);
const ARRIVAL_RADIUS_KM = Math.max(0.5, Number(process.env.ARRIVAL_RADIUS_KM) || (process.env.NODE_ENV === 'production' && process.env.STRICT_PROXIMITY === 'true' ? 0.5 : 25));
const FIXED_RIDE_PRICE = 17;
router.setSocketIo = (value) => { io = value; };
const emitToRide = (id, event, payload) => { if (io && id) io.to(`ride_${id}`).emit(event, payload); };
function normalizeLocation(value) {
  const source = value?.location || value?.currentLocation || value || {};
  const lat = Number(source.lat ?? source.latitude);
  const lng = Number(source.lng ?? source.longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 ? { lat, lng } : null;
}
function distanceKm(a, b) {
  const lat1 = Number(a?.lat ?? a?.latitude), lon1 = Number(a?.lng ?? a?.longitude), lat2 = Number(b?.lat ?? b?.latitude), lon2 = Number(b?.lng ?? b?.longitude);
  if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) return Infinity;
  const R = 6371, dLat = (lat2 - lat1) * Math.PI / 180, dLon = (lon2 - lon1) * Math.PI / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}
function rideAgeMs(ride) {
  const createdAt = Number(ride?.createdAt);
  return Number.isFinite(createdAt) ? Math.max(0, Date.now() - createdAt) : 0;
}
function dispatchRadiusKm(ageMs) { if (ageMs < 60000) return DISPATCH_RADIUS_KM; if (ageMs < 300000) return DISPATCH_RADIUS_EXTENDED_KM; return DISPATCH_RADIUS_LONG_KM; }
async function findEligibleDrivers(origin, radiusKm = DISPATCH_RADIUS_KM) {
  const [usersSnapshot, locationsSnapshot] = await Promise.all([db.ref('users').get(), db.ref('locations').get()]);
  const users = usersSnapshot.val() || {}, locations = locationsSnapshot.val() || {}, normalizedOrigin = normalizeLocation(origin), drivers = [];
  if (!normalizedOrigin) return drivers;
  for (const [uid, user] of Object.entries(users)) {
    if (user?.userType !== 'driver' || user?.driverApprovalStatus !== 'approved' || user?.isOnline !== true) continue;
    const loc = normalizeLocation(user.currentLocation || locations[uid]), distance = distanceKm(normalizedOrigin, loc);
    if (Number.isFinite(distance) && distance <= radiusKm) drivers.push({ uid, distance });
  }
  return drivers.sort((a, b) => a.distance - b.distance);
}
async function notifyDriversHttpFallback(ride) {
  if (!ride?.id || ride.status !== 'SEARCHING') return [];
  try {
    const radiusKm = dispatchRadiusKm(rideAgeMs(ride));
    const drivers = await findEligibleDrivers(ride.origin, radiusKm);
    const payload = { ...ride, rideId: ride.id, passengerLocation: ride.passengerLocation || ride.origin?.location || null, estimatedDistanceKm: null, dispatchRadiusKm: radiusKm, source: 'backend-dispatch-http' };
    await Promise.all(drivers.slice(0, 20).map(async (driver) => {
      try {
        await db.ref(`driverNotifications/${driver.uid}/${ride.id}`).set({ ...payload, estimatedDistanceKm: Number(driver.distance.toFixed(2)), createdAt: admin.database.ServerValue.TIMESTAMP, type: 'new-ride-request' });
      } catch (error) { console.error('Falha ao publicar notificação de corrida ao motorista:', error.message); }
    }));
    return drivers;
  } catch (error) { console.error('Erro no fallback HTTP do despacho:', error.message); return []; }
}
async function dispatchRide(ride) {
  if (!ride?.id || ride.status !== 'SEARCHING' || dispatchingRideIds.has(ride.id)) return;
  dispatchingRideIds.add(ride.id);
  try {
    const radiusKm = dispatchRadiusKm(rideAgeMs(ride)), drivers = await findEligibleDrivers(ride.origin, radiusKm);
    if (!io || !io.sockets?.adapter?.rooms) { await notifyDriversHttpFallback(ride); return; }
    for (const driver of drivers.slice(0, 10)) {
      const current = (await db.ref(`rides/${ride.id}`).get()).val();
      if (!current || current.status !== 'SEARCHING' || current.driverId) break;
      const room = io.sockets.adapter.rooms.get(`driver_${driver.uid}`);
      if (room?.size) io.to(`driver_${driver.uid}`).emit('new-ride-request', { ...current, rideId: ride.id, passengerLocation: current.passengerLocation || current.origin?.location || null, estimatedDistanceKm: Number(driver.distance.toFixed(2)), dispatchRadiusKm: radiusKm, source: 'backend-dispatch' });
      await new Promise((resolve) => setTimeout(resolve, 8000));
      const after = (await db.ref(`rides/${ride.id}`).get()).val();
      if (!after || after.status !== 'SEARCHING' || after.driverId) break;
    }
  } catch (error) { console.error('Erro no despacho automático:', error.message); }
  finally { await notifyDriversHttpFallback(ride); dispatchingRideIds.delete(ride.id); }
}
router.use(authenticate);
router.post('/request', async (req, res) => {
  let step = 'start';
  try {
    const { origin, destination } = req.body || {}, uid = req.user.uid;
    step = 'validate-payload';
    if (!origin || !destination) return res.status(400).json({ error: 'Origem e destino são obrigatórios.' });
    const originLocation = normalizeLocation(origin), destinationLocation = normalizeLocation(destination);
    if (!originLocation || !destinationLocation) return res.status(400).json({ error: 'A localização de origem e destino é inválida.' });
    step = 'load-user';
    const user = (await db.ref(`users/${uid}`).get()).val();
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });
    if (user.userType !== 'passenger') return res.status(403).json({ error: 'Somente passageiros podem solicitar corridas.' });
    step = 'check-active-rides';
    let activeRide = null;
    (await db.ref('rides').get()).forEach((child) => { const ride = child.val(); if (ride && ride.userId === uid && ACTIVE_STATUSES.includes(ride.status)) activeRide = ride; });
    if (activeRide) return res.status(409).json({ error: 'Você já possui uma corrida em andamento.', ride: activeRide });
    const dist = Math.min(Math.max(Math.round(distanceKm(originLocation, destinationLocation) * 100) / 100, 0), 300);
    if (dist <= 0 || !Number.isFinite(dist)) return res.status(400).json({ error: 'A origem e o destino precisam ser diferentes.' });
    step = 'create-ride';
    const ref = db.ref('rides').push();
    const ride = { id: ref.key, userId: uid, driverId: null, passengerName: user.name || user.email || 'Passageiro', passengerProfilePhoto: user.profilePhoto || null, origin: { address: String(origin.address || origin.display_name || 'Minha localização atual').slice(0, 240), location: originLocation }, destination: { address: String(destination.address || destination.display_name || 'Destino').slice(0, 240), location: destinationLocation }, passengerLocation: originLocation, price: FIXED_RIDE_PRICE, distance: dist, status: 'SEARCHING', createdAt: admin.database.ServerValue.TIMESTAMP };
    await ref.set(ride);
    step = 'dispatch-drivers';
    const driversNotified = await notifyDriversHttpFallback(ride);
    return res.status(201).json({ success: true, ride, driversNotified: driversNotified.length });
  } catch (error) {
    console.error('Erro ao solicitar corrida:', { step, message: error?.message, code: error?.code });
    return res.status(500).json({ error: 'Erro interno ao criar corrida.', step, code: error?.code || 'UNKNOWN', details: error?.message || 'Erro desconhecido' });
  }
});
router.post('/:rideId/search', async (req, res) => {
  try {
    const rideId = req.params.rideId, ride = (await db.ref(`rides/${rideId}`).get()).val();
    if (!ride) return res.status(404).json({ error: 'Corrida não encontrada.' });
    if (ride.userId !== req.user.uid) return res.status(403).json({ error: 'Acesso negado.' });
    if (ride.status !== 'SEARCHING') return res.status(409).json({ error: 'Esta corrida não está mais procurando motorista.', ride });
    const driversNotified = await notifyDriversHttpFallback(ride);
    return res.status(200).json({ success: true, ride, status: 'SEARCHING', driversNotified: driversNotified.length });
  } catch (error) { return res.status(500).json({ error: 'Não foi possível reiniciar a busca de motorista.' }); }
});
router.post('/:rideId/passenger-location', async (req, res) => {
  try {
    const rideId = req.params.rideId, location = normalizeLocation(req.body?.location || req.body), ref = db.ref(`rides/${rideId}`), ride = (await ref.get()).val();
    if (!location) return res.status(400).json({ error: 'Localização inválida.' });
    if (!ride) return res.status(404).json({ error: 'Corrida não encontrada.' });
    if (ride.userId !== req.user.uid) return res.status(403).json({ error: 'Acesso negado.' });
    if (!ACTIVE_STATUSES.includes(ride.status)) return res.status(409).json({ error: 'A corrida não está ativa.' });
    await ref.update({ passengerLocation: location, 'origin/location': location, updatedAt: admin.database.ServerValue.TIMESTAMP });
    const updated = (await ref.get()).val();
    if (updated.driverId && io) { io.to(`driver_${updated.driverId}`).emit('passenger-location-update', { rideId, passengerId: req.user.uid, location }); emitToRide(rideId, 'passenger-location-update', { rideId, passengerId: req.user.uid, location }); }
    return res.json({ success: true, location });
  } catch (_) { return res.status(500).json({ error: 'Não foi possível atualizar a localização do passageiro.' }); }
});
router.get('/active', async (req, res) => {
  try { let active = null; (await db.ref('rides').get()).forEach((child) => { const ride = child.val(); if (ride && (ride.userId === req.user.uid || ride.driverId === req.user.uid) && ACTIVE_STATUSES.includes(ride.status)) active = ride; }); return res.json({ success: true, ride: active }); }
  catch (_) { return res.status(500).json({ error: 'Erro ao buscar corrida ativa.' }); }
});
router.get('/pending', async (req, res) => {
  try {
    const uid = req.user.uid;
    const user = (await db.ref(`users/${uid}`).get()).val();
    if (!user || user.userType !== 'driver') return res.status(403).json({ error: 'Somente motoristas podem consultar corridas pendentes.' });
    if (user.driverApprovalStatus !== 'approved') return res.status(403).json({ error: 'Motorista ainda não foi aprovado.' });
    if (user.isOnline !== true) return res.json({ success: true, rides: [] });
    const driverLocation = normalizeLocation(user.currentLocation || (await db.ref(`locations/${uid}`).get()).val());
    if (!driverLocation) return res.json({ success: true, rides: [] });
    const [ridesSnapshot, notificationsSnapshot] = await Promise.all([db.ref('rides').get(), db.ref(`driverNotifications/${uid}`).get()]);
    const rides = ridesSnapshot.val() || {};
    const notifications = notificationsSnapshot.val() || {};
    const candidates = new Map();
    Object.entries(notifications).forEach(([rideId, item]) => { if (item?.status === 'SEARCHING' && item?.id === rideId) candidates.set(rideId, item); });
    Object.entries(rides).forEach(([rideId, ride]) => {
      if (!ride || ride.status !== 'SEARCHING' || ride.driverId) return;
      const pickup = normalizeLocation(ride.passengerLocation || ride.origin);
      const radius = dispatchRadiusKm(rideAgeMs(ride));
      const distance = distanceKm(driverLocation, pickup);
      if (Number.isFinite(distance) && distance <= radius) candidates.set(rideId, { ...ride, rideId, estimatedDistanceKm: Number(distance.toFixed(2)), dispatchRadiusKm: radius, source: 'driver-pending-poll' });
    });
    const result = Array.from(candidates.values()).filter((ride) => ride?.id).sort((a, b) => Number(a.estimatedDistanceKm ?? 999999) - Number(b.estimatedDistanceKm ?? 999999)).slice(0, 20);
    return res.json({ success: true, rides: result });
  } catch (error) { console.error('Erro ao buscar corridas pendentes:', error.message); return res.status(500).json({ error: 'Não foi possível buscar corridas pendentes.' }); }
});
router.get('/:rideId', async (req, res) => {
  try {
    const rideId = String(req.params.rideId || '');
    if (!rideId) return res.status(400).json({ error: 'ID da corrida é obrigatório.' });
    const ride = (await db.ref(`rides/${rideId}`).get()).val();
    if (!ride) return res.status(404).json({ error: 'Corrida não encontrada.' });
    const uid = req.user.uid;
    if (String(ride.userId || '') !== String(uid) && String(ride.driverId || '') !== String(uid)) return res.status(403).json({ error: 'Acesso negado.' });
    return res.json({ success: true, ride });
  } catch (error) { return res.status(500).json({ error: 'Erro ao buscar corrida.', details: error?.message || 'Erro desconhecido' }); }
});
router.post('/accept', async (req, res) => {
  const { rideId } = req.body || {}, driverId = req.user.uid;
  if (!rideId) return res.status(400).json({ error: 'ID da corrida é obrigatório.' });
  if (acceptingRideIds.has(String(rideId))) return res.status(409).json({ error: 'Esta corrida já está sendo processada por outro motorista.' });
  acceptingRideIds.add(String(rideId));
  try {
    const driver = (await db.ref(`users/${driverId}`).get()).val();
    if (!driver || driver.userType !== 'driver') return res.status(403).json({ error: 'Somente motoristas podem aceitar corridas.' });
    if (driver.driverApprovalStatus !== 'approved') return res.status(403).json({ error: 'Motorista ainda não foi aprovado.' });
    if (!driver.isOnline) return res.status(409).json({ error: 'Motorista está offline.' });
    const ref = db.ref(`rides/${rideId}`), current = (await ref.get()).val();
    if (!current || current.status !== 'SEARCHING' || current.driverId) return res.status(409).json({ error: 'Corrida já foi aceita ou não existe.', ride: current || null });
    const origin = normalizeLocation(current.origin), driverLocation = normalizeLocation(driver.currentLocation || (await db.ref(`locations/${driverId}`).get()).val());
    if (!origin || !driverLocation) return res.status(409).json({ error: 'Localização do motorista ou embarque indisponível.' });
    const radiusKm = dispatchRadiusKm(rideAgeMs(current)), pickup = distanceKm(driverLocation, origin);
    if (!Number.isFinite(pickup) || pickup > radiusKm) return res.status(409).json({ error: `Você está fora da área de atendimento desta corrida (${radiusKm} km).`, estimatedDistanceKm: Number.isFinite(pickup) ? Number(pickup.toFixed(2)) : null, dispatchRadiusKm: radiusKm });
    let active = null;
    (await db.ref('rides').get()).forEach((child) => { const ride = child.val(); if (ride && String(ride.driverId || '') === String(driverId) && ACTIVE_STATUSES.includes(ride.status)) active = ride; });
    if (active) return res.status(409).json({ error: 'Você já possui uma corrida em andamento.', ride: active });
    const accepted = { ...current, driverId, driverName: driver.name || driver.email || 'Motorista', driverProfilePhoto: driver.profilePhoto || null, driverLocation: driver.currentLocation || null, passengerLocation: current.passengerLocation || current.origin?.location || null, status: 'ACCEPTED', acceptedAt: admin.database.ServerValue.TIMESTAMP, updatedAt: admin.database.ServerValue.TIMESTAMP };
    let committed = false;
    try {
      const tx = await ref.transaction((value) => {
        const v = value || current;
        if (!v || v.status !== 'SEARCHING' || (v.driverId && v.driverId !== driverId)) return;
        return accepted;
      });
      committed = Boolean(tx && tx.committed);
    } catch (_) { committed = false; }
    if (!committed) {
      const fresh = (await ref.get()).val();
      if (fresh && fresh.status === 'SEARCHING' && !fresh.driverId) await ref.set(accepted);
      else return res.status(409).json({ error: 'Corrida já foi aceita ou não existe.', ride: fresh || null });
    }
    const confirmed = (await ref.get()).val() || accepted;
    await db.ref(`driverNotifications/${driverId}/${rideId}`).remove();
    emitToRide(rideId, 'ride-accepted', { rideId, driverId, ride: confirmed });
    if (io) { io.emit('ride-unavailable', { rideId, driverId, source: 'ride-accepted' }); io.to(`driver_${driverId}`).emit('ride-accepted', { rideId, driverId, ride: confirmed, source: 'server-confirmation' }); }
    return res.json({ success: true, ride: confirmed });
  } catch (error) { return res.status(500).json({ error: 'Erro ao aceitar corrida.', code: error?.code || 'ACCEPT_RIDE_ERROR', details: error?.message || 'Erro desconhecido' }); }
  finally { acceptingRideIds.delete(String(rideId)); }
});
router.patch('/:rideId/status', async (req, res) => {
  try {
    const id = req.params.rideId || req.body.rideId, { status, cancellationReason } = req.body;
    if (!id || !VALID_STATUSES.includes(status)) return res.status(400).json({ error: 'Status de corrida inválido.' });
    const ref = db.ref(`rides/${id}`), ride = (await ref.get()).val(), uid = req.user.uid;
    if (!ride) return res.status(404).json({ error: 'Corrida não encontrada.' });
    if (ride.userId !== uid && ride.driverId !== uid) return res.status(403).json({ error: 'Acesso negado.' });
    const transitions = { SEARCHING: ['CANCELLED'], ACCEPTED: ['IN_PROGRESS', 'CANCELLED'], IN_PROGRESS: ['COMPLETED', 'CANCELLED'], COMPLETED: [], CANCELLED: [] };
    if (!transitions[ride.status]?.includes(status)) return res.status(409).json({ error: `Transição inválida: ${ride.status} → ${status}.` });
    if (status === 'IN_PROGRESS' && ride.driverId !== uid) return res.status(403).json({ error: 'Somente o motorista pode iniciar a corrida.' });
    if (status === 'COMPLETED' && ride.driverId !== uid) return res.status(403).json({ error: 'Somente o motorista pode finalizar a corrida.' });
    if (status === 'IN_PROGRESS' || status === 'COMPLETED') {
      const driver = (await db.ref(`users/${ride.driverId}`).get()).val();
      let driverLocation = normalizeLocation(driver?.currentLocation || (await db.ref(`locations/${ride.driverId}`).get()).val());
      const target = status === 'IN_PROGRESS' ? normalizeLocation(ride.passengerLocation || ride.origin) : normalizeLocation(ride.destination);
      if (!driverLocation && target) { driverLocation = target; await db.ref(`users/${ride.driverId}`).update({ currentLocation: target }); }
      const dist = distanceKm(driverLocation, target);
      if (req.body.force !== true && (!Number.isFinite(dist) || dist > ARRIVAL_RADIUS_KM)) return res.status(409).json({ error: status === 'IN_PROGRESS' ? 'Aproxime-se do passageiro para iniciar a corrida.' : 'Aproxime-se do destino para finalizar a corrida.', distanceKm: Number.isFinite(dist) ? Number(dist.toFixed(2)) : null, maxRadiusKm: ARRIVAL_RADIUS_KM });
    }
    const now = admin.database.ServerValue.TIMESTAMP, updates = { status, updatedAt: now };
    if (status === 'IN_PROGRESS') updates.startedAt = now;
    if (status === 'COMPLETED') updates.completedAt = now;
    if (status === 'CANCELLED') { updates.cancelledAt = now; updates.cancelledBy = uid; updates.cancellationReason = String(cancellationReason || 'Cancelada').slice(0, 240); }
    await ref.update(updates);
    const updated = (await ref.get()).val();
    if (status === 'CANCELLED') {
      const notifications = await db.ref('driverNotifications').get(), cleanup = {};
      notifications.forEach((driverNode) => { if (driverNode.hasChild(id)) cleanup[`driverNotifications/${driverNode.key}/${id}`] = null; });
      if (Object.keys(cleanup).length) await db.ref().update(cleanup);
    }
    emitToRide(id, status === 'IN_PROGRESS' ? 'ride-started' : status === 'COMPLETED' ? 'ride-ended' : status === 'CANCELLED' ? 'ride-cancelled' : 'ride-status', { rideId: id, ride: updated, cancelledBy: updated.cancelledBy || null, cancellationReason: updated.cancellationReason || null });
    return res.json({ success: true, ride: updated });
  } catch (error) { return res.status(500).json({ error: 'Não foi possível atualizar a corrida.', details: error.message }); }
});
module.exports = router;
