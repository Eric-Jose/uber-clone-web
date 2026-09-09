const express = require('express');
const admin = require('firebase-admin');
const { authenticate } = require('../middleware/auth');
const router = express.Router();
const db = admin.database();

// Geocoding is intentionally public: it does not expose user data and keeps
// browser CORS/rate-limit problems away from the passenger's search box.
router.get('/search', async (req, res) => {
  const query = String(req.query.q || '').trim();
  if (query.length < 2) return res.json({ success: true, results: [] });
  if (query.length > 200) return res.status(400).json({ error: 'Busca muito longa.' });

  const encoded = encodeURIComponent(query);
  const photonUrl = `https://photon.komoot.io/api/?q=${encoded}&limit=8&lang=pt`;
  const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encoded}&limit=8&addressdetails=1&accept-language=pt-BR`;

  const fetchJson = async (url, headers = {}) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7000);
    try {
      const response = await fetch(url, { headers, signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP_${response.status}`);
      return await response.json();
    } finally {
      clearTimeout(timer);
    }
  };

  try {
    const [photonResult, nominatimResult] = await Promise.allSettled([
      fetchJson(photonUrl, { Accept: 'application/json' }),
      fetchJson(nominatimUrl, { Accept: 'application/json', 'User-Agent': 'PrecoFixo17/1.0 address-search' }),
    ]);

    const photon = photonResult.status === 'fulfilled' && Array.isArray(photonResult.value?.features)
      ? photonResult.value.features.map((feature) => {
          const p = feature.properties || {};
          const coords = feature.geometry?.coordinates || [];
          const address = [
            p.name,
            p.street && p.housenumber ? `${p.street}, ${p.housenumber}` : p.street,
            p.city || p.town || p.village || p.municipality,
            p.state,
            p.country,
          ].filter(Boolean).join(' - ');
          return {
            lat: Number(coords[1]),
            lon: Number(coords[0]),
            display_name: address || p.name || query,
            place_id: `photon-${p.osm_type || ''}-${p.osm_id || address}`,
          };
        })
      : [];

    const nominatim = nominatimResult.status === 'fulfilled' && Array.isArray(nominatimResult.value)
      ? nominatimResult.value
      : [];

    const merged = [...photon, ...nominatim]
      .filter((item) => Number.isFinite(Number(item.lat)) && Number.isFinite(Number(item.lon)))
      .filter((item, index, array) => {
        const key = `${Number(item.lat).toFixed(5)}|${Number(item.lon).toFixed(5)}`;
        return array.findIndex((other) => `${Number(other.lat).toFixed(5)}|${Number(other.lon).toFixed(5)}` === key) === index;
      })
      .sort((a, b) => {
        const am = String(a.display_name || '').toLowerCase().includes(query.toLowerCase());
        const bm = String(b.display_name || '').toLowerCase().includes(query.toLowerCase());
        return Number(bm) - Number(am);
      })
      .slice(0, 8);

    return res.json({ success: true, results: merged });
  } catch (error) {
    console.error('Erro na busca de endereço:', error.message);
    return res.status(502).json({ error: 'Não foi possível pesquisar o endereço agora.', results: [] });
  }
});

router.use(authenticate);

router.post('/update', async (req, res) => {
  try {
    const id = req.user.uid;
    const lat = Number(req.body.lat ?? req.body.latitude);
    const lng = Number(req.body.lng ?? req.body.longitude);
    const accuracy = req.body.accuracy !== undefined ? Number(req.body.accuracy) : null;
    if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) return res.status(400).json({ error: 'Latitude ou longitude inválida.' });
    const timestamp = new Date().toISOString();
    const location = { lat, lng, latitude: lat, longitude: lng, accuracy: Number.isFinite(accuracy) ? accuracy : null, timestamp };
    await db.ref(`locations/${id}`).set(location);
    const u = await db.ref(`users/${id}`).get();
    if (u.exists() && u.val().userType === 'driver') await db.ref(`users/${id}`).update({ currentLocation: { lat, lng }, lastLocationUpdate: timestamp });
    return res.json({ success: true, location });
  } catch (e) {
    return res.status(500).json({ error: 'Erro ao atualizar localização.' });
  }
});

router.get('/:userId', async (req, res) => {
  try {
    const id = req.params.userId, requester = req.user.uid;
    if (id !== requester) {
      const rides = await db.ref('rides').orderByChild('userId').equalTo(requester).get();
      let ok = false;
      rides.forEach(c => { const r = c.val(); if (r.driverId === id && ['SEARCHING', 'ACCEPTED', 'IN_PROGRESS'].includes(r.status)) ok = true; });
      if (!ok) return res.status(403).json({ error: 'Acesso à localização não autorizado.' });
    }
    const s = await db.ref(`locations/${id}`).get(), location = s.val();
    if (!location) return res.status(404).json({ error: 'Localização não encontrada' });
    return res.json(location);
  } catch (e) {
    return res.status(500).json({ error: 'Erro ao buscar localização.' });
  }
});

router.get('/:userId/history', async (req, res) => {
  try {
    const id = req.params.userId;
    if (id !== req.user.uid) return res.status(403).json({ error: 'Acesso não autorizado.' });
    const s = await db.ref(`locations/${id}`).get();
    return res.json({ userId: id, current: s.val(), history: [] });
  } catch (e) {
    return res.status(500).json({ error: 'Erro ao buscar histórico.' });
  }
});

module.exports = router;
