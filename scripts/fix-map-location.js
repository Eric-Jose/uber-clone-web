const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, '..', 'src', 'pages', 'MapRidePro.js');
let source = fs.readFileSync(appPath, 'utf8');

const replacements = [
  [
    "const DEFAULT_ORIGIN = { lat: -23.5505, lng: -46.6333, address: 'Av. das Palmeiras, 123 - Centro' };\nconst DEFAULT_DESTINATION = { lat: -23.5615, lng: -46.6560, address: 'Rua dos Ipês, 456 - Jardim das Flores' };",
    "const MARACAJU_CENTER = { lat: -21.6136, lng: -55.1684, address: 'Maracaju, MS' };"
  ],
  ["  const [origin, setOrigin] = useState(DEFAULT_ORIGIN);", "  const [origin, setOrigin] = useState(null);"],
  ["  const [destination, setDestination] = useState(DEFAULT_DESTINATION.address);", "  const [destination, setDestination] = useState('');"],
  ["  const [destinationCoords, setDestinationCoords] = useState(DEFAULT_DESTINATION);", "  const [destinationCoords, setDestinationCoords] = useState(null);"],
  ["  const [distanceKm, setDistanceKm] = useState(3.5);", "  const [distanceKm, setDistanceKm] = useState(0);"],
  ["  const [durationMin, setDurationMin] = useState(8);", "  const [durationMin, setDurationMin] = useState(0);"],
];

for (const [before, after] of replacements) {
  if (!source.includes(before)) throw new Error(`MapRidePro anchor not found: ${before.slice(0, 60)}`);
  source = source.replace(before, after);
}

const oldMapEffect = `  useEffect(() => {\n    if (!mapEl.current || map.current) return;\n    const mapInstance = L.map(mapEl.current, { zoomControl: false, attributionControl: false }).setView([DEFAULT_ORIGIN.lat, DEFAULT_ORIGIN.lng], 15);\n    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19, subdomains: 'abcd' }).addTo(mapInstance);\n    L.control.zoom({ position: 'bottomright' }).addTo(mapInstance);\n    map.current = mapInstance;\n    renderRoute(DEFAULT_ORIGIN, DEFAULT_DESTINATION);\n    if (navigator.geolocation) {\n      navigator.geolocation.getCurrentPosition((pos) => {\n        const userLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude, address: 'Sua localização atual' };\n        setOrigin(userLoc);\n        mapInstance.setView([userLoc.lat, userLoc.lng], 15);\n        renderRoute(userLoc, destinationCoords);\n      }, () => {}, { timeout: 6000 });\n    }\n    return () => {\n      clearTimeout(toastTimer.current);\n      clearInterval(pollTimer.current);\n      clearInterval(elapsedTimer.current);\n      mapInstance.remove();\n      map.current = null;\n    };\n  }, []);`;

const newMapEffect = `  useEffect(() => {\n    if (!mapEl.current || map.current) return;\n    const mapInstance = L.map(mapEl.current, { zoomControl: false, attributionControl: false, preferCanvas: true }).setView([MARACAJU_CENTER.lat, MARACAJU_CENTER.lng], 14);\n    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19, subdomains: 'abcd', updateWhenIdle: true }).addTo(mapInstance);\n    L.control.zoom({ position: 'bottomright' }).addTo(mapInstance);\n    map.current = mapInstance;\n\n    let watchId = null;\n    const applyDeviceLocation = (pos) => {\n      const lat = Number(pos.coords.latitude);\n      const lng = Number(pos.coords.longitude);\n      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;\n      const userLoc = { lat, lng, address: 'Sua localização atual' };\n      setOrigin(userLoc);\n      mapInstance.setView([lat, lng], 16);\n      if (userMarker.current) userMarker.current.setLatLng([lat, lng]);\n      else {\n        const originIcon = L.divIcon({ className: 'pf-origin-pin-icon', html: '<div style=\"width:18px;height:18px;border-radius:50%;background:#22c55e;border:3px solid #fff;box-shadow:0 0 12px rgba(34,197,94,.8)\"></div>', iconSize: [18, 18], iconAnchor: [9, 9] });\n        userMarker.current = L.marker([lat, lng], { icon: originIcon }).addTo(mapInstance);\n      }\n      setError('');\n      if (destinationCoords && Number.isFinite(Number(destinationCoords.lat)) && Number.isFinite(Number(destinationCoords.lng))) {\n        renderRoute(userLoc, destinationCoords);\n      }\n    };\n\n    const geoOptions = { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 };\n    if (navigator.geolocation) {\n      navigator.geolocation.getCurrentPosition(applyDeviceLocation, () => {\n        showToast('Permita a localização do dispositivo para usar sua posição exata.');\n      }, geoOptions);\n      watchId = navigator.geolocation.watchPosition(applyDeviceLocation, () => {}, geoOptions);\n    } else {\n      showToast('Geolocalização não disponível neste dispositivo.');\n    }\n\n    return () => {\n      if (watchId !== null && navigator.geolocation) navigator.geolocation.clearWatch(watchId);\n      clearTimeout(toastTimer.current);\n      clearInterval(pollTimer.current);\n      clearInterval(elapsedTimer.current);\n      mapInstance.remove();\n      map.current = null;\n    };\n  }, []);`;

