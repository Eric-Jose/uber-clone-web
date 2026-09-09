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

    // Every edit starts a completely new worldwide search. The previous
    // destination is invalidated immediately and stale requests are cancelled.
    setDestination(term);
    setDestinationCoords(null);
    setSuggestions([]);
    setSearching(false);
    setError('');

    if (trimmed.length < 2) return;

    const controller = new AbortController();
    searchAbortRef.current = controller;
    setSearching(true);

    fetch((B || '') + '/api/location/search?q=' + encodeURIComponent(trimmed), {
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
        if (!results.length) setError('Nenhum endereço encontrado. Tente rua, número, bairro, cidade ou país.');
      })
      .catch((searchError) => {
        if (controller.signal.aborted || requestId !== searchRequestRef.current) return;
        setSuggestions([]);
        setError(searchError?.message || 'Não foi possível pesquisar o endereço agora.');
      })
      .finally(() => {
        if (requestId === searchRequestRef.current) {
          setSearching(false);
          searchAbortRef.current = null;
        }
      });
  };`;

source = source.slice(0, start) + replacement + source.slice(end);

// A destination must always be explicitly selected from the current search.
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
console.log('[fix-search-v4] Passenger destination search is worldwide, uses the backend geocoding proxy, supports up to 20 suggestions, cancels stale requests, and allows unlimited repeated searches.');
