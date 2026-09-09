const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'backend', 'routes', 'location.js');
let source = fs.readFileSync(file, 'utf8');
const start = source.indexOf("router.get('/search'");
const end = source.indexOf('\nrouter.use(authenticate);', start);
if (start < 0 || end < 0) throw new Error('Location search route not found');

const route = `router.get('/search', async (req, res) => {
  const query = clean(req.query.q);
  if (query.length < 1) return res.json({ success: true, results: [] });
  if (query.length > 200) return res.status(400).json({ success: false, error: 'Busca muito longa.', results: [] });

  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon ?? req.query.lng);
  const hasOrigin = numberOk(lat) && lat >= -90 && lat <= 90 && numberOk(lon) && lon >= -180 && lon <= 180;
  const maracaju = { lat: -21.6149, lon: -55.1683 };
  const normalized = query.toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '');
  const compact = normalized.replace(/\\s+/g, '');
  const poiNormalized = normalized.replace(/\\bsuper\\s+mercado\\b/g, 'supermercado');

  // Keep global search, but always ask the providers for a Maracaju-local
  // version too. This makes names/prefixes such as "p", "pi" and "pires"
  // surface local businesses before distant matches.
  const localQueries = [
    query + ' Maracaju MS',
    query + ' Maracaju Mato Grosso do Sul',
  ];
  const queries = [query];
  if (poiNormalized !== normalized) queries.push(poiNormalized);
  if (compact.length >= 3 && compact !== normalized) queries.push(compact);
  for (const localQuery of localQueries) if (!queries.some((q) => q.toLowerCase() === localQuery.toLowerCase())) queries.push(localQuery);

  const photonUrl = (q) => {
    const p = new URLSearchParams({ q, limit: '30', lang: 'pt' });
    if (hasOrigin) { p.set('lat', String(lat)); p.set('lon', String(lon)); }
    return 'https://photon.komoot.io/api/?' + p.toString();
  };
  const nominatimUrl = (q) => {
    const p = new URLSearchParams({ format: 'jsonv2', q, limit: '30', addressdetails: '1', 'accept-language': 'pt-BR', dedupe: '1' });
    if (hasOrigin) {
      const delta = 1.0;
      p.set('viewbox', (lon - delta) + ',' + (lat + delta) + ',' + (lon + delta) + ',' + (lat - delta));
      p.set('bounded', '0');
    }
    return 'https://nominatim.openstreetmap.org/search?' + p.toString();
  };
  const arcgisUrl = (q) => {
    const p = new URLSearchParams({ SingleLine: q, f: 'json', maxLocations: '30', outFields: '*', langCode: 'PT' });
    const searchLat = hasOrigin ? lat : maracaju.lat;
    const searchLon = hasOrigin ? lon : maracaju.lon;
    p.set('location', String(searchLon) + ',' + String(searchLat));
    p.set('distance', '100000');
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

  const distanceKm = (aLat, aLon, bLat, bLon) => {
    const rad = Math.PI / 180;
    const dLat = (bLat - aLat) * rad;
    const dLon = (bLon - aLon) * rad;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLon / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  };

  try {
    const [photonResults, nominatimResults, arcgisResults] = await Promise.all([
      Promise.allSettled(queries.map((q) => fetchJson(photonUrl(q), { Accept: 'application/json' }))),
      Promise.allSettled(queries.map((q) => fetchJson(nominatimUrl(q), { Accept: 'application/json', 'User-Agent': 'PrecoFixo17/1.0 address-search' }))),
      Promise.allSettled(queries.map((q) => fetchJson(arcgisUrl(q), { Accept: 'application/json' }))),
    ]);

    const photon = photonResults.flatMap((result) => result.status === 'fulfilled' && Array.isArray(result.value?.features)
      ? result.value.features.map((feature) => {
          const p = feature.properties || {};
          const coords = feature.geometry?.coordinates || [];
          const address = [p.name, p.street && p.housenumber ? p.street + ', ' + p.housenumber : p.street, p.city || p.town || p.village || p.municipality, p.state, p.country].filter(Boolean).join(' - ');
          return { lat: Number(coords[1]), lon: Number(coords[0]), display_name: address || p.name || query, place_id: 'photon-' + (p.osm_type || '') + '-' + (p.osm_id || address) };
        }) : []);
    const nominatim = nominatimResults.flatMap((result) => result.status === 'fulfilled' && Array.isArray(result.value) ? result.value : []);
    const arcgis = arcgisResults.flatMap((result) => result.status === 'fulfilled' && Array.isArray(result.value?.candidates)
      ? result.value.candidates.filter((c) => c.location && numberOk(c.location.y) && numberOk(c.location.x)).map((c) => ({ lat: Number(c.location.y), lon: Number(c.location.x), display_name: clean(c.address || query), place_id: 'arcgis-' + (c.address || c.location.x + '-' + c.location.y) })) : []);

    const originLat = hasOrigin ? lat : maracaju.lat;
    const originLon = hasOrigin ? lon : maracaju.lon;
    const queryTerms = [normalized, poiNormalized, compact].filter(Boolean);
    const isMaracaju = (item) => {
      const name = String(item.display_name || '').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '');
      const itemLat = Number(item.lat), itemLon = Number(item.lon);
      const distance = distanceKm(itemLat, itemLon, maracaju.lat, maracaju.lon);
      return name.includes('maracaju') || distance <= 45;
    };
    const score = (item) => {
      const name = String(item.display_name || '').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '');
      const exact = name.includes(normalized) ? 1000 : 0;
      const compactMatch = compact.length >= 2 && name.replace(/\\s+/g, '').includes(compact) ? 500 : 0;
      const termMatch = queryTerms.some((term) => term.length >= 2 && name.includes(term)) ? 250 : 0;
      const local = isMaracaju(item) ? 10000 : 0;
      const distance = distanceKm(Number(item.lat), Number(item.lon), originLat, originLon);
      const proximity = Math.max(0, 500 - Math.min(distance, 500));
      return local + exact + compactMatch + termMatch + proximity;
    };

    const merged = [...arcgis, ...photon, ...nominatim]
      .filter((item) => numberOk(item.lat) && numberOk(item.lon))
      .filter((item, index, array) => {
        const key = Number(item.lat).toFixed(5) + '|' + Number(item.lon).toFixed(5);
        return array.findIndex((other) => Number(other.lat).toFixed(5) + '|' + Number(other.lon).toFixed(5) === key) === index;
      })
      .sort((a, b) => score(b) - score(a))
      .slice(0, 20);

    return res.json({ success: true, results: merged });
  } catch (error) {
    console.error('Erro na busca de endereço:', error.message);
    return res.status(502).json({ success: false, error: 'Não foi possível pesquisar o local agora.', results: [] });
  }
});`;

source = source.slice(0, start) + route + source.slice(end);
fs.writeFileSync(file, source, 'utf8');
console.log('[fix-production-geocoder-v7] Global search enabled with Maracaju/MS local POI priority.');
