import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import WebSocketService from '../services/WebSocketService';
import { BACKEND_URL } from '../config';

const NOMINATIM = 'https://nominatim.openstreetmap.org';
const PHOTON = 'https://photon.komoot.io/api/';
const OSRM = 'https://router.project-osrm.org/route/v1/driving';
const ACTIVE = ['SEARCHING', 'ACCEPTED', 'IN_PROGRESS'];

function getLocation(value) {
  if (!value) return null;
  const source = value.location || value.currentLocation || value;
  const lat = Number(source.lat !== undefined ? source.lat : source.latitude);
  const lng = Number(source.lng !== undefined ? source.lng : source.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function getError(response, data, fallback) {
  if (data && (data.error || data.details || data.message)) return data.error || data.details || data.message;
  if (!response) return 'Não foi possível conectar ao servidor.';
  return fallback;
}

function Avatar(props) {
  const name = props.name || 'Motorista';
  return <div className="map-avatar">{props.photo ? <img src={props.photo} alt={name} /> : name.trim().charAt(0).toUpperCase()}</div>;
}

export default function MapRidePro(props) {
  const mapElement = useRef(null);
  const mapRef = useRef(null);
  const userMarker = useRef(null);
  const driverMarker = useRef(null);
  const routeLayer = useRef(null);
  const timerRef = useRef(null);
  const searchSeq = useRef(0);
  const rideRef = useRef(null);
  const [origin, setOrigin] = useState(null);
  const [originText, setOriginText] = useState('Obtendo localização…');
  const [destination, setDestination] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [trip, setTrip] = useState(null);
  const [ride, setRide] = useState(null);
  const [driverLoc, setDriverLoc] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [restoring, setRestoring] = useState(true);

  useEffect(function () { rideRef.current = ride; }, [ride]);

  useEffect(function () {
    const style = document.createElement('style');
    style.textContent = '.map-ride{min-height:100vh;font-family:Arial,sans-serif;background:#eef1f4;position:relative}.map-full{position:absolute;inset:0}.map-panel{position:absolute;z-index:1001;top:12px;left:12px;right:12px;max-width:560px;margin:auto}.map-card{background:#fff;border-radius:18px;box-shadow:0 7px 25px rgba(0,0,0,.2);padding:16px}.map-row{display:flex;justify-content:space-between;gap:10px;align-items:center}.map-input{width:100%;box-sizing:border-box;padding:14px;border:1px solid #ddd;border-radius:14px;font-size:16px}.map-suggest{margin-top:8px;max-height:260px;overflow:auto;border:1px solid #eee;border-radius:12px}.map-suggest button{display:block;width:100%;padding:12px;border:0;border-bottom:1px solid #eee;background:#fff;text-align:left;cursor:pointer}.map-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.map-info{background:#f5f6f7;border-radius:12px;padding:11px}.map-info b{display:block;color:#6b7280;font-size:12px;margin-bottom:4px}.map-btn{border:0;border-radius:13px;padding:14px 15px;font-weight:800;cursor:pointer;width:100%}.map-primary{background:#111;color:#fff}.map-light{background:#eef0f2;color:#111}.map-danger{background:#d92d20;color:#fff}.map-btn:disabled{opacity:.55;cursor:not-allowed}.map-error{margin-top:9px;background:#fff0f0;color:#9b1c1c;padding:10px;border-radius:10px}.map-ok{margin-top:9px;background:#effaf2;color:#166534;padding:10px;border-radius:10px}.map-muted{color:#68707a;font-size:13px;line-height:1.4}.map-status{display:flex;gap:10px;align-items:center}.map-avatar{width:54px;height:54px;border-radius:50%;background:#111;color:#fff;display:flex;align-items:center;justify-content:center;overflow:hidden;font-weight:800}.map-avatar img{width:100%;height:100%;object-fit:cover}.map-actions{display:flex;gap:10px;margin-top:12px}.map-actions>*{flex:1}.map-bar{height:7px;background:#eceff2;border-radius:9px;overflow:hidden}.map-bar i{display:block;height:100%;background:#111}@media(max-width:640px){.map-panel{top:8px;left:8px;right:8px}.map-grid{grid-template-columns:1fr}.map-card{padding:14px}}';
    document.head.appendChild(style);
    const map = L.map(mapElement.current, { zoomControl: false }).setView([-23.55, -46.63], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(map);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    mapRef.current = map;
    setTimeout(function () { map.invalidateSize(); }, 200);
    return function () { clearTimeout(timerRef.current); WebSocketService.disconnect(); map.remove(); style.remove(); };
  }, []);

  async function syncActiveRide() {
    const token = localStorage.getItem('token');
    if (!token) return null;
    try {
      const response = await fetch(BACKEND_URL + '/api/rides/active', { headers: { Authorization: 'Bearer ' + token }, cache: 'no-store' });
      const data = await response.json().catch(function () { return {}; });
      const activeRide = data.ride;
      if (response.ok && activeRide && activeRide.id && ACTIVE.indexOf(activeRide.status) !== -1) {
        setRide(activeRide); setDriverLoc(getLocation(activeRide.driverLocation)); return activeRide;
      }
    } catch (_) {}
    return null;
  }

  useEffect(function () { syncActiveRide().finally(function () { setRestoring(false); }); }, []);

  useEffect(function () {
    if (!ride || !ride.id || ACTIVE.indexOf(ride.status) === -1) { clearTimeout(timerRef.current); return undefined; }
    let stopped = false;
    async function poll() { if (stopped) return; await syncActiveRide(); if (!stopped) timerRef.current = setTimeout(poll, 3500); }
    timerRef.current = setTimeout(poll, 1500);
    return function () { stopped = true; clearTimeout(timerRef.current); };
  }, [ride && ride.id, ride && ride.status]);

  useEffect(function () {
    if (!navigator.geolocation) { setError('Este navegador não oferece localização.'); return undefined; }
    function positionHandler(position) {
      const location = getLocation(position.coords); if (!location) return;
      setOrigin(location);
      setOriginText('Sua localização atual');
      if (mapRef.current) {
        if (!userMarker.current) userMarker.current = L.circleMarker([location.lat, location.lng], { radius: 8, color: '#fff', weight: 3, fillColor: '#1a73e8', fillOpacity: 1 }).addTo(mapRef.current);
        else userMarker.current.setLatLng([location.lat, location.lng]);
        if (!rideRef.current) mapRef.current.setView([location.lat, location.lng], 17);
      }
    }
    const watchId = navigator.geolocation.watchPosition(positionHandler, function () { setError('Permita a localização precisa para usar sua posição como embarque.'); }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 3000 });
    navigator.geolocation.getCurrentPosition(positionHandler, function () {}, { enableHighAccuracy: true, timeout: 20000, maximumAge: 5000 });
    return function () { navigator.geolocation.clearWatch(watchId); };
  }, []);

  useEffect(function () {
    const location = getLocation(driverLoc); if (!location || !mapRef.current) return;
    if (!driverMarker.current) driverMarker.current = L.circleMarker([location.lat, location.lng], { radius: 10, color: '#fff', weight: 3, fillColor: '#111', fillOpacity: 1 }).addTo(mapRef.current);
    else driverMarker.current.setLatLng([location.lat, location.lng]);
  }, [driverLoc]);

  useEffect(function () {
    function accepted(data) {
      const item = data && (data.ride || data);
      if (item && item.id && (!rideRef.current || item.id === rideRef.current.id)) { setRide(item); setDriverLoc(getLocation(item.driverLocation)); setMessage('Motorista encontrado!'); }
    }
    function changed(data) {
      if (!data || !rideRef.current || data.rideId !== rideRef.current.id) return;
      setRide(function (current) { return Object.assign({}, current, data.ride || {}); });
    }
    function locationUpdate(data) {
      if (!data) return;
      if (data.rideId && rideRef.current && data.rideId !== rideRef.current.id) return;
      const location = getLocation(data); if (location) setDriverLoc(location);
    }
    WebSocketService.onRideAccepted(accepted); WebSocketService.onDriverLocationUpdate(locationUpdate); WebSocketService.onRideStarted(changed); WebSocketService.onRideEnded(changed); WebSocketService.onRideCancelled(changed);
    if (ride && ride.id) { WebSocketService.connect(); WebSocketService.joinRideRoom(ride.id); }
    return function () { WebSocketService.off('ride-accepted', accepted); WebSocketService.off('driver-location-update', locationUpdate); WebSocketService.off('ride-started', changed); WebSocketService.off('ride-ended', changed); WebSocketService.off('ride-cancelled', changed); };
  }, [ride && ride.id]);

  function searchAddress(value) {
    setDestination(value); setTrip(null); setError(''); setMessage(''); clearTimeout(timerRef.current);
    if (value.trim().length < 3) { setSuggestions([]); return; }
    const sequence = ++searchSeq.current; setSearching(true);
    timerRef.current = setTimeout(async function () {
      try {
        let addresses = [];
        const query = new URLSearchParams({ format: 'jsonv2', q: value.trim(), limit: '6', countrycodes: 'br', addressdetails: '1', 'accept-language': 'pt-BR' });
        try { addresses = await (await fetch(NOMINATIM + '/search?' + query.toString())).json(); } catch (_) {}
        if (!Array.isArray(addresses) || !addresses.length) {
          const photonQuery = new URLSearchParams({ q: value.trim(), limit: '6', lang: 'pt', lat: String(origin ? origin.lat : -23.55), lon: String(origin ? origin.lng : -46.63) });
          const photon = await (await fetch(PHOTON + '?' + photonQuery.toString())).json();
          addresses = (photon.features || []).map(function (feature, index) {
            const coordinates = feature.geometry && feature.geometry.coordinates || []; const properties = feature.properties || {};
            return { place_id: 'ph-' + index + '-' + coordinates[1] + '-' + coordinates[0], lat: String(coordinates[1]), lon: String(coordinates[0]), display_name: [properties.name, properties.street, properties.housenumber, properties.city || properties.town, properties.state].filter(Boolean).join(', ') };
          });
        }
        if (sequence === searchSeq.current) setSuggestions(addresses.filter(function (item) { return Number.isFinite(Number(item.lat)) && Number.isFinite(Number(item.lon)); }));
      } catch (_) { if (sequence === searchSeq.current) setError('Não foi possível pesquisar o endereço agora.'); }
      finally { if (sequence === searchSeq.current) setSearching(false); }
    }, 350);
  }

  async function chooseAddress(item) {
    if (!origin) { setError('Aguardando sua localização.'); return; }
    const lat = Number(item.lat); const lng = Number(item.lon); if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    setBusy(true); setError(''); setSuggestions([]);
    try {
      let route = null;
      try { const response = await fetch(OSRM + '/' + origin.lng + ',' + origin.lat + ';' + lng + ',' + lat + '?overview=full&geometries=geojson&steps=false'); const data = await response.json(); route = data.routes && data.routes[0]; } catch (_) {}
      if (!route) {
        const km = Math.max(0.01, Math.sqrt(Math.pow((lat - origin.lat) * 111, 2) + Math.pow((lng - origin.lng) * 111 * Math.cos(origin.lat * Math.PI / 180), 2)));
        route = { distance: km * 1000, duration: Math.max(60, km / 35 * 3600), geometry: { type: 'LineString', coordinates: [[origin.lng, origin.lat], [lng, lat]] } };
      }
      if (routeLayer.current) routeLayer.current.remove();
      routeLayer.current = L.geoJSON(route.geometry, { style: { color: '#111', weight: 6, opacity: .9 } }).addTo(mapRef.current);
      mapRef.current.fitBounds(routeLayer.current.getBounds(), { padding: [50, 260] });
      const km = route.distance / 1000; const address = item.display_name || 'Destino';
      setDestination(address); setTrip({ distance: km, duration: Math.max(1, Math.ceil(route.duration / 60)), price: km * 5 + 10, origin: originText, destination: address, originLocation: origin, destinationLocation: { lat, lng } });
    } catch (_) { setError('Não foi possível calcular a rota. Escolha um endereço sugerido.'); }
    finally { setBusy(false); }
  }

  async function requestRide() {
    if (!trip || busy) return;
    const token = localStorage.getItem('token'); if (!token) { setError('Sua sessão expirou. Entre novamente.'); return; }
    setBusy(true); setError(''); setMessage('Criando corrida e procurando motorista…');
    try {
      const controller = new AbortController(); const timeout = setTimeout(function () { controller.abort(); }, 15000);
      let response;
      try {
        response = await fetch(BACKEND_URL + '/api/rides/request', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ origin: { address: trip.origin, location: trip.originLocation }, destination: { address: trip.destination, location: trip.destinationLocation } }), signal: controller.signal });
      } finally { clearTimeout(timeout); }
      const data = await response.json().catch(function () { return {}; });
      if (!response.ok) throw new Error(getError(response, data, 'Não foi possível solicitar a corrida.'));
      if (!data.ride || !data.ride.id) throw new Error('O servidor não retornou a corrida criada.');
      setRide(data.ride); setMessage('Procurando o motorista mais próximo…'); WebSocketService.connect(); WebSocketService.joinRideRoom(data.ride.id);
      if (props.onRideCreate) props.onRideCreate(data.ride);
      setTimeout(async function () {
        try {
          const reinforce = await fetch(BACKEND_URL + '/api/rides/' + data.ride.id + '/search', { method: 'POST', headers: { Authorization: 'Bearer ' + token } });
          const reinforceData = await reinforce.json().catch(function () { return {}; });
          if (reinforceData.ride && reinforceData.ride.status !== 'SEARCHING') setRide(reinforceData.ride);
        } catch (_) {}
      }, 1800);
    } catch (err) { setMessage(''); setError(err.name === 'AbortError' ? 'O servidor demorou para responder. Tente novamente.' : (err.message || 'Erro ao criar corrida.')); }
    finally { setBusy(false); }
  }

  async function cancelRide() {
    if (!ride || !ride.id || busy || !window.confirm('Deseja cancelar esta corrida?')) return;
    const token = localStorage.getItem('token'); setBusy(true);
    try {
      const response = await fetch(BACKEND_URL + '/api/rides/' + ride.id + '/status', { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ status: 'CANCELLED', cancellationReason: 'Cancelada pelo passageiro' }) });
      const data = await response.json().catch(function () { return {}; });
      if (!response.ok) throw new Error(getError(response, data, 'Erro ao cancelar.'));
      setRide(data.ride || Object.assign({}, ride, { status: 'CANCELLED' })); setDriverLoc(null); setMessage('Corrida cancelada.');
    } catch (err) { setError(err.message || 'Erro ao cancelar.'); }
    finally { setBusy(false); }
  }

  const labels = { SEARCHING: 'Procurando motorista', ACCEPTED: 'Motorista a caminho', IN_PROGRESS: 'Corrida em andamento' };
  const progress = ride && ride.status === 'SEARCHING' ? '30%' : ride && ride.status === 'ACCEPTED' ? '60%' : '82%';

  return <div className="map-ride"><div ref={mapElement} className="map-full" />
    <div className="map-panel"><div className="map-card">
      <div className="map-row"><strong>Uber Clone</strong><span className="map-muted">{restoring ? 'Carregando…' : 'Passageiro'}</span></div>
      {!ride && <><div style={{marginTop:12}}><input className="map-input" value={destination} onChange={function(e){searchAddress(e.target.value);}} placeholder="Para onde você vai?" disabled={busy} /></div>
        {searching && <div className="map-muted" style={{marginTop:8}}>Pesquisando endereço…</div>}
        {suggestions.length > 0 && <div className="map-suggest">{suggestions.map(function(item){return <button key={item.place_id || item.display_name} onClick={function(){chooseAddress(item);}}>{item.display_name}</button>;})}</div>}
        {trip && <div style={{marginTop:12}}><div className="map-grid"><div className="map-info"><b>Distância</b>{trip.distance.toFixed(1)} km</div><div className="map-info"><b>Estimativa</b>{trip.duration} min</div><div className="map-info"><b>Valor</b>R$ {trip.price.toFixed(2)}</div><div className="map-info"><b>Embarque</b>{trip.origin}</div></div><div className="map-actions"><button className="map-btn map-light" onClick={function(){setTrip(null);setDestination('');if(routeLayer.current){routeLayer.current.remove();routeLayer.current=null;}}} disabled={busy}>Alterar</button><button className="map-btn map-primary" onClick={requestRide} disabled={busy}>{busy ? 'Solicitando…' : '🚗 Procurar motorista'}</button></div></div>}
        {!trip && <div className="map-muted" style={{marginTop:10}}>Embarque: {originText}. Digite o destino e escolha uma sugestão do mapa.</div>}
      </>}
      {ride && <><div style={{marginTop:12}} className="map-status"><Avatar name={ride.driverName || 'Motorista'} photo={ride.driverPhoto} /><div><strong>{labels[ride.status] || ride.status}</strong><div className="map-muted">{ride.driverName ? ride.driverName : 'Aguardando um motorista aceitar'}</div></div></div><div style={{marginTop:12}} className="map-bar"><i style={{width:progress}} /></div>{message && <div className="map-ok">{message}</div>}<div className="map-actions"><button className="map-btn map-danger" onClick={cancelRide} disabled={busy || !['SEARCHING','ACCEPTED'].includes(ride.status)}>Cancelar corrida</button></div></>}
      {error && <div className="map-error">{error}</div>}
    </div></div>
  </div>;
}
