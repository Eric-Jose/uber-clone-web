import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import WebSocketService from '../services/WebSocketService';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';
const box = { background: '#fff', borderRadius: 16, boxShadow: '0 4px 18px rgba(0,0,0,.16)' };
const DEFAULT_CENTER = [-24.5345, -55.7221];
const NOMINATIM = 'https://nominatim.openstreetmap.org';
const OSRM = 'https://router.project-osrm.org/route/v1/driving';

const userIcon = L.divIcon({ className: '', html: '<div style="width:16px;height:16px;border-radius:50%;background:#1a73e8;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35)"></div>', iconSize: [22,22], iconAnchor: [11,11] });
const driverIcon = L.divIcon({ className: '', html: '<div style="width:20px;height:20px;border-radius:50%;background:#111;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35)"></div>', iconSize: [26,26], iconAnchor: [13,13] });
const isBrazilCoordinate = (lat, lng) => lat >= -34.0 && lat <= 6.0 && lng >= -74.5 && lng <= -34.0;

export default function MapRideFixed({ onRideCreate, onBack }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const userMarkerRef = useRef(null);
  const driverMarkerRef = useRef(null);
  const accuracyCircleRef = useRef(null);
  const routeLayerRef = useRef(null);
  const searchTimerRef = useRef(null);
  const watchIdRef = useRef(null);
  const locationInitializedRef = useRef(false);
  const requestIdRef = useRef(0);
  const reverseGeocodeTimerRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState('');
  const [origin, setOrigin] = useState(null);
  const [originText, setOriginText] = useState('Obtendo localização…');
  const [locationAccuracy, setLocationAccuracy] = useState(null);
  const [destination, setDestination] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [route, setRoute] = useState(null);
  const [ride, setRide] = useState(null);
  const [driverLocation, setDriverLocation] = useState(null);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [ratingMessage, setRatingMessage] = useState('');
  const [rated, setRated] = useState(false);

  useEffect(() => {
    let alive = true;
    const map = L.map(mapRef.current, { zoomControl: false, attributionControl: true, preferCanvas: true }).setView(DEFAULT_CENTER, 14);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(map);
    mapInstanceRef.current = map;
    setMapReady(true);

    const reverseGeocode = async (lat, lng) => {
      clearTimeout(reverseGeocodeTimerRef.current);
      reverseGeocodeTimerRef.current = setTimeout(async () => {
        try {
          const res = await fetch(`${NOMINATIM}/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&zoom=18&addressdetails=1`, { headers: { Accept: 'application/json' } });
          const data = await res.json();
          if (!alive) return;
          const address = data?.address || {};
          const city = address.city || address.town || address.village || address.municipality || '';
          const state = address.state || '';
          const countryCode = String(address.country_code || '').toLowerCase();
          if (countryCode && countryCode !== 'br') { setMapError('O dispositivo informou uma localização fora do Brasil. Ative o GPS/localização precisa.'); return; }
          setOriginText(city ? `${city}${state ? ' - ' + state : ''}` : (data?.display_name || 'Minha localização atual'));
          setMapError('');
        } catch (_) { if (alive) setOriginText('Minha localização atual'); }
      }, 250);
    };

    const updateLocation = position => {
      if (!alive) return;
      const lat = Number(position?.coords?.latitude); const lng = Number(position?.coords?.longitude); const accuracy = Number(position?.coords?.accuracy);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || !isBrazilCoordinate(lat, lng)) { if (!locationInitializedRef.current) setMapError('A localização recebida do celular não é válida para o Brasil.'); return; }
      if (Number.isFinite(accuracy) && accuracy > 15000) { if (!locationInitializedRef.current) setMapError('Aguardando uma localização GPS mais precisa do celular…'); return; }
      const loc = { lat, lng }; locationInitializedRef.current = true; setOrigin(loc); setLocationAccuracy(Number.isFinite(accuracy) ? Math.round(accuracy) : null);
      const shouldCenter = !userMarkerRef.current || !map.getBounds().pad(-0.7).contains([lat, lng]);
      if (shouldCenter) map.setView([lat, lng], Number.isFinite(accuracy) && accuracy <= 30 ? 18 : 17);
      if (userMarkerRef.current) userMarkerRef.current.setLatLng([lat, lng]); else userMarkerRef.current = L.marker([lat, lng], { icon: userIcon, title: 'Sua localização atual' }).addTo(map);
      if (accuracyCircleRef.current) accuracyCircleRef.current.setLatLng([lat, lng]).setRadius(Number.isFinite(accuracy) ? Math.min(accuracy, 500) : 50); else accuracyCircleRef.current = L.circle([lat, lng], { radius: Number.isFinite(accuracy) ? Math.min(accuracy, 500) : 50, color: '#1a73e8', weight: 1, opacity: 0.25, fillOpacity: 0.08 }).addTo(map);
      reverseGeocode(lat, lng);
    };

    const locationError = err => {
      if (!alive) return;
      if (!locationInitializedRef.current) setMapError(err?.code === 1 ? 'Permita a localização precisa deste site no celular para usar sua posição atual.' : 'Não foi possível obter o GPS do celular.');
    };

    const requestDeviceLocation = () => {
      if (!navigator.geolocation) { setMapError('Este navegador não oferece geolocalização.'); return; }
      setMapError('Obtendo localização precisa do dispositivo…');
      navigator.geolocation.getCurrentPosition(updateLocation, locationError, { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 });
    };

    if (navigator.geolocation) { requestDeviceLocation(); watchIdRef.current = navigator.geolocation.watchPosition(updateLocation, locationError, { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 }); } else setMapError('Este navegador não oferece geolocalização.');
    const resize = () => map.invalidateSize(); window.addEventListener('resize', resize); setTimeout(resize, 100);
    return () => { alive = false; window.removeEventListener('resize', resize); clearTimeout(searchTimerRef.current); clearTimeout(reverseGeocodeTimerRef.current); if (watchIdRef.current !== null && navigator.geolocation) navigator.geolocation.clearWatch(watchIdRef.current); WebSocketService.disconnect(); map.remove(); mapInstanceRef.current = null; };
  }, []);

  useEffect(() => {
    if (!mapInstanceRef.current || !driverLocation) return;
    const map = mapInstanceRef.current;
    if (!driverMarkerRef.current) driverMarkerRef.current = L.marker([driverLocation.lat, driverLocation.lng], { icon: driverIcon, title: 'Motorista', zIndexOffset: 1000 }).addTo(map); else driverMarkerRef.current.setLatLng([driverLocation.lat, driverLocation.lng]);
  }, [driverLocation]);

  useEffect(() => {
    const accepted = data => { if (ride?.id && data?.rideId === ride.id) setRide(r => ({ ...(r || {}), ...data, status: 'ACCEPTED' })); };
    const location = data => { if (ride?.id && data?.rideId && data.rideId !== ride.id) return; const lat = Number(data?.latitude ?? data?.lat), lng = Number(data?.longitude ?? data?.lng); if (Number.isFinite(lat) && Number.isFinite(lng)) setDriverLocation({ lat, lng }); };
    const started = data => { if (data?.rideId === ride?.id) setRide(r => ({ ...(r || {}), status: 'IN_PROGRESS' })); };
    const ended = data => { if (data?.rideId === ride?.id) setRide(r => ({ ...(r || {}), status: 'COMPLETED' })); };
    const cancelled = data => { if (data?.rideId === ride?.id) setRide(r => ({ ...(r || {}), status: 'CANCELLED' })); };
    WebSocketService.onRideAccepted(accepted); WebSocketService.onDriverLocationUpdate(location); WebSocketService.onRideStarted(started); WebSocketService.onRideEnded(ended); WebSocketService.onRideCancelled(cancelled);
    return () => { WebSocketService.off('ride-accepted', accepted); WebSocketService.off('update-driver-location', location); WebSocketService.off('ride-started', started); WebSocketService.off('ride-ended', ended); WebSocketService.off('ride-cancelled', cancelled); };
  }, [ride?.id]);

  const searchPlaces = value => {
    setDestination(value); setRoute(null); setMapError(''); clearTimeout(searchTimerRef.current);
    if (value.trim().length < 3) { setSuggestions([]); setSearching(false); return; }
    setSearching(true); const searchId = ++requestIdRef.current;
    searchTimerRef.current = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ format: 'jsonv2', q: value.trim(), limit: '6', countrycodes: 'br', addressdetails: '1', 'accept-language': 'pt-BR' });
        const res = await fetch(`${NOMINATIM}/search?${params.toString()}`, { headers: { Accept: 'application/json' } }); const data = await res.json();
        if (searchId !== requestIdRef.current) return; setSuggestions(Array.isArray(data) ? data : []);
      } catch (_) { if (searchId === requestIdRef.current) setMapError('Não foi possível pesquisar o endereço agora.'); }
      finally { if (searchId === requestIdRef.current) setSearching(false); }
    }, 450);
  };

  const calculateRoute = async selected => {
    if (!origin) { setMapError('Aguardando sua localização atual. Ative a localização precisa do dispositivo e tente novamente.'); return; }
    const lat = Number(selected?.lat), lon = Number(selected?.lon); if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    setSuggestions([]); setDestination(selected.display_name || destination); setLoadingRoute(true); setMapError('');
    try {
      const res = await fetch(`${OSRM}/${origin.lng},${origin.lat};${lon},${lat}?overview=full&geometries=geojson&steps=false`); const data = await res.json(); const r = data?.routes?.[0];
      if (!res.ok || !r) throw new Error('ROUTE_NOT_FOUND');
      if (routeLayerRef.current) routeLayerRef.current.remove();
      const coords = r.geometry.coordinates.map(([lng, lat2]) => [lat2, lng]); routeLayerRef.current = L.polyline(coords, { color: '#111', weight: 6, opacity: 0.9, lineCap: 'round', lineJoin: 'round' }).addTo(mapInstanceRef.current);
      mapInstanceRef.current.fitBounds(routeLayerRef.current.getBounds(), { paddingTopLeft: [30, 100], paddingBottomRight: [30, 280] });
      const km = Number(r.distance || 0) / 1000; const minutes = Math.max(1, Math.ceil(Number(r.duration || 0) / 60)); const destinationLocation = { lat, lng: lon };
      setRoute({ distance: km.toFixed(2), duration: minutes, price: (km * 5 + 10).toFixed(2), origin: originText, destination: selected.display_name || destination, originLocation: origin, destinationLocation });
    } catch (e) { console.error('OSRM:', e); setRoute(null); setMapError('Não foi possível calcular a rota para esse destino. Escolha outro endereço da lista.'); }
    finally { setLoadingRoute(false); }
  };

  const searchAndRoute = async () => {
    if (destination.trim().length < 3) return; setSearching(true);
    try {
      const params = new URLSearchParams({ format: 'jsonv2', q: destination.trim(), limit: '1', countrycodes: 'br', addressdetails: '1', 'accept-language': 'pt-BR' }); const res = await fetch(`${NOMINATIM}/search?${params.toString()}`); const data = await res.json();
      if (data?.[0]) await calculateRoute(data[0]); else setMapError('Endereço não encontrado. Tente informar rua, número, cidade ou bairro.');
    } catch (_) { setMapError('Não foi possível pesquisar o endereço agora.'); } finally { setSearching(false); }
  };

  const requestRide = async () => {
    if (!route || requesting) return; const token = localStorage.getItem('token'); if (!token) return alert('Faça login novamente.'); setRequesting(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/rides/request`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ origin: { address: route.origin, location: route.originLocation }, destination: { address: route.destination, location: route.destinationLocation }, distance: Number(route.distance), price: Number(route.price) }) });
      const data = await res.json();
      if (!res.ok) {
        const diagnostic = [data.error, data.step ? `etapa: ${data.step}` : '', data.code ? `código: ${data.code}` : '', data.details ? `detalhe: ${data.details}` : ''].filter(Boolean).join(' | ');
        throw new Error(diagnostic || `Erro ${res.status} ao criar corrida.`);
      }
      setRide(data.ride); WebSocketService.connect(); WebSocketService.joinRideRoom(data.ride.id); WebSocketService.requestRide({ rideId: data.ride.id }); onRideCreate?.(data.ride);
    } catch (e) {
      console.error('Criar corrida:', e);
      alert(e.message || 'Erro ao solicitar corrida.');
    } finally { setRequesting(false); }
  };

  const cancelRide = async () => {
    if (!ride?.id || cancelling || ['COMPLETED', 'CANCELLED'].includes(ride.status)) return; if (!window.confirm('Deseja cancelar esta corrida?')) return;
    const token = localStorage.getItem('token'); if (!token) return alert('Faça login novamente.'); setCancelling(true);
    try { const res = await fetch(`${BACKEND_URL}/api/rides/${ride.id}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ status: 'CANCELLED', cancellationReason: 'Cancelada pelo passageiro' }) }); const data = await res.json(); if (!res.ok) throw new Error(data.error || 'Não foi possível cancelar.'); setRide(data.ride); WebSocketService.cancelRide(ride.id); }
    catch (e) { alert(e.message); } finally { setCancelling(false); }
  };

  const submitRating = async () => {
    if (!ride?.id || rated || !rating) return; const token = localStorage.getItem('token'); if (!token) return setRatingMessage('Faça login novamente.');
    try { const res = await fetch(`${BACKEND_URL}/api/ratings`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ rideId: ride.id, rating, comment }) }); const data = await res.json(); if (!res.ok) throw new Error(data.error || 'Não foi possível avaliar.'); setRated(true); setRatingMessage('Obrigado pela avaliação! ⭐'); }
    catch (e) { setRatingMessage(e.message); }
  };

  const refreshLocation = () => {
    if (!navigator.geolocation) return setMapError('Este navegador não oferece geolocalização.'); setMapError('Obtendo localização precisa do dispositivo…');
    navigator.geolocation.getCurrentPosition(position => {
      const lat = Number(position?.coords?.latitude), lng = Number(position?.coords?.longitude), accuracy = Number(position?.coords?.accuracy);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || !isBrazilCoordinate(lat, lng)) return setMapError('O celular retornou uma localização fora do Brasil. Verifique o GPS.');
      if (Number.isFinite(accuracy) && accuracy > 15000) return setMapError('A localização ainda está pouco precisa. Ative o GPS e tente novamente.');
      setOrigin({ lat, lng }); setLocationAccuracy(Number.isFinite(accuracy) ? Math.round(accuracy) : null); const map = mapInstanceRef.current;
      if (map) { map.setView([lat, lng], Number.isFinite(accuracy) && accuracy <= 30 ? 18 : 17); if (userMarkerRef.current) userMarkerRef.current.setLatLng([lat, lng]); else userMarkerRef.current = L.marker([lat, lng], { icon: userIcon, title: 'Sua localização atual' }).addTo(map); if (accuracyCircleRef.current) accuracyCircleRef.current.setLatLng([lat, lng]).setRadius(Number.isFinite(accuracy) ? Math.min(accuracy, 500) : 50); else accuracyCircleRef.current = L.circle([lat, lng], { radius: Number.isFinite(accuracy) ? Math.min(accuracy, 500) : 50, color: '#1a73e8', weight: 1, opacity: 0.25, fillOpacity: 0.08 }).addTo(map); }
      setMapError('');
    }, error => setMapError(error?.code === 1 ? 'Permita a localização precisa deste site no celular.' : 'Não foi possível atualizar a localização do celular.'), { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 });
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#eee', overflow: 'hidden', fontFamily: 'Arial, sans-serif' }}>
      <div ref={mapRef} style={{ position: 'absolute', inset: 0, zIndex: 0 }} />
      {!mapReady && <div style={{ ...box, position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', padding: 20, zIndex: 30 }}>Carregando mapa...</div>}
      {mapError && <div style={{ ...box, position: 'absolute', top: 70, left: 16, right: 16, padding: 14, zIndex: 40, color: '#b00020', fontSize: 14 }}><b>Localização:</b> {mapError}</div>}
      <div style={{ position: 'absolute', top: 16, left: 16, right: 16, zIndex: 20, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        {onBack && <button onClick={onBack} style={{ ...box, width: 48, height: 48, border: 0, fontSize: 24, cursor: 'pointer' }}>←</button>}
        <div style={{ ...box, flex: 1, padding: '8px 14px', position: 'relative' }}>
          <div style={{ fontSize: 11, color: '#777', marginBottom: 3 }}>LOCAL DE PARTIDA</div>
          <div style={{ fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>● {originText}{locationAccuracy ? ` • ±${locationAccuracy} m` : ''}</div>
          <div style={{ borderTop: '1px solid #eee', margin: '8px 0' }} />
          <div style={{ fontSize: 11, color: '#777', marginBottom: 3 }}>PARA ONDE?</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input value={destination} onChange={e => searchPlaces(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); searchAndRoute(); } }} placeholder="Digite rua, número, bairro ou local" autoComplete="off" style={{ flex: 1, border: 0, outline: 0, fontSize: 16, padding: '4px 0', boxSizing: 'border-box', minWidth: 0 }} />
            <button onClick={searchAndRoute} disabled={searching || destination.trim().length < 3} style={{ border: 0, borderRadius: 10, background: '#111', color: '#fff', padding: '9px 12px', cursor: 'pointer', opacity: searching ? .6 : 1 }}>{searching ? '...' : 'Ir'}</button>
          </div>
          {suggestions.length > 0 && <div style={{ position: 'absolute', left: 0, right: 0, top: '100%', marginTop: 6, ...box, borderRadius: 12, overflow: 'hidden', zIndex: 100 }}>{suggestions.map((s, i) => <button key={`${s.place_id || s.osm_id}-${i}`} onClick={() => calculateRoute(s)} style={{ width: '100%', textAlign: 'left', background: '#fff', border: 0, borderBottom: i === suggestions.length - 1 ? 0 : '1px solid #eee', padding: '12px 14px', cursor: 'pointer' }}><div style={{ fontWeight: 600, fontSize: 14 }}>{s.name || s.display_name?.split(',')[0]}</div><div style={{ color: '#666', fontSize: 12, marginTop: 3 }}>{s.display_name}</div></button>)}</div>}
        </div>
      </div>
      <button onClick={() => origin && mapInstanceRef.current?.setView([origin.lat, origin.lng], 17)} style={{ ...box, position: 'absolute', right: 16, bottom: route ? 290 : 78, zIndex: 20, width: 48, height: 48, border: 0, fontSize: 22, cursor: 'pointer' }}>⌖</button>
      <button onClick={refreshLocation} style={{ ...box, position: 'absolute', right: 16, bottom: 20, zIndex: 20, padding: '12px 14px', border: 0, fontWeight: 700, cursor: 'pointer' }}>Atualizar localização</button>
      {loadingRoute && <div style={{ ...box, position: 'absolute', left: 16, right: 16, bottom: 24, zIndex: 30, padding: 18, textAlign: 'center' }}>Calculando rota...</div>}
      {route && !ride && !loadingRoute && <div style={{ ...box, position: 'absolute', left: 12, right: 12, bottom: 12, zIndex: 20, padding: 18 }}><div style={{ fontSize: 13, color: '#666' }}>{route.distance} km • {route.duration} min</div><div style={{ fontSize: 28, fontWeight: 700, margin: '4px 0 12px' }}>R$ {route.price}</div><button onClick={requestRide} disabled={requesting} style={{ width: '100%', height: 50, border: 0, borderRadius: 12, background: '#111', color: '#fff', fontSize: 16, fontWeight: 700 }}>{requesting ? 'Solicitando...' : 'Solicitar corrida'}</button></div>}
      {ride && <div style={{ ...box, position: 'absolute', left: 12, right: 12, bottom: 12, zIndex: 20, padding: 18 }}><div style={{ fontSize: 13, color: '#666' }}>Status da corrida</div><div style={{ fontSize: 20, fontWeight: 700, margin: '4px 0 10px' }}>{ride.status === 'ACCEPTED' ? 'Motorista encontrado 🚗' : ride.status === 'IN_PROGRESS' ? 'Corrida em andamento' : ride.status === 'COMPLETED' ? 'Corrida concluída' : ride.status === 'CANCELLED' ? 'Corrida cancelada' : 'Procurando motorista...'}</div>{ride.status !== 'COMPLETED' && ride.status !== 'CANCELLED' && <button onClick={cancelRide} disabled={cancelling} style={{ width: '100%', height: 46, border: 0, borderRadius: 12, background: '#eee', color: '#111', fontSize: 15, fontWeight: 700 }}>{cancelling ? 'Cancelando...' : 'Cancelar corrida'}</button>}{ride.status === 'COMPLETED' && !rated && <div><div style={{ fontWeight: 700, marginBottom: 8 }}>Avalie o motorista</div><div style={{ fontSize: 28, letterSpacing: 3, marginBottom: 8 }}>{[1,2,3,4,5].map(n => <button key={n} onClick={() => setRating(n)} style={{ border: 0, background: 'transparent', cursor: 'pointer', fontSize: 26, opacity: n <= rating ? 1 : .3 }}>★</button>)}</div><textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Comentário (opcional)" style={{ width: '100%', minHeight: 60, border: '1px solid #ddd', borderRadius: 10, padding: 10, boxSizing: 'border-box', resize: 'vertical' }} /><button onClick={submitRating} disabled={!rating} style={{ width: '100%', height: 46, marginTop: 8, border: 0, borderRadius: 12, background: '#111', color: '#fff', fontWeight: 700 }}>Enviar avaliação</button></div>}{rated && <div style={{ marginTop: 8, fontWeight: 600 }}>Obrigado pela avaliação! ⭐</div>}{ratingMessage && <div style={{ marginTop: 8, fontSize: 13 }}>{ratingMessage}</div>}</div>}
    </div>
  );
}
