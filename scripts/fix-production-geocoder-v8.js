const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'backend', 'routes', 'location.js');
let source = fs.readFileSync(file, 'utf8');
const start = source.indexOf("router.get('/search'");
const end = source.indexOf('\nrouter.use(authenticate);', start);
if (start < 0 || end < 0) throw new Error('Location search route not found');

let route = source.slice(start, end);

// This patch runs after v7. Keep it idempotent and avoid depending on one
// exact whitespace/escaping representation of the generated route.
if (!route.includes('let localArea =')) {
  route = route.replace("limit: '30'", "limit: '50'");
  route = route.replace("maxLocations: '30'", "maxLocations: '50'");
  route = route.replace(/\.slice\(0, 20\);/, '.slice(0, 40);');

  const categoryStart = route.indexOf('  const categoryMap = [');
  const localQueriesStart = route.indexOf('  const localQueries = [', categoryStart);
  if (categoryStart < 0 || localQueriesStart < 0) {
    throw new Error('Expected v7 category search block not found');
  }
  const localQueriesEnd = route.indexOf('  const queries = [query];', localQueriesStart);
  if (localQueriesEnd < 0) throw new Error('Expected v7 query block not found');

  const categoryBlock = `  const categoryMap = [
    { re: /^mercad/i, terms: ['mercado', 'supermercado', 'mercearia'] },
    { re: /^super\\s*mercad/i, terms: ['supermercado', 'mercado', 'mercearia'] },
    { re: /^hospital/i, terms: ['hospital', 'pronto atendimento', 'hospitalar'] },
    { re: /^farm[aá]cia/i, terms: ['farmacia', 'drogaria', 'farmácia'] },
    { re: /^drogari/i, terms: ['drogaria', 'farmacia', 'farmácia'] },
    { re: /^posto/i, terms: ['posto', 'posto de combustivel', 'posto de combustível'] },
    { re: /^hotel/i, terms: ['hotel', 'pousada'] },
    { re: /^restaur/i, terms: ['restaurante', 'lanchonete', 'churrascaria'] },
    { re: /^padari/i, terms: ['padaria', 'panificadora'] },
  ];
  const matchedCategory = categoryMap.find((item) => item.re.test(normalized));
  const categoryTerms = matchedCategory ? matchedCategory.terms : [query];

  // GPS-first locality. Reverse-geocode the device once per request so
  // category searches naturally prioritize the city/region where the phone is.
  let localArea = 'Maracaju MS';
  if (hasOrigin) {
    try {
      const reverseController = new AbortController();
      const reverseTimer = setTimeout(() => reverseController.abort(), 1800);
      const reverseParams = new URLSearchParams({
        format: 'jsonv2',
        lat: String(lat),
        lon: String(lon),
        zoom: '10',
        addressdetails: '1',
        'accept-language': 'pt-BR',
      });
      const reverseResponse = await fetch('https://nominatim.openstreetmap.org/reverse?' + reverseParams.toString(), {
        headers: { Accept: 'application/json', 'User-Agent': 'PrecoFixo17/1.0 locality-search' },
        signal: reverseController.signal,
      });
      clearTimeout(reverseTimer);
      if (reverseResponse.ok) {
        const reverse = await reverseResponse.json();
        const address = reverse?.address || {};
        const city = address.city || address.town || address.municipality || address.village || address.county;
        const state = address.state || '';
        if (city) localArea = [city, state].filter(Boolean).join(' ');
      }
    } catch (_) {
      // Maracaju remains the safe fallback when reverse geocoding is unavailable.
    }
  }

  const localQueries = [];
  for (const term of categoryTerms) localQueries.push(term + ' ' + localArea);
  localQueries.push(query + ' ' + localArea);
`;

  route = route.slice(0, categoryStart) + categoryBlock + route.slice(localQueriesEnd);
}

// GPS proximity must outrank the old fixed Maracaju bonus when a device
// position is available. Also works with the v7 score block exactly once.
if (!route.includes('distance <= 35 ? 10000 : 0')) {
  const scoreStart = route.indexOf('    const score = (item) => {');
  const scoreEnd = route.indexOf('    };', scoreStart);
  if (scoreStart < 0 || scoreEnd < 0) throw new Error('Expected v7 scoring block not found');
  const scoreBlock = `    const score = (item) => {
      const name = String(item.display_name || '').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '');
      const exact = name.includes(normalized) ? 1000 : 0;
      const compactMatch = compact.length >= 2 && name.replace(/\\s+/g, '').includes(compact) ? 500 : 0;
      const termMatch = queryTerms.some((term) => term.length >= 2 && name.includes(term)) ? 250 : 0;
      const itemLat = Number(item.lat), itemLon = Number(item.lon);
      const distance = distanceKm(itemLat, itemLon, originLat, originLon);
      const local = hasOrigin
        ? (distance <= 35 ? 10000 : 0)
        : (isMaracaju(item) ? 10000 : 0);
      const proximity = hasOrigin
        ? Math.max(0, 6000 - Math.min(distance * 120, 6000))
        : Math.max(0, 500 - Math.min(distance, 500));
      return local + exact + compactMatch + termMatch + proximity;
    };`;
  route = route.slice(0, scoreStart) + scoreBlock + route.slice(scoreEnd + 6);
}

source = source.slice(0, start) + route + source.slice(end);
fs.writeFileSync(file, source, 'utf8');
console.log('[fix-production-geocoder-v8] GPS-first locality patch applied safely.');
