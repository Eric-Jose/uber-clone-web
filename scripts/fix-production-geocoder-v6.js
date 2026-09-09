const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'backend', 'routes', 'location.js');

const source = `const express = require('express');
const admin = require('firebase-admin');
const { authenticate } = require('../middleware/auth');
const router = express.Router();
const db = admin.database();

const clean = (value) => String(value || '').trim().split(' ').filter(Boolean).join(' ');
const numberOk = (value) => Number.isFinite(Number(value));

router.get('/search', async (req, res) => {
  const query = clean(req.query.q);
  if (query.length < 2) return res.json({ success: true, results: [] });
  if (query.length > 200) return res.status(400).json({ success: false, error: 'Busca muito longa.', results: [] });

  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon ?? req.query.lng);
  const hasOrigin = numberOk(lat) && lat >= -90 && lat <= 90 && numberOk(lon) && lon >= -180 && lon <= 180;
  const compact = query.split(' ').join('');
  const normalizedPoi = query.replace('super mercado', 'supermercado').replace('Super Mercado', 'Supermercado');
  const queries = [query];
  if (normalizedPoi.toLowerCase() !== query.toLowerCase()) queries.push(normalizedPoi);
  if (compact.length >= 3 && compact.toLowerCase() !== query.toLowerCase()) queries.push(compact);

  const photonUrl = (q) => {
    const p = new URLSearchParams({ q, limit: '20', lang: 'pt' });
    if (hasOrigin) { p.set('lat', String(lat)); p.set('lon', String(lon)); }
    return 'https://photon.komoot.io/api/?' + p.toString();
  };
  const nominatimUrl = (q) => {
    const p = new URLSearchParams({ format: 'jsonv2', q, limit: '20', addressdetails: '1', 'accept-language': 'pt-BR', dedupe: '1' });
    return 'https://nominatim.openstreetmap.org/search?' + p.toString();
  };
  const arcgisUrl = (q) => {
    const p = new URLSearchParams({ SingleLine: q, f: 'json', maxLocations: '20', outFields: '*', langCode: 'PT' });
    if (hasOrigin) { p.set('location', String(lon) + ',' + String(lat)); p.set('distance', '100000'); }
    return 'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?' + p.toString();
  };

  const fetchJson = async (url, headers = {}) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(url, { headers, signal: controller.signal });
      if (!response.ok) throw new Error('HTTP_' + response.status);
      return await response.json();
    } finally { clearTimeout(timer); }
  };

  try {
    const [photonResults, nominatimResults, arcgisResults] = await Promise.all([
      Promise.allSettled(queries.map((q) => fetchJson(photonUrl(q), { Accept: 'application/json' }))),
      Promise.allSettled(queries.map((q) => fetchJson(nominatimUrl(q), { Accept: 'application/json', 'User-Agent': 'PrecoFixo17/1.0 address-search' }))),
      Promise.allSettled(queries.map((q) => fetchJson(arcgisUrl(q), { Accept: 'application/json' }))),
    ]);

    const photon = photonResults.flatMap((result) => {
      if (result.status !== 'fulfilled' || !Array.isArray(result.value?.features)) return [];
      return result.value.features.map((feature) => {
        const p = feature.properties || {};
        const coords = feature.geometry?.coordinates || [];
        const address = [p.name, p.street && p.housenumber ? p.street + ', ' + p.housenumber : p.street, p.city || p.town || p.village || p.municipality, p.state, p.country].filter(Boolean).join(' - ');
        return { lat: Number(coords[1]), lon: Number(coords[0]), display_name: address || p.name || query, place_id: 'photon-' + (p.osm_type || '') + '-' + (p.osm_id || address) };
      });
    });
    const nominatim = nominatimResults.flatMap((result) => result.status === 'fulfilled' && Array.isArray(result.value) ? result.value : []);
    const arcgis = arcgisResults.flatMap((result) => {
      if (result.status !== 'fulfilled' || !Array.isArray(result.value?.candidates)) return [];
      return result.value.candidates.filter((candidate) => candidate.location && numberOk(candidate.location.y) && numberOk(candidate.location.x)).map((candidate) => ({
        lat: Number(candidate.location.y),
        lon: Number(candidate.location.x),
        display_name: clean(candidate.address || query),
        place_id: 'arcgis-' + (candidate.address || candidate.location.x + '-' + candidate.location.y),
      }));
    });

    const merged = [...arcgis, ...photon, ...nominatim]
      .filter((item) => numberOk(item.lat) && numberOk(item.lon))
      .filter((item, index, array) => {
        const key = Number(item.lat).toFixed(5) + '|' + Number(item.lon).toFixed(5);
        return array.findIndex((other) => Number(other.lat).toFixed(5) + '|' + Number(other.lon).toFixed(5) === key) === index;
      })
      .sort((a, b) => {
        const terms = queries.map((q) => q.toLowerCase());
        const score = (name) => {
          const value = String(name || '').toLowerCase();
          return (value.includes(query.toLowerCase()) ? 100 : 0) + (terms.some((term) => value.includes(term)) ? 30 : 0);
        };
        return score(b.display_name) - score(a.display_name);
      })
      .slice(0, 20);

    return res.json({ success: true, results: merged });
  } catch (error) {
    console.error('Erro na busca de endereço:', error.message);
    return res.status(502).json({ success: false, error: 'Não foi possível pesquisar o local agora.', results: [] });
  }
});

router.use(authenticate);

router.post('/update', async (req, res) => {
  try {
    const id = req.user.uid;
    const lat = Number(req.body.lat ?? req.body.latitude);
    const lng = Number(req.body.lng ?? req.body.longitude);
    const accuracy = req.body.accuracy !== undefined ? Number(req.body.accuracy) : null;
    if (!numberOk(lat) || lat < -90 || lat > 90 || !numberOk(lng) || lng < -180 || lng > 180) return res.status(400).json({ error: 'Latitude ou longitude inválida.' });
    const timestamp = new Date().toISOString();
    const location = { lat, lng, latitude: lat, longitude: lng, accuracy: numberOk(accuracy) ? accuracy : null, timestamp };
    await db.ref('locations/' + id).set(location);
    const u = await db.ref('users/' + id).get();
    if (u.exists() && u.val().userType === 'driver') await db.ref('users/' + id).update({ currentLocation: { lat, lng }, lastLocationUpdate: timestamp });
    return res.json({ success: true, location });
  } catch (_) { return res.status(500).json({ error: 'Erro ao atualizar localização.' }); }
});

router.get('/:userId', async (req, res) => {
  try {
    const id = req.params.userId;
    if (id !== req.user.uid) {
      const rides = await db.ref('rides').orderByChild('userId').equalTo(req.user.uid).get();
      let ok = false;
      rides.forEach((child) => { const ride = child.val(); if (ride.driverId === id && ['SEARCHING', 'ACCEPTED', 'IN_PROGRESS'].includes(ride.status)) ok = true; });
      if (!ok) return res.status(403).json({ error: 'Acesso à localização não autorizado.' });
    }
    const snapshot = await db.ref('locations/' + id).get();
    if (!snapshot.exists()) return res.status(404).json({ error: 'Localização não encontrada' });
    return res.json(snapshot.val());
  } catch (_) { return res.status(500).json({ error: 'Erro ao buscar localização.' }); }
});

router.get('/:userId/history', async (req, res) => {
  try {
    const id = req.params.userId;
    if (id !== req.user.uid) return res.status(403).json({ error: 'Acesso não autorizado.' });
    const snapshot = await db.ref('locations/' + id).get();
    return res.json({ userId: id, current: snapshot.val(), history: [] });
  } catch (_) { return res.status(500).json({ error: 'Erro ao buscar histórico.' }); }
});

module.exports = router;\n`;

fs.writeFileSync(file, source, 'utf8');
console.log('[fix-production-geocoder-v6] Final POI/address geocoder installed.');
