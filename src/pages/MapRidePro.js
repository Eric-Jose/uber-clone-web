/* eslint-disable no-unused-vars, react-hooks/exhaustive-deps */
import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import WebSocketService from '../services/WebSocketService';
import { dispatchRideSearch } from '../services/rideDispatch';
import { BACKEND_URL as B } from '../config';
import precoFixo17Car from '../assets/precoFixo17Car';
import '../styles/PrecoFixo17Reference.css';

const OSRM = 'https://router.project-osrm.org/route/v1/driving';
const FIXED_RIDE_PRICE = 17;
const MARACAJU_CENTER = { lat: -21.6136, lng: -55.1684, address: 'Maracaju, MS' };

export default function MapRidePro({ onRideCreate, onBack, onNavigate, onOpenMenu, onOpenNotifications }) {
  const mapEl = useRef(null);
  const map = useRef(null);
  const userMarker = useRef(null);
  const destMarker = useRef(null);
  const driverMarker = useRef(null);
  const routeLayer = useRef(null);
  const toastTimer = useRef(null);
  const pollTimer = useRef(null);
  const elapsedTimer = useRef(null);
  const rideSubmitRef = useRef(false);
  const searchRequestRef = useRef(0);
  const searchAbortRef = useRef(null);
  const searchCacheRef = useRef(new Map());
  const searchDebounceRef = useRef(null);

  const [stage, setStage] = useState('plan');
  const [origin, setOrigin] = useState(null);
  const [destination, setDestination] = useState('');
  const [destinationCoords, setDestinationCoords] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [distanceKm, setDistanceKm] = useState(0);
  const [durationMin, setDurationMin] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('Dinheiro');
  const [promoCode, setPromoCode] = useState(() => { try { return localStorage.getItem('pf_selected_promo') || 'Nenhuma'; } catch (_) { return 'Nenhuma'; } });
  const [passengerCount, setPassengerCount] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [currentRideId, setCurrentRideId] = useState(null);
  const [ride, setRide] = useState(null);
  const [toastMessage, setToastMessage] = useState('');
  const [modalType, setModalType] = useState(null);
  const [chatMessage, setChatMessage] = useState('');
  const [chatMessages, setChatMessages] = useState([
    { from: 'driver', text: 'Olá! Estou a caminho do seu local de embarque.', time: '14:28' }
  ]);
  const [driver, setDriver] = useState(null);
  const [etaMinutes, setEtaMinutes] = useState(2);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [driverLocation, setDriverLocation] = useState(null);

  const token = localStorage.getItem('token');
  let currentUser = null;
  try { currentUser = JSON.parse(localStorage.getItem('user') || 'null'); } catch (_) {}
  const isPassenger = currentUser?.userType === 'passenger';
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  const showToast = (msg) => {
    setToastMessage(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMessage(''), 3500);
  };

  const normalizeRide = (value) => value?.ride || value || null;

  const fetchDriver = async (driverId) => {
    if (!driverId || !token) return;
    try {
      const response = await fetch(`${B}/api/drivers/${driverId}`, { headers: authHeaders, timeout: 8000 });
      if (!response.ok) return;
      const data = await response.json();
      setDriver(data.driver || data);
      const loc = data.driver?.currentLocation || data.currentLocation;
      if (loc) setDriverLocation({ lat: Number(loc.lat ?? loc.latitude), lng: Number(loc.lng ?? loc.longitude) });
    } catch (_) {}
  };

  const applyRideState = (nextRide) => {
    if (!nextRide) return false;
    setRide(nextRide);
    setCurrentRideId(nextRide.id || null);
    if (nextRide.driverId) void fetchDriver(nextRide.driverId);
    if (nextRide.driverLocation) setDriverLocation({ lat: Number(nextRide.driverLocation.lat ?? nextRide.driverLocation.latitude), lng: Number(nextRide.driverLocation.lng ?? nextRide.driverLocation.longitude) });
    if (nextRide.destination?.location) {
      setDestinationCoords({ ...nextRide.destination.location, address: nextRide.destination.address || destination });
    }
    if (nextRide.origin?.location) setOrigin((current) => ({ ...current, ...nextRide.origin.location }));

    if (nextRide.status === 'SEARCHING') {
      setStage('arriving');
      setEtaMinutes(2);
    } else if (nextRide.status === 'ACCEPTED') {
      setStage('arriving');
      setEtaMinutes(Number(nextRide.etaMinutes || 2));
    } else if (nextRide.status === 'IN_PROGRESS') {
      setStage('in_progress');
    } else if (nextRide.status === 'COMPLETED') {
      setDriverLocation(null);
      setStage('plan');
    } else if (nextRide.status === 'CANCELLED') {
      setDriverLocation(null);
      setStage('plan');
      showToast('A corrida foi cancelada.');
    }
    return true;
  };

  useEffect(() => {
    if (!mapEl.current || map.current) return;
    const mapInstance = L.map(mapEl.current, { zoomControl: false, attributionControl: false, preferCanvas: true }).setView([MARACAJU_CENTER.lat, MARACAJU_CENTER.lng], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors', updateWhenIdle: true }).addTo(mapInstance);
    L.control.zoom({ position: 'bottomright' }).addTo(mapInstance);
    map.current = mapInstance;

    let watchId = null;
    const applyDeviceLocation = (pos) => {
      const lat = Number(pos.coords.latitude);
      const lng = Number(pos.coords.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      const userLoc = { lat, lng, address: 'Sua localização atual' };
      setOrigin(userLoc);
      mapInstance.setView([lat, lng], 16);
      if (userMarker.current) userMarker.current.setLatLng([lat, lng]);
      else {
        const originIcon = L.divIcon({ className: 'pf-origin-pin-icon', html: '<div style="width:18px;height:18px;border-radius:50%;background:#22c55e;border:3px solid #fff;box-shadow:0 0 12px rgba(34,197,94,.8)"></div>', iconSize: [18, 18], iconAnchor: [9, 9] });
        userMarker.current = L.marker([lat, lng], { icon: originIcon }).addTo(mapInstance);
      }
      setError('');
    };

    const geoOptions = { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 };
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(applyDeviceLocation, () => showToast('Permita a localização do dispositivo para usar sua posição exata.'), geoOptions);
      watchId = navigator.geolocation.watchPosition(applyDeviceLocation, () => {}, geoOptions);
    } else {
      showToast('Geolocalização não disponível neste dispositivo.');
    }

    return () => {
      if (watchId !== null && navigator.geolocation) navigator.geolocation.clearWatch(watchId);
      clearTimeout(toastTimer.current);
      clearInterval(pollTimer.current);
      clearInterval(elapsedTimer.current);
      mapInstance.remove();
      map.current = null;
    };
  }, []);

  const renderRoute = async (start, end) => {
    if (!map.current || !start || !end) return;
    if (routeLayer.current) routeLayer.current.remove();
    if (userMarker.current) userMarker.current.remove();
    if (destMarker.current) destMarker.current.remove();

    const originIcon = L.divIcon({ className: 'pf-origin-pin-icon', html: '<div style="width:18px;height:18px;border-radius:50%;background:#22c55e;border:3px solid #fff;box-shadow:0 0 12px rgba(34,197,94,.8)"></div>', iconSize: [18, 18], iconAnchor: [9, 9] });
    const destIcon = L.divIcon({ className: 'pf-dest-pin-icon', html: '<div style="width:18px;height:18px;border-radius:50%;background:#ff5a00;border:3px solid #fff;box-shadow:0 0 12px rgba(255,90,0,.8)"></div>', iconSize: [18, 18], iconAnchor: [9, 9] });
    userMarker.current = L.marker([start.lat, start.lng], { icon: originIcon }).addTo(map.current);
    destMarker.current = L.marker([end.lat, end.lng], { icon: destIcon }).addTo(map.current);

    try {
      const resp = await fetch(`${OSRM}/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`);
      if (resp.ok) {
        const data = await resp.json();
        const route = data.routes?.[0];
        if (route?.geometry) {
          routeLayer.current = L.geoJSON(route.geometry, { style: { color: '#ff5a00', weight: 5.5, opacity: 0.95, lineCap: 'round', lineJoin: 'round' } }).addTo(map.current);
          setDistanceKm(Number((route.distance / 1000).toFixed(1)));
          setDurationMin(Math.max(3, Math.ceil(route.duration / 60)));
          map.current.fitBounds(routeLayer.current.getBounds(), { padding: [80, 80] });
          return;
        }
      }
    } catch (_) {}
    routeLayer.current = L.polyline([[start.lat, start.lng], [end.lat, end.lng]], { color: '#ff5a00', weight: 5, opacity: 0.9 }).addTo(map.current);
    map.current.fitBounds(routeLayer.current.getBounds(), { padding: [80, 80] });
  };

  // ROUTE_SYNC_AFTER_SELECTION
  useEffect(() => {
    if (!map.current || !origin || !destinationCoords) return;
    if (!Number.isFinite(Number(origin.lat)) || !Number.isFinite(Number(origin.lng))) return;
    if (!Number.isFinite(Number(destinationCoords.lat)) || !Number.isFinite(Number(destinationCoords.lng))) return;
    void renderRoute(origin, destinationCoords);
  }, [origin?.lat, origin?.lng, destinationCoords?.lat, destinationCoords?.lng]);

  useEffect(() => {
    if (!token) return undefined;
    let dead = false;
    async function loadActiveRide() {
      try {
        const response = await fetch(`${B}/api/rides/active`, { headers: authHeaders });
        if (!response.ok) return;
        const data = await response.json();
        if (!dead && data?.ride) applyRideState(data.ride);
      } catch (_) {}
    }
    loadActiveRide();
    return () => { dead = true; };
  }, [token]);

  useEffect(() => {
    if (!token || !currentRideId) return undefined;
    let dead = false;
    const refreshRide = async () => {
      try {
        const response = await fetch(`${B}/api/rides/${currentRideId}`, { headers: authHeaders });
        if (!response.ok) return;
        const data = await response.json();
        const nextRide = normalizeRide(data);
        if (dead || !nextRide) return;
        applyRideState(nextRide);
        if (['COMPLETED', 'CANCELLED'].includes(nextRide.status)) {
          clearInterval(pollTimer.current);
          setCurrentRideId(null);
        }
      } catch (_) {}
    };
    refreshRide();
    pollTimer.current = setInterval(refreshRide, 2500);
    return () => { dead = true; clearInterval(pollTimer.current); };
  }, [token, currentRideId]);

  useEffect(() => {
    if (!map.current || !driverLocation || !Number.isFinite(Number(driverLocation.lat)) || !Number.isFinite(Number(driverLocation.lng))) return;
    const loc = { lat: Number(driverLocation.lat), lng: Number(driverLocation.lng) };
    const driverIcon = L.divIcon({ className: 'pf-driver-live-icon', html: '<div style="width:34px;height:34px;border-radius:50%;background:#ff5a00;border:3px solid #fff;box-shadow:0 0 18px rgba(255,90,0,.75);display:grid;place-items:center;font-size:17px">🚗</div>', iconSize: [34, 34], iconAnchor: [17, 17] });
    if (!driverMarker.current) driverMarker.current = L.marker([loc.lat, loc.lng], { icon: driverIcon, zIndexOffset: 1200 }).addTo(map.current);
    else driverMarker.current.setLatLng([loc.lat, loc.lng]);
  }, [driverLocation]);

  useEffect(() => {
    if (!token || !currentRideId || !ride || ride.status !== 'IN_PROGRESS') {
      clearInterval(elapsedTimer.current);
      return undefined;
    }
    const startedAt = Number(ride.startedAt || ride.startTime || ride.acceptedAt || Date.now());
    const sync = () => setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    sync();
    elapsedTimer.current = setInterval(sync, 1000);
    return () => clearInterval(elapsedTimer.current);
  }, [token, currentRideId, ride]);

  useEffect(() => {
    if (!token) return undefined;
    const cleanup = [];
    try {
      const socket = WebSocketService.connect();
      if (socket) {
        const onAccepted = (data) => {
          const nextRide = normalizeRide(data);
          if (!nextRide?.id || (currentRideId && String(nextRide.id) !== String(currentRideId))) return;
          applyRideState(nextRide);
          showToast(`Motorista encontrado${nextRide.driverName ? `: ${nextRide.driverName}` : ''}.`);
        };
        const onStarted = (data) => {
          const nextRide = normalizeRide(data);
          if (!nextRide?.id || (currentRideId && String(nextRide.id) !== String(currentRideId))) return;
          applyRideState({ ...nextRide, status: 'IN_PROGRESS' });
        };
        const onDriverLocation = (data) => {
          if (!data?.driverId && !data?.rideId) return;
          if (data?.rideId && (!currentRideId || String(data.rideId) !== String(currentRideId))) return;
          const loc = data?.location || { lat: data?.lat ?? data?.latitude, lng: data?.lng ?? data?.longitude };
          const lat = Number(loc?.lat ?? loc?.latitude), lng = Number(loc?.lng ?? loc?.longitude);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
          setDriverLocation({ lat, lng });
        };
        const onCancelled = (data) => {
          const nextRide = normalizeRide(data);
          if (!nextRide?.id || (currentRideId && String(nextRide.id) !== String(currentRideId))) return;
          applyRideState({ ...nextRide, status: 'CANCELLED' });
        };
        WebSocketService.onRideAccepted(onAccepted);
        WebSocketService.onDriverLocationUpdate(onDriverLocation);
        WebSocketService.onRideStarted(onStarted);
        WebSocketService.onRideCancelled(onCancelled);
        cleanup.push(() => WebSocketService.off('ride-accepted', onAccepted));
        cleanup.push(() => WebSocketService.off('update-driver-location', onDriverLocation));
        cleanup.push(() => WebSocketService.off('ride-started', onStarted));
        cleanup.push(() => WebSocketService.off('ride-cancelled', onCancelled));
      }
    } catch (_) {}
    return () => cleanup.forEach((fn) => fn());
  }, [token, currentRideId]);

  const handleSearch = (value) => {
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
  };

  const handleSelectDestination = (item) => {
    const lat = parseFloat(item.lat); const lng = parseFloat(item.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const dest = { lat, lng, address: item.display_name };
    setDestination(item.display_name); setDestinationCoords(dest); setSuggestions([]); renderRoute(origin, dest);
  };

  const handleRequestRide = async () => {
    if (rideSubmitRef.current || busy) return;
    if (!token) { setError('Entre na sua conta para solicitar uma corrida.'); return; }
    if (!origin || !Number.isFinite(Number(origin.lat)) || !Number.isFinite(Number(origin.lng))) {
      setError('Aguardando sua localização atual. Permita o acesso à localização do dispositivo.'); return;
    }
    if (!destinationCoords || !Number.isFinite(Number(destinationCoords.lat)) || !Number.isFinite(Number(destinationCoords.lng))) {
      setError('Escolha um destino válido.'); return;
    }
    rideSubmitRef.current = true;
    setBusy(true); setError('');
    try {
      const resp = await fetch(`${B}/api/rides/request`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          origin: { address: origin.address, location: { lat: Number(origin.lat), lng: Number(origin.lng) } },
          destination: { address: destination, location: { lat: Number(destinationCoords.lat), lng: Number(destinationCoords.lng) } },
          price: FIXED_RIDE_PRICE, distance: distanceKm, paymentMethod, passengerCount, promoCode
        })
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data?.ride?.id) throw new Error(data?.error || 'Não foi possível solicitar a corrida.');
      const createdRide = data.ride;
      applyRideState(createdRide);
      if (typeof onRideCreate === 'function') onRideCreate(createdRide);
      try { WebSocketService.joinRideRoom(createdRide.id); } catch (_) {}
      // Keep automatic dispatch alive if the first driver wave does not find an online driver.
      void dispatchRideSearch(createdRide.id, token);
    } catch (requestError) {
      setError(requestError?.message || 'Não foi possível solicitar a corrida.');
    } finally {
      rideSubmitRef.current = false;
      setBusy(false);
    }
  };

  const handleCancelRide = async () => {
    if (!currentRideId) { setStage('plan'); return; }
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`${B}/api/rides/${currentRideId}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...authHeaders }, body: JSON.stringify({ status: 'CANCELLED', cancellationReason: 'Cancelado pelo passageiro' }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || 'Não foi possível cancelar a corrida.');
      clearInterval(pollTimer.current);
      setCurrentRideId(null); setRide(null); setDriver(null); setDriverLocation(null); setStage('plan');
      showToast('Corrida cancelada.');
    } catch (cancelError) {
      setError(cancelError?.message || 'Não foi possível cancelar a corrida.');
    } finally {
      setBusy(false);
    }
  };

  const handleFinishRide = async () => {
    if (isPassenger) {
      setError('A finalização da corrida é feita pelo motorista ao chegar ao destino.');
      return;
    }
    if (!currentRideId) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`${B}/api/rides/${currentRideId}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...authHeaders }, body: JSON.stringify({ status: 'COMPLETED' }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || 'Não foi possível finalizar a corrida.');
      clearInterval(pollTimer.current);
      clearInterval(elapsedTimer.current);
      setCurrentRideId(null);
      setRide(data?.ride || { ...(ride || {}), status: 'COMPLETED' });
      onNavigate?.('payment');
    } catch (finishError) {
      setError(finishError?.message || 'Não foi possível finalizar a corrida.');
    } finally {
      setBusy(false);
    }
  };

  const formatElapsed = (seconds) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  const handleSendMessage = (e) => { e.preventDefault(); if (!chatMessage.trim()) return; setChatMessages((prev) => [...prev, { from: 'me', text: chatMessage.trim(), time: 'agora' }]); setChatMessage(''); };

  return (
    <div className="pf-map-screen">
      <style>{`.pf-map-screen{position:relative;width:100%;height:100vh;overflow:hidden;background:#050505;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#fff}.pf-map-canvas{position:absolute;inset:0;z-index:1}.pf-map-topbar{position:absolute;top:0;left:0;right:0;height:56px;display:flex;align-items:center;justify-content:space-between;padding:0 16px;background:rgba(5,5,5,.85);backdrop-filter:blur(12px);border-bottom:1px solid rgba(255,255,255,.08);z-index:1000}.pf-map-icon-btn{width:40px;height:40px;border-radius:50%;background:#111418;border:1px solid #242a34;color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;position:relative}.pf-map-bell-badge{position:absolute;top:4px;right:4px;background:#ef4444;color:#fff;font-size:10px;font-weight:800;min-width:16px;height:16px;border-radius:8px;display:flex;align-items:center;justify-content:center;padding:0 4px}.pf-map-logo{font-size:19px;font-weight:900;font-style:italic}.pf-map-logo span{color:#fff}.pf-map-logo b{color:#ff5a00}.pf-route-card,.pf-bottom-sheet,.pf-driver-arriving-card,.pf-arriving-sheet,.pf-progress-banner,.pf-progress-sheet{position:absolute;left:16px;right:16px;max-width:480px;margin:0 auto;background:rgba(15,18,22,.96);backdrop-filter:blur(16px);border:1px solid #242a34;border-radius:20px;z-index:1000;box-shadow:0 16px 40px rgba(0,0,0,.6)}.pf-route-card{top:68px;padding:14px 16px}.pf-route-row{display:flex;align-items:center;gap:12px;position:relative}.pf-route-pin{width:12px;height:12px;border-radius:50%;flex-shrink:0}.pf-route-pin.green{background:#22c55e;box-shadow:0 0 0 3px rgba(34,197,94,.25)}.pf-route-pin.orange{background:#ff5a00;box-shadow:0 0 0 3px rgba(255,90,0,.25)}.pf-route-line{width:2px;height:20px;background:#2d3644;margin:2px 0 2px 5px}.pf-route-input-group{flex:1;display:flex;flex-direction:column}.pf-route-label,.pf-sheet-price-label,.pf-stat-box-label{font-size:11px;color:#7e8b9b;font-weight:600;text-transform:uppercase;letter-spacing:.05em}.pf-route-val{background:transparent;border:none;color:#fff;font-size:14px;font-weight:600;outline:none;padding:2px 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pf-route-add-btn{width:28px;height:28px;border-radius:50%;background:#19202a;border:1px solid #333d4e;color:#8e98a5;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:16px}.pf-bottom-sheet,.pf-arriving-sheet,.pf-progress-sheet{bottom:16px;padding:18px}.pf-sheet-top,.pf-driver-left,.pf-arriving-header{display:flex;align-items:center}.pf-sheet-top{justify-content:space-between;margin-bottom:14px}.pf-sheet-car-thumb{width:105px;height:auto;filter:drop-shadow(0 6px 12px rgba(0,0,0,.7));border-radius:8px}.pf-sheet-price-box{text-align:right}.pf-sheet-price-val{font-size:28px;font-weight:900;color:#ff5a00}.pf-sheet-chips{display:flex;gap:8px;margin-bottom:16px;overflow-x:auto;padding-bottom:4px}.pf-chip{display:flex;align-items:center;gap:6px;background:#111418;border:1px solid #242a34;border-radius:999px;padding:8px 14px;color:#d1d5db;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap}.pf-request-btn,.pf-arriving-cancel-btn,.pf-finish-btn{width:100%;border:none;border-radius:999px;color:#fff;font-size:16px;font-weight:800;padding:15px;cursor:pointer}.pf-request-btn,.pf-arriving-cancel-btn{background:#ff5a00;box-shadow:0 8px 24px rgba(255,90,0,.35)}.pf-driver-arriving-card{top:68px;padding:14px 16px;display:flex;align-items:center;justify-content:space-between}.pf-driver-left{gap:12px}.pf-driver-avatar{width:50px;height:50px;border-radius:50%;border:2px solid #ff5a00;object-fit:cover;background:#1c212a}.pf-driver-info-name,.pf-progress-banner .pf-banner-title{font-size:16px;font-weight:800}.pf-driver-info-meta,.pf-driver-info-car,.pf-arriving-sub,.pf-banner-dest{font-size:12px;color:#8e98a5;margin-top:2px}.pf-driver-info-meta span{color:#fbbf24;font-weight:700}.pf-driver-call-btn{width:44px;height:44px;border-radius:50%;background:#ff5a00;color:#fff;border:none;display:flex;align-items:center;justify-content:center;font-size:18px;cursor:pointer}.pf-arriving-header{gap:10px;margin-bottom:12px}.pf-arriving-pin{color:#38bdf8;font-size:18px}.pf-arriving-title{font-size:16px;font-weight:800}.pf-progress-bar{width:100%;height:6px;background:#202733;border-radius:999px;overflow:hidden;margin-bottom:16px}.pf-progress-fill{height:100%;background:#ff5a00;border-radius:999px;box-shadow:0 0 10px rgba(255,90,0,.6)}.pf-arriving-actions{display:grid;grid-template-columns:1fr 1fr;gap:12px}.pf-arriving-msg-btn{background:#111418;border:1px solid #28313e;border-radius:999px;color:#fff;font-size:14px;font-weight:700;padding:13px;cursor:pointer}.pf-progress-banner{top:68px;padding:14px 16px;display:flex;align-items:center;gap:12px}.pf-banner-pin{width:36px;height:36px;border-radius:50%;background:rgba(255,90,0,.15);color:#ff5a00;display:flex;align-items:center;justify-content:center;font-size:18px}.pf-stats-cols{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;text-align:center;padding-bottom:14px;border-bottom:1px solid #1e2530;margin-bottom:14px}.pf-stat-box-val{font-size:18px;font-weight:800;color:#fff}.pf-stat-box-val.orange{color:#ff5a00}.pf-pay-indicator-row{display:flex;align-items:center;gap:8px;font-size:13px;color:#a4b0bf;margin-bottom:16px}.pf-finish-btn{background:#dc2626;box-shadow:0 8px 24px rgba(220,38,38,.35)}.pf-suggest-dropdown{position:absolute;top:100%;left:0;right:0;background:#0f1216;border:1px solid #242a34;border-radius:14px;margin-top:8px;max-height:220px;overflow-y:auto;box-shadow:0 12px 32px rgba(0,0,0,.8);z-index:2000}.pf-suggest-item{display:block;width:100%;padding:12px 14px;background:transparent;border:none;border-bottom:1px solid #1a2029;color:#fff;text-align:left;cursor:pointer;font-size:13px}.pf-modal-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.75);backdrop-filter:blur(4px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px}.pf-modal-card{width:100%;max-width:380px;background:#111418;border:1px solid #28313e;border-radius:20px;padding:20px}`}</style>
      <div className="pf-map-canvas" ref={mapEl} />
      <header className="pf-map-topbar"><button type="button" className="pf-map-icon-btn" onClick={() => (stage === 'plan' ? onOpenMenu?.() : setStage('plan'))}>{stage === 'plan' ? '☰' : '‹'}</button><div className="pf-map-logo"><span>PREÇO </span><b>FIXO 17</b></div><button type="button" className="pf-map-icon-btn" onClick={() => onOpenNotifications?.()}>🔔<span className="pf-map-bell-badge">3</span></button></header>
      {error && <div style={{ position:'absolute', top:68,left:16,right:16,zIndex:5000,background:'#291111',border:'1px solid #ef4444',color:'#fff',padding:'10px 14px',borderRadius:14,textAlign:'center',fontSize:13 }}>{error}</div>}
      {toastMessage && <div style={{ position:'absolute',top:68,left:'50%',transform:'translateX(-50%)',zIndex:5000,background:'#151921',border:'1px solid #ff5a00',color:'#fff',padding:'8px 18px',borderRadius:20,fontSize:13,fontWeight:700,whiteSpace:'nowrap' }}>ℹ️ {toastMessage}</div>}

      {stage === 'plan' && <><div className="pf-route-card"><div className="pf-route-row"><div className="pf-route-pin green"/><div className="pf-route-input-group"><span className="pf-route-label">Seu local atual</span><input className="pf-route-val" value={origin?.address || 'Obtendo localização atual...'} readOnly/></div></div><div className="pf-route-line"/><div className="pf-route-row"><div className="pf-route-pin orange"/><div className="pf-route-input-group"><span className="pf-route-label">Para onde?</span><input className="pf-route-val" placeholder="Para onde você vai?" value={destination} onChange={(e)=>handleSearch(e.target.value)}/></div><button type="button" className="pf-route-add-btn" onClick={()=>showToast('Parada intermediária adicionada à rota.')}>+</button>{suggestions.length>0&&<div className="pf-suggest-dropdown">{suggestions.map((item,i)=><button key={i} type="button" className="pf-suggest-item" onClick={()=>handleSelectDestination(item)}>{item.display_name}</button>)}</div>}</div></div><div className="pf-bottom-sheet"><div className="pf-sheet-top"><img src={precoFixo17Car} alt="Carro PreçoFixo17" className="pf-sheet-car-thumb"/><div className="pf-sheet-price-box"><div className="pf-sheet-price-label">Preço fixo da corrida</div><div className="pf-sheet-price-val">R$ 17,00</div></div></div><div className="pf-sheet-chips"><button type="button" className="pf-chip" onClick={()=>setModalType('payment')}>💳 <span>Pagamento: {paymentMethod}</span></button><button type="button" className="pf-chip" onClick={()=>setModalType('promo')}>🏷️ <span>Promoção: {promoCode}</span></button><button type="button" className="pf-chip" onClick={()=>setModalType('passengers')}>👤 <span>Passageiros: {passengerCount}</span></button></div><div style={{fontSize:12,color:'#8e98a5',marginBottom:10}}>{searching?'Buscando endereço…':`${distanceKm} km • aproximadamente ${durationMin} min`}</div><button type="button" className="pf-request-btn" disabled={busy} onClick={handleRequestRide}>{busy?'Solicitando corrida…':'Solicitar corrida'}</button></div></>}

      {stage === 'arriving' && <><div className="pf-driver-arriving-card"><div className="pf-driver-left">{driver?.profilePhoto||driver?.photo?<img src={driver.profilePhoto||driver.photo} alt={driver.name||driver.fullName||'Motorista'} className="pf-driver-avatar"/>:<div className="pf-driver-avatar" style={{display:'grid',placeItems:'center',fontWeight:900}}>🚗</div>}<div><div className="pf-driver-info-name">{driver?.name||driver?.fullName||ride?.driverName||'Procurando motorista'}</div><div className="pf-driver-info-meta"><span>★ {Number(driver?.ratingAverage??driver?.rating??0).toFixed(1)}</span>{driver&&` (${Number(driver.ratingCount||0)} avaliações)`}</div><div className="pf-driver-info-car">{driver?.vehicle?.model||ride?.vehicleModel||'Motorista parceiro'}</div></div></div><button type="button" className="pf-driver-call-btn" onClick={()=>showToast('A ligação será iniciada pelo telefone cadastrado do motorista.')}>📞</button></div><div className="pf-arriving-sheet"><div className="pf-arriving-header"><span className="pf-arriving-pin">📍</span><div><div className="pf-arriving-title">{ride?.status==='ACCEPTED'?'Motorista chegando':'Procurando motorista'}</div><div className="pf-arriving-sub">{ride?.status==='ACCEPTED'?`Chegando em ${etaMinutes} minutos`:'Encontrando o motorista mais próximo…'}</div></div></div><div className="pf-progress-bar"><div className="pf-progress-fill" style={{width:ride?.status==='ACCEPTED'?'70%':'38%'}}/></div><div className="pf-arriving-actions"><button type="button" className="pf-arriving-msg-btn" onClick={()=>setModalType('message')}>Mensagem</button><button type="button" className="pf-arriving-cancel-btn" disabled={busy} onClick={handleCancelRide}>Cancelar</button></div></div></>}

      {stage === 'in_progress' && <><div className="pf-progress-banner"><div className="pf-banner-pin">📍</div><div style={{minWidth:0}}><div className="pf-banner-title">Corrida em andamento</div><div className="pf-banner-dest">Destino: {destination}</div></div></div><div className="pf-progress-sheet"><div className="pf-stats-cols"><div><div className="pf-stat-box-label">Tempo</div><div className="pf-stat-box-val">{formatElapsed(elapsedSeconds)}</div></div><div><div className="pf-stat-box-label">Distância</div><div className="pf-stat-box-val">{distanceKm} km</div></div><div><div className="pf-stat-box-label">Preço fixo</div><div className="pf-stat-box-val orange">R$ 17,00</div></div></div><div className="pf-pay-indicator-row"><span>💳</span><span>Pagamento: {paymentMethod}</span></div><button type="button" className="pf-finish-btn" disabled={busy || isPassenger} onClick={handleFinishRide}>{busy?'Finalizando…':isPassenger?'Aguardando motorista finalizar':'Finalizar corrida'}</button></div></>}

      {modalType === 'payment' && <div className="pf-modal-backdrop" onClick={()=>setModalType(null)}><div className="pf-modal-card" onClick={(e)=>e.stopPropagation()}><h3 style={{margin:'0 0 14px'}}>Forma de Pagamento</h3>{['Dinheiro','Cartão de Crédito','PIX'].map((method)=><button key={method} type="button" className="pf-chip" style={{width:'100%',marginBottom:8,justifyContent:'space-between'}} onClick={()=>{setPaymentMethod(method);setModalType(null)}}><span>{method}</span>{paymentMethod===method&&<span style={{color:'#ff5a00'}}>✓</span>}</button>)}</div></div>}
      {modalType === 'promo' && <div className="pf-modal-backdrop" onClick={()=>setModalType(null)}><div className="pf-modal-card" onClick={(e)=>e.stopPropagation()}><h3 style={{margin:'0 0 14px'}}>Cupom ou Promoção</h3><input type="text" placeholder="Digite seu cupom" className="pf-input-field" style={{background:'#1c212a',border:'1px solid #333d4e',borderRadius:10,padding:12,marginBottom:12}} onKeyDown={(e)=>{if(e.key==='Enter'){setPromoCode(e.currentTarget.value||'Nenhuma');setModalType(null)}}}/><button type="button" className="pf-btn-orange" onClick={()=>{setPromoCode('FIXO17VIP');setModalType(null)}}>Aplicar cupom FIXO17VIP</button></div></div>}
      {modalType === 'passengers' && <div className="pf-modal-backdrop" onClick={()=>setModalType(null)}><div className="pf-modal-card" onClick={(e)=>e.stopPropagation()}><h3 style={{margin:'0 0 14px'}}>Quantidade de Passageiros</h3><div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8}}>{[1,2,3,4].map((num)=><button key={num} type="button" className="pf-chip" style={{justifyContent:'center',background:passengerCount===num?'#ff5a00':'#111418',color:'#fff'}} onClick={()=>{setPassengerCount(num);setModalType(null)}}>{num}</button>)}</div></div></div>}
      {modalType === 'message' && <div className="pf-modal-backdrop" onClick={()=>setModalType(null)}><div className="pf-modal-card" style={{maxWidth:420}} onClick={(e)=>e.stopPropagation()}><div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}><h3 style={{margin:0}}>Mensagens com o motorista</h3><button type="button" style={{background:'none',border:'none',color:'#8e98a5',fontSize:18,cursor:'pointer'}} onClick={()=>setModalType(null)}>✕</button></div><div style={{height:200,overflowY:'auto',display:'flex',flexDirection:'column',gap:8,padding:8,background:'#0a0d11',borderRadius:12,marginBottom:12}}>{chatMessages.map((m,i)=><div key={i} style={{alignSelf:m.from==='me'?'flex-end':'flex-start',background:m.from==='me'?'#ff5a00':'#1c212a',color:'#fff',padding:'8px 12px',borderRadius:12,fontSize:13,maxWidth:'80%'}}>{m.text}</div>)}</div><form onSubmit={handleSendMessage} style={{display:'flex',gap:8}}><input type="text" placeholder="Enviar mensagem…" value={chatMessage} onChange={(e)=>setChatMessage(e.target.value)} style={{flex:1,background:'#1c212a',border:'1px solid #333d4e',borderRadius:999,padding:'10px 16px',color:'#fff',outline:'none'}}/><button type="submit" style={{background:'#ff5a00',border:'none',borderRadius:'50%',width:40,height:40,color:'#fff',cursor:'pointer'}}>➤</button></form></div></div>}
    </div>
  );
}
