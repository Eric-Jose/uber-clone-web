const express = require('express');
const admin = require('firebase-admin');
const { authenticate } = require('../middleware/auth');
const router = express.Router();
const db = admin.database();

const MARACAJU = { lat: -21.6149, lon: -55.1683 };
const localityCache = new Map();
const searchCache = new Map();
const CACHE_TTL = 10 * 60 * 1000;
const SEARCH_CACHE_TTL = 30 * 1000;

function normalizeText(value) {
  return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
}

function distanceKm(aLat, aLon, bLat, bLon) {
  const lat1 = Number(aLat), lon1 = Number(aLon), lat2 = Number(bLat), lon2 = Number(bLon);
  if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) return Infinity;
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

async function fetchJson(url, headers = {}, timeoutMs = 7000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { headers, signal: controller.signal });
    if (!response.ok) throw new Error('HTTP_' + response.status);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function detectLocality(lat, lon) {
  const key = `${Math.round(lat * 50) / 50},${Math.round(lon * 50) / 50}`;
  const cached = localityCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) return cached.value;
  try {
    const params = new URLSearchParams({ format: 'jsonv2', lat: String(lat), lon: String(lon), zoom: '10', addressdetails: '1', 'accept-language': 'pt-BR' });
    const data = await fetchJson('https://nominatim.openstreetmap.org/reverse?' + params.toString(), { Accept: 'application/json', 'User-Agent': 'PrecoFixo17/1.0 locality-search' }, 1800);
    const address = data?.address || {};
    const city = address.city || address.town || address.municipality || address.village || address.county;
    const state = address.state || '';
    const value = city ? [city, state].filter(Boolean).join(' ') : '';
    localityCache.set(key, { timestamp: Date.now(), value });
    if (localityCache.size > 100) localityCache.delete(localityCache.keys().next().value);
    return value;
  } catch (_) {
    return '';
  }
}

function categoryTerms(query) {
  const q = normalizeText(query);
  const groups = [
    [/^mercad/, ['mercado', 'supermercado', 'mercearia', 'mercadinho']],
    [/^super ?mercad/, ['supermercado', 'mercado', 'mercearia', 'mercadinho']],
    [/^mercadinho/, ['mercadinho', 'mercado', 'mercearia']],
    [/^farmacia/, ['farmacia', 'drogaria']],
    [/^drogaria/, ['drogaria', 'farmacia']],
    [/^hospital/, ['hospital', 'pronto atendimento', 'upa']],
    [/^upa/, ['upa', 'pronto atendimento', 'hospital']],
    [/^posto/, ['posto', 'posto de combustivel', 'posto de combustível']],
    [/^hotel/, ['hotel', 'pousada']],
    [/^pousada/, ['pousada', 'hotel']],
    [/^restaur/, ['restaurante', 'lanchonete', 'churrascaria']],
    [/^lanchon/, ['lanchonete', 'restaurante']],
    [/^padari/, ['padaria', 'panificadora']],
  ];
  const found = groups.find(([re]) => re.test(q));
  return found ? found[1] : [query];
}

function providerQueries(query, localArea) {
  const terms = categoryTerms(query);
  const values = [...terms.map((term) => `${term} ${localArea}`), query];
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))].slice(0, 5);
}

function buildPhoton(q, lat, lon) {
  const p = new URLSearchParams({ q, limit: '30', lang: 'pt' });
  if (Number.isFinite(lat) && Number.isFinite(lon)) { p.set('lat', String(lat)); p.set('lon', String(lon)); }
  return 'https://photon.komoot.io/api/?' + p.toString();
}

function buildNominatim(q, lat, lon) {
  const p = new URLSearchParams({ format: 'jsonv2', q, limit: '30', addressdetails: '1', 'accept-language': 'pt-BR', dedupe: '1' });
  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    const delta = 1.0;
    p.set('viewbox', `${lon - delta},${lat + delta},${lon + delta},${lat - delta}`);
    p.set('bounded', '0');
  }
  return 'https://nominatim.openstreetmap.org/search?' + p.toString();
}

function buildArcgis(q, lat, lon) {
  const p = new URLSearchParams({ SingleLine: q, f: 'json', maxLocations: '30', outFields: '*', langCode: 'PT' });
  p.set('location', `${lon},${lat}`);
  p.set('distance', '100000');
  return 'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?' + p.toString();
}

