import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { BACKEND_URL } from '../config';
import WebSocketService from '../services/WebSocketService';
import DriverRideMap from '../components/DriverRideMap';

const ACTIVE = ['ACCEPTED', 'IN_PROGRESS'];
const ARRIVAL_RADIUS_KM = 0.15;

function getError(error, fallback) {
  return (error && error.response && error.response.data && (error.response.data.error || error.response.data.details)) || error.message || fallback;
}
function normalizeLocation(value) {
  if (!value) return null;
  const source = value.location || value.currentLocation || value;
  const lat = Number(source.lat ?? source.latitude), lng = Number(source.lng ?? source.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}
function distanceKm(a, b) {
  const p = normalizeLocation(a), q = normalizeLocation(b);
  if (!p || !q) return Infinity;
  const R = 6371, dLat = (q.lat - p.lat) * Math.PI / 180, dLng = (q.lng - p.lng) * Math.PI / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(p.lat * Math.PI / 180) * Math.cos(q.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}
function passengerLocationOf(ride) { return normalizeLocation(ride && (ride.passengerLocation || (ride.origin && ride.origin.location))); }
function destinationLocationOf(ride) { return normalizeLocation(ride && ride.destination && ride.destination.location); }
function Avatar({ photo, name }) {
  const letter = String(name || 'P').trim().charAt(0).toUpperCase();
  return <div className="driver-avatar">{photo ? <img src={photo} alt={name || 'Passageiro'} /> : letter}</div>;
}

export default function DriverDashboardMapPro() {
  const [user] = useState(function () { try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch (_) { return null; } });
  const [online, setOnline] = useState(false);
  const [requests, setRequests] = useState([]);
  const [ride, setRide] = useState(null);
  const [passengerLocation, setPassengerLocation] = useState(null);
  const [driverLocation, setDriverLocation] = useState(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [completed, setCompleted] = useState(null);
  const rideRef = useRef(null), onlineRef = useRef(false), watchRef = useRef(null), completionTimerRef = useRef(null);
  const token = localStorage.getItem('token'), uid = user && user.uid, headers = { Authorization: 'Bearer ' + token };

  useEffect(function () { rideRef.current = ride; }, [ride]);
  useEffect(function () { onlineRef.current = online; }, [online]);

  function stopLocation() {
    if (watchRef.current !== null && navigator.geolocation) navigator.geolocation.clearWatch(watchRef.current);
    watchRef.current = null;
  }
  function startLocation() {
    if (!navigator.geolocation || watchRef.current !== null) return;
    watchRef.current = navigator.geolocation.watchPosition(function (position) {
      const location = { lat: Number(position.coords.latitude), lng: Number(position.coords.longitude) };
      if (!Number.isFinite(location.lat) || !Number.isFinite(location.lng)) return;
      setDriverLocation(location);
      if (rideRef.current && rideRef.current.id) WebSocketService.sendLocation(rideRef.current.id, uid, location.lat, location.lng);
      else if (onlineRef.current) WebSocketService.sendPresenceLocation(location.lat, location.lng);
    }, function () {}, { enableHighAccuracy: true, maximumAge: 2500, timeout: 10000 });
  }
  function clearRide(msg) {
    setRide(null); setPassengerLocation(null); stopLocation();
    if (onlineRef.current) startLocation();
    if (msg) setMessage(msg);
  }
  async function recoverActiveRide() {
    try {
      const response = await axios.get(BACKEND_URL + '/api/rides/active', { headers: headers, timeout: 8000 });
      const activeRide = response.data && response.data.ride;
      if (activeRide && activeRide.id && String(activeRide.driverId) === String(uid) && ACTIVE.indexOf(activeRide.status) !== -1) {
        setRide(activeRide); setPassengerLocation(passengerLocationOf(activeRide)); startLocation(); WebSocketService.joinRideRoom(activeRide.id); return activeRide;
      }
    } catch (_) {}
    return null;
  }
  function finishLocal(item) {
    setCompleted({
      price: Number(item && item.price != null ? item.price : (rideRef.current && rideRef.current.price) || 0),
      distance: Number(item && item.distance != null ? item.distance : (rideRef.current && rideRef.current.distance) || 0),
      passengerName: (item && item.passengerName) || (rideRef.current && rideRef.current.passengerName) || 'Passageiro'
    });
    clearRide('Corrida finalizada.');
    if (completionTimerRef.current) clearTimeout(completionTimerRef.current);
    completionTimerRef.current = setTimeout(function () {
      setCompleted(null);
      setMessage('Pronto para receber a próxima corrida.');
      if (onlineRef.current) startLocation();
    }, 4000);
  }

  useEffect(function () {
    if (!token || !uid) return undefined;
    const socket = WebSocketService.connect();
    async function join() {
      if (onlineRef.current) WebSocketService.joinDriversRoom();
      if (rideRef.current && rideRef.current.id) { WebSocketService.joinRideRoom(rideRef.current.id); await recoverActiveRide(); }
    }
    function onRequest(data) {
      const item = Object.assign({}, data || {}, { id: data && (data.id || data.rideId) });
      if (!item.id || rideRef.current) return;
      setRequests(function (items) { if (items.some(function (x) { return String(x.id) === String(item.id); })) return items; return [item].concat(items); });
    }
    function onUnavailable(data) {
      const id = data && (data.id || data.rideId);
      if (id) setRequests(function (items) { return items.filter(function (x) { return String(x.id) !== String(id); }); });
    }
    function onAccepted(data) {
      const item = data && (data.ride || data);
      if (!item || !item.id) return;
      if (String(item.driverId) === String(uid)) {
        setRide(item); setPassengerLocation(passengerLocationOf(item));
        setRequests(function (items) { return items.filter(function (x) { return String(x.id) !== String(item.id); }); });
        startLocation(); WebSocketService.joinRideRoom(item.id); setMessage('Corrida aceita. Rota até o passageiro aberta automaticamente.');
      } else if (item.driverId) setRequests(function (items) { return items.filter(function (x) { return String(x.id) !== String(item.id); }); });
    }
    function onPassengerLocation(data) {
      if (!data || !data.rideId || !rideRef.current || String(data.rideId) !== String(rideRef.current.id)) return;
      const loc = normalizeLocation(data.location); if (!loc) return;
      setPassengerLocation(loc);
      setRide(function (current) { return current ? Object.assign({}, current, { passengerLocation: loc, origin: Object.assign({}, current.origin, { location: loc }) }) : current; });
    }
    function onStarted(data) {
      const item = data && (data.ride || data);
      if (item && item.id === (rideRef.current && rideRef.current.id)) { setRide(function (current) { return Object.assign({}, current, item, { status: 'IN_PROGRESS' }); }); setMessage('Passageiro embarcou. Rota até o destino ativada.'); }
    }
    function onEnded(data) {
      const item = data && (data.ride || data);
      if (item && item.id === (rideRef.current && rideRef.current.id)) finishLocal(item);
    }
    function onCancelled(data) {
      const id = data && (data.rideId || (data.ride && data.ride.id));
      if (id && rideRef.current && String(id) === String(rideRef.current.id)) clearRide('O passageiro cancelou a corrida. Você voltou ao painel inicial.');
      if (id) setRequests(function (items) { return items.filter(function (x) { return String(x.id) !== String(id); }); });
    }
    if (socket) socket.on('connect', join);
    WebSocketService.onNewRideRequest(onRequest); WebSocketService.onRideUnavailable(onUnavailable); WebSocketService.onRideAccepted(onAccepted); WebSocketService.onPassengerLocationUpdate(onPassengerLocation); WebSocketService.onRideStarted(onStarted); WebSocketService.onRideEnded(onEnded); WebSocketService.onRideCancelled(onCancelled);
    return function () {
      if (socket) socket.off('connect', join); WebSocketService.off('new-ride-request', onRequest); WebSocketService.off('ride-unavailable', onUnavailable); WebSocketService.off('ride-accepted', onAccepted); WebSocketService.off('passenger-location-update', onPassengerLocation); WebSocketService.off('ride-started', onStarted); WebSocketService.off('ride-ended', onEnded); WebSocketService.off('ride-cancelled', onCancelled);
      if (completionTimerRef.current) clearTimeout(completionTimerRef.current); stopLocation(); WebSocketService.disconnect();
    };
  }, [token, uid]);

  useEffect(function () {
    if (!token || !uid) return undefined;
    let dead = false;
    Promise.all([axios.get(BACKEND_URL + '/api/drivers/me', { headers: headers }), axios.get(BACKEND_URL + '/api/rides/history?limit=20', { headers: headers })]).then(function (results) {
      if (dead) return;
      const driver = results[0].data && results[0].data.driver, isOnline = driver && driver.status === 'approved' && driver.isOnline === true;
      onlineRef.current = isOnline; setOnline(isOnline);
      const rides = (results[1].data && results[1].data.rides) || [], current = rides.find(function (item) { return ACTIVE.indexOf(item.status) !== -1 && String(item.driverId) === String(uid); });
      if (current) { setRide(current); setPassengerLocation(passengerLocationOf(current)); startLocation(); WebSocketService.connect(); WebSocketService.joinRideRoom(current.id); }
      else if (isOnline) { WebSocketService.connect(); WebSocketService.joinDriversRoom(); startLocation(); }
    }).catch(function () {});
    return function () { dead = true; };
  }, [token, uid]);

  useEffect(function () {
    if (!token || !uid || !online) return undefined;
    let dead = false;
    async function syncPendingRides() {
      if (dead || !onlineRef.current || rideRef.current) return;
      try {
        const response = await axios.get(BACKEND_URL + '/api/rides/pending', { headers: headers, timeout: 8000 }), pending = (response.data && response.data.rides) || [];
        if (dead || rideRef.current) return;
        setRequests(function (current) {
          const incoming = pending.filter(function (item) { return item && item.id; });
          return incoming.concat(current.filter(function (item) { return item && !incoming.some(function (next) { return String(next.id) === String(item.id); }); })).filter(function (item, index, all) { return item && item.id && all.findIndex(function (x) { return String(x.id) === String(item.id); }) === index; }).slice(0, 20);
        });
      } catch (_) {}
    }
    syncPendingRides(); const timer = setInterval(syncPendingRides, 3500);
    return function () { dead = true; clearInterval(timer); };
  }, [token, uid, online]);

  useEffect(function () {
    if (!token || !uid || !ride) return undefined;
    let dead = false;
    async function syncActive() {
      if (dead || !rideRef.current) return;
      try {
        const response = await axios.get(BACKEND_URL + '/api/rides/active', { headers: headers, timeout: 8000 }), activeRide = response.data && response.data.ride;
        if (!activeRide || String(activeRide.id) !== String(rideRef.current.id)) { clearRide('A corrida foi encerrada/cancelada. Você voltou ao painel inicial.'); return; }
        setRide(function (current) { return current ? Object.assign({}, current, activeRide) : activeRide; });
        const loc = passengerLocationOf(activeRide); if (loc) setPassengerLocation(loc);
      } catch (_) {}
    }
    syncActive(); const timer = setInterval(syncActive, 3000);
    return function () { dead = true; clearInterval(timer); };
  }, [token, uid, ride && ride.id]);

  async function toggleOnline() {
    if (busy || !uid || rideRef.current) return;
    setBusy(true); setMessage('');
    try {
      if (!onlineRef.current) {
        if (!navigator.geolocation) throw new Error('Localização não disponível.');
        const position = await new Promise(function (resolve, reject) { navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 12000 }); });
        const location = { lat: Number(position.coords.latitude), lng: Number(position.coords.longitude) };
        await axios.post(BACKEND_URL + '/api/drivers/' + uid + '/status', { isOnline: true, currentLocation: location }, { headers: headers });
        setDriverLocation(location); WebSocketService.connect(); WebSocketService.joinDriversRoom(); WebSocketService.sendPresenceLocation(location.lat, location.lng); onlineRef.current = true; setOnline(true); startLocation(); setMessage('Você está online e receberá corridas próximas.');
      } else {
        stopLocation(); await axios.post(BACKEND_URL + '/api/drivers/' + uid + '/status', { isOnline: false }, { headers: headers }); onlineRef.current = false; setOnline(false); WebSocketService.disconnect(); setRequests([]); setDriverLocation(null); setMessage('Você ficou offline.');
      }
    } catch (error) { setMessage(getError(error, 'Não foi possível alterar o status.')); } finally { setBusy(false); }
  }

  async function acceptRide(request) {
    if (busy || rideRef.current || !request || !request.id) return;
    setBusy(true); setMessage('Aceitando corrida…');
    try {
      const response = await axios.post(BACKEND_URL + '/api/rides/accept', { rideId: request.id }, { headers: headers, timeout: 15000 }), accepted = response.data && response.data.ride;
      if (!accepted || !accepted.id) throw new Error('O servidor não retornou os dados da corrida.');
      setRide(accepted); setPassengerLocation(passengerLocationOf(accepted)); setRequests(function (items) { return items.filter(function (x) { return String(x.id) !== String(request.id); }); });
      startLocation(); WebSocketService.connect(); WebSocketService.joinRideRoom(accepted.id); setMessage('Corrida aceita. Rota até o passageiro aberta automaticamente.');
    } catch (error) {
      const recovered = await recoverActiveRide();
      if (recovered) setMessage('Corrida aceita com sucesso.');
      else setMessage(getError(error, 'Não foi possível aceitar a corrida.'));
    } finally { setBusy(false); }
  }

  async function updateStatus(nextStatus) {
    if (!ride || !ride.id || busy) return;
    if (nextStatus === 'IN_PROGRESS' && distanceKm(driverLocation, passengerLocationOf(ride)) > ARRIVAL_RADIUS_KM) { setMessage('Chegue ao ponto de embarque para iniciar a corrida.'); return; }
    if (nextStatus === 'COMPLETED' && distanceKm(driverLocation, destinationLocationOf(ride)) > ARRIVAL_RADIUS_KM) { setMessage('Chegue ao destino para finalizar a corrida.'); return; }
    setBusy(true);
    try {
      const response = await axios.patch(BACKEND_URL + '/api/rides/' + ride.id + '/status', { status: nextStatus }, { headers: headers, timeout: 12000 }), updated = response.data && response.data.ride ? response.data.ride : Object.assign({}, ride, { status: nextStatus });
      if (nextStatus === 'IN_PROGRESS') { setRide(updated); WebSocketService.startRide(ride.id, uid); setMessage('Passageiro embarcou. Rota até o destino ativada.'); }
      if (nextStatus === 'COMPLETED') { WebSocketService.endRide(ride.id, uid); finishLocal(updated); }
    } catch (error) { setMessage(getError(error, 'Não foi possível atualizar a corrida.')); } finally { setBusy(false); }
  }

  async function cancelRide() {
    if (!ride || !ride.id || busy || !window.confirm('Cancelar esta corrida?')) return;
    setBusy(true);
    try { await axios.patch(BACKEND_URL + '/api/rides/' + ride.id + '/status', { status: 'CANCELLED', cancellationReason: 'Cancelada pelo motorista' }, { headers: headers, timeout: 12000 }); WebSocketService.cancelRide(ride.id); clearRide('Corrida cancelada.'); }
    catch (error) { setMessage(getError(error, 'Erro ao cancelar a corrida.')); }
    finally { setBusy(false); }
  }

  const pickupDistance = distanceKm(driverLocation, passengerLocationOf(ride)), destinationDistance = distanceKm(driverLocation, destinationLocationOf(ride));
  const nearPickup = Number.isFinite(pickupDistance) && pickupDistance <= ARRIVAL_RADIUS_KM, nearDestination = Number.isFinite(destinationDistance) && destinationDistance <= ARRIVAL_RADIUS_KM;

  if (!user || user.userType !== 'driver') return <div style={{ padding: 30 }}>Acesso restrito ao motorista.</div>;
  return <div className="driver-pro">
    <style>{`.driver-pro{min-height:100vh;background:#f3f4f6;padding:18px;font-family:Arial,sans-serif}.driver-box{max-width:920px;margin:0 auto 15px;background:#fff;border-radius:18px;padding:18px;box-shadow:0 4px 18px rgba(0,0,0,.08)}.driver-row{display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap}.driver-btn{border:0;border-radius:12px;padding:12px 16px;font-weight:800;cursor:pointer}.driver-btn:disabled{opacity:.55;cursor:not-allowed}.driver-on{background:#16a34a;color:#fff}.driver-off,.driver-danger{background:#dc2626;color:#fff}.driver-dark{background:#111827;color:#fff}.driver-accent{background:#ff6a00;color:#fff}.driver-muted{color:#69717b;font-size:13px;line-height:1.45}.driver-avatar{width:52px;height:52px;border-radius:50%;background:#111;color:#fff;display:flex;align-items:center;justify-content:center;overflow:hidden;font-weight:800}.driver-avatar img{width:100%;height:100%;object-fit:cover}.driver-person{display:flex;gap:10px;align-items:center}.driver-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.driver-info{background:#f5f6f7;border-radius:12px;padding:11px}.driver-info b{display:block;color:#6b7280;font-size:12px;margin-bottom:4px}.driver-request{border:1px solid #e1e5e9;border-radius:15px;padding:14px;margin-top:10px}.driver-arrival{margin-top:12px;border-radius:14px;padding:12px;background:#fff7ed;border:1px solid #fed7aa}.driver-success{background:#ecfdf5;border:1px solid #a7f3d0;border-radius:16px;padding:16px}@media(max-width:640px){.driver-pro{padding:10px}.driver-grid{grid-template-columns:1fr}.driver-btn{width:100%}}`}</style>
    <div className="driver-box"><div className="driver-row"><div><h1 style={{ margin: 0 }}>Painel do motorista</h1><div className="driver-muted">{user.name || user.email}</div></div><button className={'driver-btn ' + (online ? 'driver-off' : 'driver-on')} disabled={busy || !!ride} onClick={toggleOnline}>{busy ? 'Aguarde…' : online ? 'Ficar offline' : 'Ficar online'}</button></div><p><b>Status:</b> {online ? '🟢 Online' : '⚪ Offline'}</p>{message && <div className="driver-info">{message}</div>}</div>
    {completed && <div className="driver-box"><div className="driver-success"><h2 style={{ marginTop: 0 }}>✅ Corrida finalizada</h2><div className="driver-grid"><div className="driver-info"><b>Passageiro</b>{completed.passengerName}</div><div className="driver-info"><b>Valor da corrida</b>R$ {completed.price.toFixed(2)}</div><div className="driver-info"><b>Distância</b>{completed.distance.toFixed(2)} km</div><div className="driver-info"><b>Status</b>Concluída</div></div><p className="driver-muted">Voltando automaticamente ao painel inicial…</p></div></div>}
    {ride && <div className="driver-box"><div className="driver-row"><h2 style={{ margin: 0 }}>📍 Corrida atual</h2><b>{ride.status === 'ACCEPTED' ? 'A CAMINHO DO PASSAGEIRO' : 'EM CORRIDA'}</b></div><div className="driver-person" style={{ marginTop: 12 }}><Avatar photo={ride.passengerProfilePhoto} name={ride.passengerName} /><div><b>{ride.passengerName || 'Passageiro'}</b><div className="driver-muted">{ride.status === 'ACCEPTED' ? 'Dirija até o embarque.' : 'Passageiro embarcado. Siga a rota até o destino.'}</div></div></div><div className="driver-grid" style={{ marginTop: 12 }}><div className="driver-info"><b>Embarque</b>{(ride.origin && ride.origin.address) || '—'}{Number.isFinite(pickupDistance) && <div className="driver-muted">{pickupDistance.toFixed(2)} km</div>}</div><div className="driver-info"><b>Destino</b>{(ride.destination && ride.destination.address) || '—'}{ride.status === 'IN_PROGRESS' && Number.isFinite(destinationDistance) && <div className="driver-muted">{destinationDistance.toFixed(2)} km</div>}</div><div className="driver-info"><b>Valor</b>R$ {Number(ride.price || 0).toFixed(2)}</div><div className="driver-info"><b>Distância</b>{Number(ride.distance || 0).toFixed(2)} km</div></div><DriverRideMap driverLocation={driverLocation} passengerLocation={passengerLocation || (ride.origin && ride.origin.location) || null} destinationLocation={ride.destination && ride.destination.location} status={ride.status} />{ride.status === 'ACCEPTED' && <div className="driver-arrival"><b>{nearPickup ? '✅ Você chegou ao passageiro.' : '🚘 A caminho do passageiro.'}</b><div className="driver-muted">{nearPickup ? 'Quando o passageiro embarcar, toque em iniciar.' : 'O botão de iniciar será liberado ao chegar ao embarque.'}</div></div>}{ride.status === 'IN_PROGRESS' && <div className="driver-arrival"><b>{nearDestination ? '✅ Você chegou ao destino.' : '🧭 Rota até o destino ativa.'}</b><div className="driver-muted">{nearDestination ? 'Agora a corrida pode ser finalizada.' : 'Finalize somente ao chegar ao destino.'}</div></div>}<div className="driver-row" style={{ marginTop: 14 }}>{ride.status === 'ACCEPTED' && <button className="driver-btn driver-accent" disabled={busy || !nearPickup} onClick={function () { updateStatus('IN_PROGRESS'); }}>{nearPickup ? '👤 Passageiro embarcou • Iniciar' : '📍 Aguardando chegada ao passageiro'}</button>}{ride.status === 'IN_PROGRESS' && <button className="driver-btn driver-on" disabled={busy || !nearDestination} onClick={function () { updateStatus('COMPLETED'); }}>{nearDestination ? '✅ Finalizar corrida' : '🧭 Dirija até o destino para finalizar'}</button>}{ACTIVE.indexOf(ride.status) !== -1 && <button className="driver-btn driver-danger" disabled={busy} onClick={cancelRide}>Cancelar corrida</button>}</div></div>}
    {!ride && <div className="driver-box"><h2>🔔 Solicitações</h2>{!online && <p className="driver-muted">Fique online para receber corridas.</p>}{online && requests.length === 0 && <p className="driver-muted">Aguardando a próxima corrida mais próxima…</p>}{online && requests.map(function (request) { const location = passengerLocationOf(request); return <div className="driver-request" key={request.id}><div className="driver-person"><Avatar photo={request.passengerProfilePhoto} name={request.passengerName} /><div><b>{request.passengerName || 'Passageiro'}</b><div className="driver-muted">{request.estimatedDistanceKm != null ? request.estimatedDistanceKm + ' km até o embarque' : 'Perto de você'}</div></div></div><p>📍 {(request.origin && request.origin.address) || 'Embarque informado'}</p><p>🏁 {(request.destination && request.destination.address) || 'Destino informado'}</p>{location && <p className="driver-muted">📌 {location.lat.toFixed(5)}, {location.lng.toFixed(5)}</p>}<p><b>R$ {Number(request.price || 0).toFixed(2)}</b> • {Number(request.distance || 0).toFixed(1)} km</p><button className="driver-btn driver-on" disabled={busy || !!ride} onClick={function () { acceptRide(request); }}>{busy ? 'Aceitando…' : 'Aceitar corrida'}</button></div>; })}</div>}
  </div>;
}
