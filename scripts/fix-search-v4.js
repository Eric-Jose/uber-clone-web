const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, '..', 'src', 'pages', 'MapRidePro.js');
let source = fs.readFileSync(appPath, 'utf8');

if (!source.includes('const searchRequestRef = useRef(0);')) {
  source = source.replace('  const elapsedTimer = useRef(null);', '  const elapsedTimer = useRef(null);\n  const searchRequestRef = useRef(0);');
}

const start = source.indexOf('  const handleSearch = (value) => {');
const end = source.indexOf('\n\n  const handleSelectDestination', start);
if (start < 0 || end < 0) throw new Error('MapRidePro search block not found');

const replacement = `  const handleSearch = (value) => {
    const requestId = ++searchRequestRef.current;
    const term = String(value || '').trim();
    setDestination(value);
    setSuggestions([]);
    setSearching(false);
    setError('');
    setDestinationCoords(null);
    if (term.length < 2) return;

    setSearching(true);
    const photonUrl = 'https://photon.komoot.io/api/?q=' + encodeURIComponent(term) + '&limit=8&lang=pt';
    const nominatimUrl = NOMINATIM + '/search?format=jsonv2&q=' + encodeURIComponent(term) + '&limit=8&addressdetails=1&accept-language=pt-BR';

    const fetchJson = (url) => fetch(url, { headers: { Accept: 'application/json' } }).then((r) => {
      if (!r.ok) throw new Error('SEARCH_HTTP_' + r.status);
      return r.json();
    });

    Promise.allSettled([fetchJson(photonUrl), fetchJson(nominatimUrl)])
      .then((results) => {
        if (requestId !== searchRequestRef.current) return;
        const photon = results[0].status === 'fulfilled' && Array.isArray(results[0].value?.features)
          ? results[0].value.features.map((f) => {
              const p = f.properties || {};
              const c = f.geometry?.coordinates || [];
              const display = [p.name, p.street && p.housenumber ? p.street + ', ' + p.housenumber : p.street, p.city || p.town || p.village, p.state, p.country]
                .filter(Boolean).join(' - ');
              return { lat: Number(c[1]), lon: Number(c[0]), display_name: display || p.name || term, place_id: 'photon-' + (f.properties?.osm_id || display) };
            }) : [];
        const nominatim = results[1].status === 'fulfilled' && Array.isArray(results[1].value) ? results[1].value : [];
        const all = [...photon, ...nominatim].filter((item) => Number.isFinite(Number(item.lat)) && Number.isFinite(Number(item.lon)));
        const seen = new Set();
        const ordered = all.filter((item) => {
          const key = item.place_id || (item.display_name + '|' + item.lat + '|' + item.lon);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        }).sort((a, b) => {
          const am = String(a.display_name || '').toLowerCase().includes('maracaju');
          const bm = String(b.display_name || '').toLowerCase().includes('maracaju');
          return Number(bm) - Number(am);
        });
        setSuggestions(ordered.slice(0, 8));
        if (!ordered.length) setError('Nenhum endereço encontrado. Tente rua, número, bairro ou cidade.');
      })
      .catch(() => {
        if (requestId === searchRequestRef.current) setError('Não foi possível pesquisar o endereço agora.');
      })
      .finally(() => {
        if (requestId === searchRequestRef.current) setSearching(false);
      });
  };`;

source = source.slice(0, start) + replacement + source.slice(end);
fs.writeFileSync(appPath, source, 'utf8');
console.log('[fix-search-v4] Destination search now uses Photon + Nominatim fallback with race protection.');