// Public search endpoint: no private account data is exposed here.
router.get('/search', async (req, res) => {
  const query = String(req.query.q || '').trim();
  if (query.length < 1) return res.json({ success: true, results: [], locality: null, locationMode: 'none' });
  if (query.length > 200) return res.status(400).json({ success: false, error: 'Busca muito longa.', results: [] });

  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon ?? req.query.lng);
  const hasOrigin = Number.isFinite(lat) && lat >= -90 && lat <= 90 && Number.isFinite(lon) && lon >= -180 && lon <= 180;
  const originLat = hasOrigin ? lat : MARACAJU.lat;
  const originLon = hasOrigin ? lon : MARACAJU.lon;
  const localArea = hasOrigin ? ((await detectLocality(lat, lon)) || 'Maracaju MS') : 'Maracaju MS';
  const cacheKey = `${normalizeText(query)}|${Math.round(originLat * 1000)},${Math.round(originLon * 1000)}|${localArea}`;
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < SEARCH_CACHE_TTL) return res.json(cached.value);

  const queries = providerQueries(query, localArea);
  try {
    const photonResults = await Promise.allSettled(queries.map((q) => fetchJson(buildPhoton(q, hasOrigin ? lat : NaN, hasOrigin ? lon : NaN), { Accept: 'application/json' }, 6000)));
    const nominatimResults = await Promise.allSettled(queries.map((q) => fetchJson(buildNominatim(q, hasOrigin ? lat : NaN, hasOrigin ? lon : NaN), { Accept: 'application/json', 'User-Agent': 'PrecoFixo17/1.0 address-search' }, 6000)));
    const arcgisResults = await Promise.allSettled(queries.map((q) => fetchJson(buildArcgis(q, originLat, originLon), { Accept: 'application/json' }, 6000)));

    const photon = photonResults.flatMap((result) => result.status === 'fulfilled' && Array.isArray(result.value?.features)
      ? result.value.features.map((feature) => {
          const p = feature.properties || {}, coords = feature.geometry?.coordinates || [];
          const address = [p.name, p.street && p.housenumber ? `${p.street}, ${p.housenumber}` : p.street, p.city || p.town || p.village || p.municipality, p.state, p.country].filter(Boolean).join(' - ');
          return { lat: Number(coords[1]), lon: Number(coords[0]), display_name: address || p.name || query, place_id: `photon-${p.osm_type || ''}-${p.osm_id || address}` };
        }) : []);
    const nominatim = nominatimResults.flatMap((result) => result.status === 'fulfilled' && Array.isArray(result.value) ? result.value : []);
    const arcgis = arcgisResults.flatMap((result) => result.status === 'fulfilled' && Array.isArray(result.value?.candidates)
      ? result.value.candidates.filter((c) => c.location && Number.isFinite(Number(c.location.y)) && Number.isFinite(Number(c.location.x))).map((c) => ({ lat: Number(c.location.y), lon: Number(c.location.x), display_name: String(c.address || query), place_id: `arcgis-${c.address || c.location.x + '-' + c.location.y}` })) : []);

    const normalizedQuery = normalizeText(query);
    const normalizedLocal = normalizeText(localArea);
    const terms = categoryTerms(query).map(normalizeText);
    const unique = new Map();
    for (const item of [...arcgis, ...photon, ...nominatim]) {
      const itemLat = Number(item.lat), itemLon = Number(item.lon);
      if (!Number.isFinite(itemLat) || !Number.isFinite(itemLon)) continue;
      const key = `${itemLat.toFixed(5)}|${itemLon.toFixed(5)}`;
      if (!unique.has(key)) unique.set(key, { ...item, lat: itemLat, lon: itemLon });
    }

    const score = (item) => {
      const name = normalizeText(item.display_name);
      const distance = distanceKm(originLat, originLon, item.lat, item.lon);
      const isLocal = name.includes(normalizedLocal) || distance <= 35;
      const exact = name.includes(normalizedQuery) ? 1500 : 0;
      const category = terms.some((term) => term.length >= 2 && name.includes(term)) ? 800 : 0;
      const local = isLocal ? 10000 : 0;
      const proximity = Math.max(0, 7000 - Math.min(distance * 140, 7000));
      return local + category + exact + proximity;
    };

    const results = [...unique.values()].sort((a, b) => score(b) - score(a)).slice(0, 40);
    const payload = { success: true, results, locality: localArea, locationMode: hasOrigin ? 'gps' : 'fallback' };
    searchCache.set(cacheKey, { timestamp: Date.now(), value: payload });
    if (searchCache.size > 120) searchCache.delete(searchCache.keys().next().value);
    return res.json(payload);
  } catch (error) {
    console.error('Erro na busca de endereço:', error.message);
    return res.status(502).json({ success: false, error: 'Não foi possível pesquisar o local agora.', results: [], locality: localArea, locationMode: hasOrigin ? 'gps' : 'fallback' });
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
  } catch (e) { return res.status(500).json({ error: 'Erro ao atualizar localização.' }); }
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
  } catch (e) { return res.status(500).json({ error: 'Erro ao buscar localização.' }); }
});

router.get('/:userId/history', async (req, res) => {
  try {
    const id = req.params.userId;
    if (id !== req.user.uid) return res.status(403).json({ error: 'Acesso não autorizado.' });
    const s = await db.ref(`locations/${id}`).get();
    return res.json({ userId: id, current: s.val(), history: [] });
  } catch (e) { return res.status(500).json({ error: 'Erro ao buscar histórico.' }); }
});

module.exports = router;
