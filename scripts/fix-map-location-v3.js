const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, '..', 'src', 'pages', 'MapRidePro.js');
let source = fs.readFileSync(appPath, 'utf8');

source = source.replace(/const DEFAULT_ORIGIN = \{[\s\S]*?\};\nconst DEFAULT_DESTINATION = \{[\s\S]*?\};/, "const MARACAJU_CENTER = { lat: -21.6136, lng: -55.1684, address: 'Maracaju, MS' };");
source = source.replace("  const [origin, setOrigin] = useState(DEFAULT_ORIGIN);", "  const [origin, setOrigin] = useState(null);");
source = source.replace("  const [destination, setDestination] = useState(DEFAULT_DESTINATION.address);", "  const [destination, setDestination] = useState('');");
source = source.replace("  const [destinationCoords, setDestinationCoords] = useState(DEFAULT_DESTINATION);", "  const [destinationCoords, setDestinationCoords] = useState(null);");
source = source.replace("  const [distanceKm, setDistanceKm] = useState(3.5);", "  const [distanceKm, setDistanceKm] = useState(0);");
source = source.replace("  const [durationMin, setDurationMin] = useState(8);", "  const [durationMin, setDurationMin] = useState(0);");
source = source.replace("const PHOTON = 'https://photon.komoot.io/api/';\n", '');

const effectStart = source.indexOf("  useEffect(() => {\n    if (!mapEl.current || map.current) return;");
const effectEnd = source.indexOf("\n\n  const renderRoute = async", effectStart);
if (effectStart < 0 || effectEnd < 0) throw new Error('MapRidePro map initialization block not found.');
const newEffect = [
  '  useEffect(() => {',
  '    if (!mapEl.current || map.current) return;',
  "    const mapInstance = L.map(mapEl.current, { zoomControl: false, attributionControl: false, preferCanvas: true }).setView([MARACAJU_CENTER.lat, MARACAJU_CENTER.lng], 14);",
  "    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19, subdomains: 'abcd', updateWhenIdle: true }).addTo(mapInstance);",
  "    L.control.zoom({ position: 'bottomright' }).addTo(mapInstance);",
  '    map.current = mapInstance;',
  '',
  '    let watchId = null;',
  '    const applyDeviceLocation = (pos) => {',
  '      const lat = Number(pos.coords.latitude);',
  '      const lng = Number(pos.coords.longitude);',
  '      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;',
  "      const userLoc = { lat, lng, address: 'Sua localização atual' };",
  '      setOrigin(userLoc);',
  '      mapInstance.setView([lat, lng], 16);',
  '      if (userMarker.current) userMarker.current.setLatLng([lat, lng]);',
  '      else {',
  "        const originIcon = L.divIcon({ className: 'pf-origin-pin-icon', html: '<div style=\"width:18px;height:18px;border-radius:50%;background:#22c55e;border:3px solid #fff;box-shadow:0 0 12px rgba(34,197,94,.8)\"></div>', iconSize: [18, 18], iconAnchor: [9, 9] });",
  '        userMarker.current = L.marker([lat, lng], { icon: originIcon }).addTo(mapInstance);',
  '      }',
  "      setError('');",
  '    };',
  '',
  '    const geoOptions = { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 };',
  '    if (navigator.geolocation) {',
  "      navigator.geolocation.getCurrentPosition(applyDeviceLocation, () => showToast('Permita a localização do dispositivo para usar sua posição exata.'), geoOptions);",
  '      watchId = navigator.geolocation.watchPosition(applyDeviceLocation, () => {}, geoOptions);',
  '    } else {',
  "      showToast('Geolocalização não disponível neste dispositivo.');",
  '    }',
  '',
  '    return () => {',
  '      if (watchId !== null && navigator.geolocation) navigator.geolocation.clearWatch(watchId);',
  '      clearTimeout(toastTimer.current);',
  '      clearInterval(pollTimer.current);',
  '      clearInterval(elapsedTimer.current);',
  '      mapInstance.remove();',
  '      map.current = null;',
  '    };',
  '  }, []);'
].join('\n');
source = source.slice(0, effectStart) + newEffect + source.slice(effectEnd);

const searchStart = source.indexOf('  const handleSearch = (value) => {');
const searchEnd = source.indexOf('\n\n  const handleSelectDestination', searchStart);
if (searchStart < 0 || searchEnd < 0) throw new Error('MapRidePro destination search block not found.');
const newSearch = [
  '  const handleSearch = (value) => {',
  '    setDestination(value);',
  '    setDestinationCoords((current) => ({ ...(current || {}), address: value }));',
  "    if (value.trim().length < 2) { setSuggestions([]); return; }",
  '    setSearching(true);',
  "    const q = encodeURIComponent(value.trim() + ', Maracaju, Mato Grosso do Sul, Brasil');",
  "    fetch(NOMINATIM + '/search?format=jsonv2&q=' + q + '&countrycodes=br&limit=5&viewbox=-55.30,-21.50,-55.00,-21.75&bounded=1')",
  '      .then((r) => r.json())',
  '      .then((data) => { if (Array.isArray(data)) setSuggestions(data); })',
  '      .catch(() => {})',
  '      .finally(() => setSearching(false));',
  '  };'
].join('\n');
source = source.slice(0, searchStart) + newSearch + source.slice(searchEnd);

const validationOld = "    if (!origin || !Number.isFinite(Number(origin.lat)) || !destinationCoords || !Number.isFinite(Number(destinationCoords.lat)) || !Number.isFinite(Number(destinationCoords.lng))) {\n      setError('Escolha um destino válido.'); return;\n    }";
const validationNew = "    if (!origin || !Number.isFinite(Number(origin.lat)) || !Number.isFinite(Number(origin.lng))) {\n      setError('Aguardando sua localização atual. Permita o acesso à localização do dispositivo.'); return;\n    }\n    if (!destinationCoords || !Number.isFinite(Number(destinationCoords.lat)) || !Number.isFinite(Number(destinationCoords.lng))) {\n      setError('Escolha um destino em Maracaju.'); return;\n    }";
if (source.includes(validationOld)) source = source.replace(validationOld, validationNew);

source = source.replace("value={origin.address} onChange={(e)=>setOrigin({...origin,address:e.target.value})}", "value={origin?.address || 'Obtendo localização atual...'} readOnly");
source = source.replace("placeholder=\"Rua dos Ipês, 456 - Jardim das Flores\"", "placeholder=\"Digite seu destino em Maracaju\"");

fs.writeFileSync(appPath, source, 'utf8');
console.log('[fix-map-location-v3] GPS automático protegido, sem rota fixa e destino somente após escolha do passageiro.');
