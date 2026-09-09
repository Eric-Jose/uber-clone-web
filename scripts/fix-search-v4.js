const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, '..', 'src', 'pages', 'MapRidePro.js');
let source = fs.readFileSync(appPath, 'utf8');

if (!source.includes('const searchRequestRef = useRef(0);')) {
  source = source.replace('  const elapsedTimer = useRef(null);', '  const elapsedTimer = useRef(null);\n  const searchRequestRef = useRef(0);\n  const searchAbortRef = useRef(null);');
} else if (!source.includes('const searchAbortRef = useRef(null);')) {
  source = source.replace('  const searchRequestRef = useRef(0);', '  const searchRequestRef = useRef(0);\n  const searchAbortRef = useRef(null);');
}

const start = source.indexOf('  const handleSearch = (value) => {');
const end = source.indexOf('\n\n  const handleSelectDestination', start);
if (start < 0 || end < 0) throw new Error('MapRidePro search block not found');

const replacement = `  const handleSearch = (value) => {
    const requestId = ++searchRequestRef.current;
    const term = String(value || '');
    const trimmed = term.trim();

    if (searchAbortRef.current) searchAbortRef.current.abort();
    searchAbortRef.current = null;

    setDestination(term);
    setDestinationCoords(null);
    setSuggestions([]);
    setSearching(false);
    setError('');

    if (trimmed.length < 2) return;

    const controller = new AbortController();
    searchAbortRef.current = controller;
    setSearching(true);

    // Send the current GPS position so local businesses are ranked first,
    // while the backend still allows worldwide results.
    const originLat = Number(origin?.lat);
    const originLng = Number(origin?.lng);
    const locationQuery = Number.isFinite(originLat) && Number.isFinite(originLng)
      ? '&lat=' + encodeURIComponent(originLat) + '&lon=' + encodeURIComponent(originLng)
      : '';

    fetch((B || '') + '/api/location/search?q=' + encodeURIComponent(trimmed) + locationQuery, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
      cache: 'no-store',
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data?.error || 'SEARCH_HTTP_' + response.status);
        return data;
      })
      .then((data) => {
        if (requestId !== searchRequestRef.current || controller.signal.aborted) return;
        const results = Array.isArray(data?.results) ? data.results : [];
        setSuggestions(results.slice(0, 20));
        if (!results.length) setError('Local não encontrado. Tente o nome do estabelecimento ou endereço completo.');
      })
      .catch((searchError) => {
        if (controller.signal.aborted || requestId !== searchRequestRef.current) return;
        setSuggestions([]);
        setError(searchError?.message || 'Não foi possível pesquisar o local agora.');
      })
      .finally(() => {
        if (requestId === searchRequestRef.current) {
          setSearching(false);
          searchAbortRef.current = null;
        }
      });
  };`;

source = source.slice(0, start) + replacement + source.slice(end);

const selectStart = source.indexOf('  const handleSelectDestination = (item) => {');
const selectEnd = source.indexOf('\n\n  const handleRequestRide', selectStart);
if (selectStart < 0 || selectEnd < 0) throw new Error('MapRidePro destination selection block not found');
const selectReplacement = `  const handleSelectDestination = (item) => {
    const lat = Number(item?.lat);
    const lng = Number(item?.lon ?? item?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const address = String(item?.display_name || item?.address || '').trim();
    if (!address) return;
    const dest = { lat, lng, address };
    setDestination(address);
    setDestinationCoords(dest);
    setSuggestions([]);
    setSearching(false);
    setError('');
    renderRoute(origin, dest);
  };`;
source = source.slice(0, selectStart) + selectReplacement + source.slice(selectEnd);

fs.writeFileSync(appPath, source, 'utf8');

