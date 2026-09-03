const express = require('express');
const router = express.Router();
const axios = require('axios');

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org';
const OSRM_URL = 'https://router.project-osrm.org/route/v1/driving';
const USER_AGENT = 'UberClone/1.0 (mapa@uberclone.local)';

function normalizePoint(value) {
  const lat = Number(value?.lat ?? value?.latitude);
  const lng = Number(value?.lng ?? value?.longitude ?? value?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

async function geocodeAddress(address) {
  const text = String(address || '').trim();
  if (!text) return null;
  const response = await axios.get(`${NOMINATIM_URL}/search`, {
    params: {
      format: 'jsonv2',
      q: text,
      limit: 1,
      countrycodes: 'br',
      addressdetails: 1,
      'accept-language': 'pt-BR'
    },
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    timeout: 15000
  });
  const result = response.data?.[0];
  if (!result) return null;
  return {
    latitude: Number(result.lat),
    longitude: Number(result.lon),
    formattedAddress: result.display_name
  };
}

function resolvePoint(value) {
  return normalizePoint(value) || normalizePoint(value?.location);
}

router.post('/calculate-route', async (req, res) => {
  try {
    const origin = resolvePoint(req.body?.origin);
    const destination = resolvePoint(req.body?.destination);
    if (!origin || !destination) return res.status(400).json({ error: 'Origem ou destino inválido.' });

    const response = await axios.get(
      `${OSRM_URL}/${origin.lng},${origin.lat};${destination.lng},${destination.lat}`,
      { params: { overview: 'full', geometries: 'geojson', steps: false }, timeout: 20000 }
    );
    const route = response.data?.routes?.[0];
    if (!route) return res.status(404).json({ error: 'Rota não encontrada.' });

    const distance = Number(route.distance || 0) / 1000;
    const duration = Math.max(1, Math.ceil(Number(route.duration || 0) / 60));
    return res.json({
      distance: distance.toFixed(2),
      duration,
      geometry: route.geometry,
      polyline: route.geometry?.coordinates || [],
      estimatedPrice: (distance * 5 + 10).toFixed(2)
    });
  } catch (error) {
    console.error('MAP_ROUTE_ERROR', error.message);
    return res.status(500).json({ error: 'Não foi possível calcular a rota agora.' });
  }
});

router.post('/geocode', async (req, res) => {
  try {
    const result = await geocodeAddress(req.body?.address);
    if (!result) return res.status(404).json({ error: 'Endereço não encontrado.' });
    return res.json(result);
  } catch (error) {
    console.error('MAP_GEOCODE_ERROR', error.message);
    return res.status(500).json({ error: 'Não foi possível pesquisar o endereço agora.' });
  }
});

router.post('/nearby-drivers', async (_req, res) => {
  // O despacho real de motoristas é feito pelo server.js, usando localização fresca
  // e ranking por distância/tempo de espera.
  return res.json({ drivers: [] });
});

module.exports = router;
