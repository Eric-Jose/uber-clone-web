const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'src', 'pages', 'MapRidePro.js');
let source = fs.readFileSync(file, 'utf8');

if (!source.includes('const searchCacheRef = useRef(new Map());')) {
  source = source.replace(
    '  const searchRequestRef = useRef(0);',
    '  const searchRequestRef = useRef(0);\n  const searchAbortRef = useRef(null);\n  const searchCacheRef = useRef(new Map());\n  const searchDebounceRef = useRef(null);'
  );
} else if (!source.includes('const searchAbortRef = useRef(null);')) {
  source = source.replace(
    '  const searchRequestRef = useRef(0);',
    '  const searchRequestRef = useRef(0);\n  const searchAbortRef = useRef(null);'
  );
}

const start = source.indexOf('  const handleSearch = (value) => {');
const end = source.indexOf('\n\n  const handleSelectDestination', start);
if (start < 0 || end < 0) throw new Error('MapRidePro search block not found');

const replacement = `  const handleSearch = (value) => {
    const requestId = ++searchRequestRef.current;
    const term = String(value || '');
    const trimmed = term.trim();

    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (searchAbortRef.current) searchAbortRef.current.abort();
    searchAbortRef.current = null;

    setDestination(term);
    setDestinationCoords(null);
    setSuggestions([]);
    setSearching(false);
    setError('');

    if (trimmed.length < 1) return;

    const originLat = Number(origin?.lat);
    const originLng = Number(origin?.lng);
    const locationKey = Number.isFinite(originLat) && Number.isFinite(originLng)
      ? Math.round(originLat * 1000) + ',' + Math.round(originLng * 1000)
      : 'fallback';
    const cacheKey = trimmed.toLowerCase() + '|' + locationKey;
    const cached = searchCacheRef.current.get(cacheKey);
    if (cached) {
      setSuggestions(cached);
      return;
    }

    searchDebounceRef.current = setTimeout(() => {
      if (requestId !== searchRequestRef.current) return;
      const controller = new AbortController();
      searchAbortRef.current = controller;
      setSearching(true);

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
          const results = Array.isArray(data?.results) ? data.results.slice(0, 12) : [];
          searchCacheRef.current.set(cacheKey, results);
          if (searchCacheRef.current.size > 60) {
            const firstKey = searchCacheRef.current.keys().next().value;
            searchCacheRef.current.delete(firstKey);
          }
          setSuggestions(results);
          if (!results.length) setError('Local não encontrado. Tente continuar digitando o nome.');
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
    }, 180);
  };`;

source = source.slice(0, start) + replacement + source.slice(end);
fs.writeFileSync(file, source, 'utf8');
console.log('[fix-search-mobile-v5] Mobile-first search: GPS-aware cache, 1+ character suggestions, debounce and request cancellation.');