if (!source.includes(oldMapEffect)) throw new Error('MapRidePro initial map effect anchor not found.');
source = source.replace(oldMapEffect, newMapEffect);

const oldSearch = `  const handleSearch = (value) => {\n    setDestination(value);\n    setDestinationCoords((current) => ({ ...current, address: value }));\n    if (value.trim().length < 2) { setSuggestions([]); return; }\n    setSearching(true);\n    const q = encodeURIComponent(value.trim());\n    fetch(\`${NOMINATIM}/search?format=jsonv2&q=${q}&countrycodes=br&limit=5\`).then((r) => r.json()).then((data) => { if (Array.isArray(data)) setSuggestions(data); }).catch(() => {}).finally(() => setSearching(false));\n  };`;
const newSearch = `  const handleSearch = (value) => {\n    setDestination(value);\n    setDestinationCoords((current) => ({ ...(current || {}), address: value }));\n    if (value.trim().length < 2) { setSuggestions([]); return; }\n    setSearching(true);\n    const q = encodeURIComponent(\`${value.trim()}, Maracaju, Mato Grosso do Sul, Brasil\`);\n    fetch(\`${NOMINATIM}/search?format=jsonv2&q=${q}&countrycodes=br&limit=5&viewbox=-55.30,-21.50,-55.00,-21.75&bounded=1\`).then((r) => r.json()).then((data) => { if (Array.isArray(data)) setSuggestions(data); }).catch(() => {}).finally(() => setSearching(false));\n  };`;
if (!source.includes(oldSearch)) throw new Error('MapRidePro destination search anchor not found.');
source = source.replace(oldSearch, newSearch);

const validationOld = "    if (!origin || !Number.isFinite(Number(origin.lat)) || !destinationCoords || !Number.isFinite(Number(destinationCoords.lat)) || !Number.isFinite(Number(destinationCoords.lng))) {\n      setError('Escolha um destino válido.'); return;\n    }";
const validationNew = "    if (!origin || !Number.isFinite(Number(origin.lat)) || !Number.isFinite(Number(origin.lng))) {\n      setError('Aguardando sua localização atual. Permita o acesso à localização do dispositivo.'); return;\n    }\n    if (!destinationCoords || !Number.isFinite(Number(destinationCoords.lat)) || !Number.isFinite(Number(destinationCoords.lng))) {\n      setError('Escolha um destino em Maracaju.'); return;\n    }";
if (!source.includes(validationOld)) throw new Error('MapRidePro ride validation anchor not found.');
source = source.replace(validationOld, validationNew);

source = source.replace("const PHOTON = 'https://photon.komoot.io/api/';\n", '');

fs.writeFileSync(appPath, source, 'utf8');
console.log('[fix-map-location] Mapa inicial sem rota fixa, localização GPS de alta precisão e destinos limitados a Maracaju.');
