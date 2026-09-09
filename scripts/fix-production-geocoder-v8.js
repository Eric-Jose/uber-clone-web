const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'backend', 'routes', 'location.js');
let source = fs.readFileSync(file, 'utf8');
const start = source.indexOf("router.get('/search'");
const end = source.indexOf('\nrouter.use(authenticate);', start);
if (start < 0 || end < 0) throw new Error('Location search route not found');

let route = source.slice(start, end);
route = route.replace("limit: '30'", "limit: '50'");
route = route.replace("maxLocations: '30'", "maxLocations: '50'");
route = route.replace("      .slice(0, 20);", "      .slice(0, 40);");

const oldBlock = `  const categoryMap = [
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
  const localQueries = [];
  for (const term of categoryTerms) {
    localQueries.push(term + ' Maracaju MS');
  }
  localQueries.push(query + ' Maracaju MS', query + ' Maracaju Mato Grosso do Sul');`;

const newBlock = `  const categoryMap = [
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

  // GPS-first locality: when the device is in another city, discover that
  // city once and use it as the local search area. Maracaju is only the
  // fallback when no usable device position/locality is available.
  let localArea = 'Maracaju MS';
  if (hasOrigin) {
    try {
      const reverseController = new AbortController();
      const reverseTimer = setTimeout(() => reverseController.abort(), 1800);
      const reverseParams = new URLSearchParams({
        format: 'jsonv2', lat: String(lat), lon: String(lon), zoom: '10', addressdetails: '1', 'accept-language': 'pt-BR'
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
      // Keep Maracaju as safe fallback if reverse geocoding is unavailable.
    }
  }

  const localQueries = [];
  for (const term of categoryTerms) localQueries.push(term + ' ' + localArea);
  localQueries.push(query + ' ' + localArea);`;

if (!route.includes(oldBlock)) throw new Error('Expected v8 category block not found');
route = route.replace(oldBlock, newBlock);

const oldScore = `      const local = isMaracaju(item) ? 10000 : 0;
      const distance = distanceKm(Number(item.lat), Number(item.lon), originLat, originLon);
      const proximity = Math.max(0, 500 - Math.min(distance, 500));
      return local + exact + compactMatch + termMatch + proximity;`;
const newScore = `      const itemLat = Number(item.lat), itemLon = Number(item.lon);
      const distance = distanceKm(itemLat, itemLon, originLat, originLon);
      const local = hasOrigin
        ? (distance <= 35 ? 10000 : 0)
        : (isMaracaju(item) ? 10000 : 0);
      const proximity = hasOrigin
        ? Math.max(0, 6000 - Math.min(distance * 120, 6000))
        : Math.max(0, 500 - Math.min(distance, 500));
      return local + exact + compactMatch + termMatch + proximity;`;
if (!route.includes(oldScore)) throw new Error('Expected v8 scoring block not found');
route = route.replace(oldScore, newScore);

source = source.slice(0, start) + route + source.slice(end);
fs.writeFileSync(file, source, 'utf8');
console.log('[fix-production-geocoder-v8] GPS-first locality: categories prioritize the device city/region automatically; Maracaju remains fallback.');