// The Vercel build includes the API source too. Patch the server-side geocoder
// during the same build so POI/business-name searches work in production even
// when the checked-in backend file came from an older search implementation.
const locationPath = path.join(__dirname, '..', 'backend', 'routes', 'location.js');
let locationSource = fs.readFileSync(locationPath, 'utf8');
const locationStart = locationSource.indexOf("  const encoded = encodeURIComponent(query);");
const locationEnd = locationSource.indexOf("\n\n  const fetchJson", locationStart);
if (locationStart >= 0 && locationEnd >= 0) {
  const locationReplacement = `  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon ?? req.query.lng);
  const hasOrigin = Number.isFinite(lat) && lat >= -90 && lat <= 90 && Number.isFinite(lon) && lon >= -180 && lon <= 180;

  // Business/POI names are commonly typed with extra spaces ("super mercado").
  // Search equivalent spellings in both providers and merge their coordinates.
  const normalized = query.replace(/\\s+/g, ' ').trim();
  const compact = normalized.replace(/\\s+/g, '');
  const poiNormalized = normalized.replace(/\\bsuper\\s+mercado\\b/gi, 'supermercado');
  const queries = [normalized];
  if (compact.length >= 2 && compact.toLowerCase() !== normalized.toLowerCase()) queries.push(compact);
  if (poiNormalized.toLowerCase() !== normalized.toLowerCase()) queries.push(poiNormalized);

  const buildPhotonUrl = (q) => {
    const params = new URLSearchParams({ q, limit: '20', lang: 'pt' });
    if (hasOrigin) { params.set('lat', String(lat)); params.set('lon', String(lon)); }
    return 'https://photon.komoot.io/api/?' + params.toString();
  };
  const buildNominatimUrl = (q) => {
    const params = new URLSearchParams({ format: 'jsonv2', q, limit: '20', addressdetails: '1', 'accept-language': 'pt-BR', dedupe: '1' });
    if (hasOrigin) {
      const delta = 1.0;
      params.set('viewbox', (lon - delta) + ',' + (lat + delta) + ',' + (lon + delta) + ',' + (lat - delta));
    }
    return 'https://nominatim.openstreetmap.org/search?' + params.toString();
  };`;
  locationSource = locationSource.slice(0, locationStart) + locationReplacement + locationSource.slice(locationEnd);

  const parallelStart = locationSource.indexOf('    const [photonResult, nominatimResult] = await Promise.allSettled([');
  const parallelEnd = locationSource.indexOf('    ]);', parallelStart);
  if (parallelStart >= 0 && parallelEnd >= 0) {
    const parallelReplacement = `    const photonResults = await Promise.allSettled(queries.map((q) => fetchJson(buildPhotonUrl(q), { Accept: 'application/json' })));
    const nominatimResults = await Promise.allSettled(queries.map((q) => fetchJson(buildNominatimUrl(q), { Accept: 'application/json', 'User-Agent': 'PrecoFixo17/1.0 address-search' })));`;
    locationSource = locationSource.slice(0, parallelStart) + parallelReplacement + locationSource.slice(parallelEnd + '    ]);'.length);

    const oldPhotonStart = locationSource.indexOf('    const photon = photonResult.status');
    const oldPhotonEnd = locationSource.indexOf('\n\n    const nominatim = nominatimResult.status', oldPhotonStart);
    if (oldPhotonStart >= 0 && oldPhotonEnd >= 0) {
      const photonReplacement = `    const photon = photonResults.flatMap((result) => result.status === 'fulfilled' && Array.isArray(result.value?.features)
      ? result.value.features.map((feature) => {
          const p = feature.properties || {};
          const coords = feature.geometry?.coordinates || [];
          const address = [p.name, p.street && p.housenumber ? p.street + ', ' + p.housenumber : p.street, p.city || p.town || p.village || p.municipality, p.state, p.country].filter(Boolean).join(' - ');
          return { lat: Number(coords[1]), lon: Number(coords[0]), display_name: address || p.name || query, place_id: 'photon-' + (p.osm_type || '') + '-' + (p.osm_id || address) };
        }) : []);`;
      locationSource = locationSource.slice(0, oldPhotonStart) + photonReplacement + locationSource.slice(oldPhotonEnd);

      const oldNomStart = locationSource.indexOf('    const nominatim = nominatimResult.status');
      const oldNomEnd = locationSource.indexOf('\n\n    const merged =', oldNomStart);
      if (oldNomStart >= 0 && oldNomEnd >= 0) {
        const nomReplacement = `    const nominatim = nominatimResults.flatMap((result) => result.status === 'fulfilled' && Array.isArray(result.value) ? result.value : []);`;
        locationSource = locationSource.slice(0, oldNomStart) + nomReplacement + locationSource.slice(oldNomEnd);
      }
    }
  }

  const oldSort = `.sort((a, b) => {\n        const am = String(a.display_name || '').toLowerCase().includes(query.toLowerCase());\n        const bm = String(b.display_name || '').toLowerCase().includes(query.toLowerCase());\n        return Number(bm) - Number(am);\n      })`;
  if (locationSource.includes(oldSort)) {
    locationSource = locationSource.replace(oldSort, `.sort((a, b) => {\n        const an = String(a.display_name || '').toLowerCase();\n        const bn = String(b.display_name || '').toLowerCase();\n        const terms = queries.map((q) => q.toLowerCase());\n        const score = (name) => (name.includes(normalized.toLowerCase()) ? 100 : 0) + (terms.some((term) => name.includes(term)) ? 40 : 0);\n        return score(bn) - score(an);\n      })`);
  }
  fs.writeFileSync(locationPath, locationSource, 'utf8');
}

console.log('[fix-search-v4] Passenger search now supports addresses and business/POI names, including repeated searches and "super mercado" normalization.');
