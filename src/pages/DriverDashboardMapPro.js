import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { BACKEND_URL } from '../config';
import WebSocketService from '../services/WebSocketService';
import DriverRideMap from '../components/DriverRideMap';

const ACTIVE = ['ACCEPTED', 'IN_PROGRESS'];
const ARRIVAL_RADIUS_KM = 0.5;

function errorMessage(error, fallback) {
  var data = error && error.response && error.response.data;
  return (data && (data.error || data.details)) || (error && error.message) || fallback;
}

function locationOf(value) {
  if (!value) return null;
  var source = value.location || value.currentLocation || value;
  var lat = Number(source.lat != null ? source.lat : source.latitude);
  var lng = Number(source.lng != null ? source.lng : source.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat: lat, lng: lng };
}

function ridePickup(ride) {
  return locationOf(ride && (ride.passengerLocation || (ride.origin && ride.origin.location)));
}

function rideDestination(ride) {
  return locationOf(ride && ride.destination && ride.destination.location);
}

function distanceKm(a, b) {
  var p = locationOf(a);
  var q = locationOf(b);
  if (!p || !q) return Infinity;
  var r = 6371;
  var dLat = (q.lat - p.lat) * Math.PI / 180;
  var dLng = (q.lng - p.lng) * Math.PI / 180;
  var x = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(p.lat * Math.PI / 180) * Math.cos(q.lat * Math.PI / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return r * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function Avatar(props) {
  var name = props.name || 'Passageiro';
  var letter = String(name).trim().charAt(0).toUpperCase() || 'P';
  return <div className="driver-avatar">{props.photo ? <img src={props.photo} alt={name} /> : letter}</div>;
}

export default function DriverDashboardMapPro() {
  var parsedUser = null;
  try { parsedUser = JSON.parse(localStorage.getItem('user') || 'null'); } catch (_) {}
  var user = parsedUser;
  var token = localStorage.getItem('token');
  var uid = user && user.uid;
  var headers = { Authorization: 'Bearer ' + token };

  var onlineState = useState(false), online = onlineState[0], setOnline = onlineState[1];
  var requestsState = useState([]), requests = requestsState[0], setRequests = requestsState[1];
  var rideState = useState(null), ride = rideState[0], setRide = rideState[1];
  var passengerState = useState(null), passengerLocation = passengerState[0], setPassengerLocation = passengerState[1];
  var driverState = useState(null), driverLocation = driverState[0], setDriverLocation = driverState[1];
  var messageState = useState(''), message = messageState[0], setMessage = messageState[1];
  var busyState = useState(false), busy = busyState[0], setBusy = busyState[1];
  var completedState = useState(null), completed = completedState[0], setCompleted = completedState[1];

  var rideRef = useRef(null);
  var onlineRef = useRef(false);
  var watchRef = useRef(null);
  var completionTimerRef = useRef(null);

  useEffect(function () { rideRef.current = ride; }, [ride]);
  useEffect(function () { onlineRef.current = online; }, [online]);

  function stopLocation() {
    if (watchRef.current !== null && navigator.geolocation) navigator.geolocation.clearWatch(watchRef.current);
    watchRef.current = null;
  }

  function startLocation() {
    if (!navigator.geolocation || watchRef.current !== null) return;
    watchRef.current = navigator.geolocation.watchPosition(function (position) {
      var current = { lat: Number(position.coords.latitude), lng: Number(position.coords.longitude) };
      if (!Number.isFinite(current.lat) || !Number.isFinite(current.lng)) return;
      setDriverLocation(current);
      if (rideRef.current && rideRef.current.id) WebSocketService.sendLocation(rideRef.current.id, uid, current.lat, current.lng);
      else if (onlineRef.current) WebSocketService.sendPresenceLocation(current.lat, current.lng);
    }, function () {}, { enableHighAccuracy: true, maximumAge: 1500, timeout: 10000 });
  }

  async function getFreshLocation() {
    if (!navigator.geolocation) {
      if (driverLocation) return driverLocation;
      throw new Error('Localização não disponível neste dispositivo.');
    }
    try {
      var position = await new Promise(function (resolve, reject) {
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, maximumAge: 0, timeout: 12000 });
      });
      var loc = { lat: Number(position.coords.latitude), lng: Number(position.coords.longitude) };
      if (!Number.isFinite(loc.lat) || !Number.isFinite(loc.lng)) throw new Error('Localização inválida.');
      setDriverLocation(loc);
      if (rideRef.current && rideRef.current.id) WebSocketService.sendLocation(rideRef.current.id, uid, loc.lat, loc.lng);
      return loc;
    } catch (gpsError) {
      if (driverLocation) return driverLocation;
      throw new Error('Não foi possível obter sua localização atual. Ative o GPS para iniciar a corrida.');
    }
  }

  function clearRide(text) {
    setRide(null);
    setPassengerLocation(null);
    setRequests([]);
    stopLocation();
    if (onlineRef.current) startLocation();
    if (text) setMessage(text);
  }

  function finishLocal(item) {
    var source = item || rideRef.current || {};
    setCompleted({ price: Number(source.price || 0), distance: Number(source.distance || 0), passengerName: source.passengerName || 'Passageiro' });
    clearRide('');
    if (completionTimerRef.current) clearTimeout(completionTimerRef.current);
    completionTimerRef.current = setTimeout(function () {
      setCompleted(null);
      setMessage('Pronto para receber a próxima corrida.');
    }, 4000);
  }

  async function syncDriverLocationToServer(loc) {
    if (!loc || !uid) return;
    var response = await axios.post(BACKEND_URL + '/api/drivers/' + uid + '/status', { isOnline: true, currentLocation: loc }, { headers: headers, timeout: 10000 });
    if (!response || response.status < 200 || response.status >= 300) throw new Error('Não foi possível sincronizar a localização do motorista.');
    onlineRef.current = true;
    setOnline(true);
  }

  useEffect(function () {
    if (!token || !uid) return undefined;
    var socket = WebSocketService.connect();

    function onRequest(data) {
      var item = Object.assign({}, data || {}, { id: data && (data.id || data.rideId) });
      if (!item.id || rideRef.current) return;
      setRequests(function (items) {
        var exists = items.some(function (x) { return String(x.id) === String(item.id); });
        return exists ? items : [item].concat(items).slice(0, 20);
      });
    }

    function onUnavailable(data) {
      var id = data && (data.id || data.rideId);
      if (!id) return;
      setRequests(function (items) { return items.filter(function (x) { return String(x.id) !== String(id); }); });
    }

    function onAccepted(data) {
      var item = data && (data.ride || data);
      if (!item || !item.id) return;
      if (String(item.driverId) !== String(uid)) return onUnavailable({ id: item.id });
      setRide(item);
      setPassengerLocation(ridePickup(item));
      setRequests(function (items) { return items.filter(function (x) { return String(x.id) !== String(item.id); }); });
      startLocation();
      WebSocketService.joinRideRoom(item.id);
      setMessage('Corrida aceita. Navegação interna até o passageiro ativada.');
      setTimeout(function () {
        var map = document.querySelector('.driver-map-shell');
        if (map && typeof map.scrollIntoView === 'function') map.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }

    function onPassengerLocation(data) {
      if (!data || !data.rideId || !rideRef.current || String(data.rideId) !== String(rideRef.current.id)) return;
      var loc = locationOf(data.location);
      if (!loc) return;
      setPassengerLocation(loc);
      setRide(function (current) { return current ? Object.assign({}, current, { passengerLocation: loc, origin: Object.assign({}, current.origin || {}, { location: loc }) }) : current; });
    }

    function onStarted(data) {
      var item = data && (data.ride || data);
      if (!item || String(item.id) !== String(rideRef.current && rideRef.current.id)) return;
      setRide(function (current) { return Object.assign({}, current || {}, item, { status: 'IN_PROGRESS' }); });
      setMessage('✅ Corrida iniciada. Rota interna até o destino ativada.');
    }

    function onEnded(data) {
      var item = data && (data.ride || data);
      if (!item || String(item.id) !== String(rideRef.current && rideRef.current.id)) return;
      finishLocal(item);
    }

    function onCancelled(data) {
      var id = data && (data.rideId || (data.ride && data.ride.id));
      if (!id) return;
      setRequests(function (items) { return items.filter(function (x) { return String(x.id) !== String(id); }); });
      if (rideRef.current && String(id) === String(rideRef.current.id)) clearRide('O passageiro cancelou a corrida. Você voltou ao painel inicial.');
    }

    if (socket) socket.on('connect', function () {
      if (onlineRef.current) WebSocketService.joinDriversRoom();
      if (rideRef.current && rideRef.current.id) WebSocketService.joinRideRoom(rideRef.current.id);
    });
    WebSocketService.onNewRideRequest(onRequest);
    WebSocketService.onRideUnavailable(onUnavailable);
    WebSocketService.onRideAccepted(onAccepted);
    WebSocketService.onPassengerLocationUpdate(onPassengerLocation);
    WebSocketService.onRideStarted(onStarted);
    WebSocketService.onRideEnded(onEnded);
    WebSocketService.onRideCancelled(onCancelled);

    return function () {
      WebSocketService.off('new-ride-request', onRequest);
      WebSocketService.off('ride-unavailable', onUnavailable);
      WebSocketService.off('ride-accepted', onAccepted);
      WebSocketService.off('passenger-location-update', onPassengerLocation);
      WebSocketService.off('ride-started', onStarted);
      WebSocketService.off('ride-ended', onEnded);
      WebSocketService.off('ride-cancelled', onCancelled);
      if (completionTimerRef.current) clearTimeout(completionTimerRef.current);
      stopLocation();
      WebSocketService.disconnect();
    };
  }, [token, uid]);

  useEffect(function () {
    if (!token || !uid) return undefined;
    var dead = false;
    Promise.all([
      axios.get(BACKEND_URL + '/api/drivers/me', { headers: headers, timeout: 8000 }),
      axios.get(BACKEND_URL + '/api/rides/active', { headers: headers, timeout: 8000 })
    ]).then(function (results) {
      if (dead) return;
      var driver = results[0].data && results[0].data.driver;
      var activeRide = results[1].data && results[1].data.ride;
      var isOnline = !!(driver && driver.status === 'approved' && driver.isOnline === true);
      onlineRef.current = isOnline;
      setOnline(isOnline);
      var recoveredLocation = locationOf(driver && (driver.currentLocation || driver.location));
      if (recoveredLocation) setDriverLocation(recoveredLocation);
      if (activeRide && String(activeRide.driverId) === String(uid)) {
        setRide(activeRide);
        setPassengerLocation(ridePickup(activeRide));
        startLocation();
        WebSocketService.connect();
        WebSocketService.joinRideRoom(activeRide.id);
        setTimeout(function () {
          var map = document.querySelector('.driver-map-shell');
          if (map && typeof map.scrollIntoView === 'function') map.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 150);
      } else if (isOnline) {
        WebSocketService.connect();
        WebSocketService.joinDriversRoom();
        startLocation();
      }
    }).catch(function () {});
    return function () { dead = true; };
  }, [token, uid]);

  useEffect(function () {
    if (!token || !uid || !online) return undefined;
    var dead = false;
    async function syncPending() {
      if (dead || !onlineRef.current || rideRef.current) return;
      try {
        var response = await axios.get(BACKEND_URL + '/api/rides/pending', { headers: headers, timeout: 8000 });
        var pending = response.data && response.data.rides || [];
        if (dead || rideRef.current) return;
        setRequests(function (current) {
          var map = {};
          current.concat(pending).forEach(function (item) { if (item && item.id) map[String(item.id)] = item; });
          return Object.keys(map).map(function (key) { return map[key]; }).slice(0, 20);
        });
      } catch (_) {}
    }
    syncPending();
    var timer = setInterval(syncPending, 3000);
    return function () { dead = true; clearInterval(timer); };
  }, [token, uid, online]);

  useEffect(function () {
    if (!token || !uid || !ride) return undefined;
    var dead = false;
    async function syncActive() {
      if (dead || !rideRef.current) return;
      try {
        var response = await axios.get(BACKEND_URL + '/api/rides/active', { headers: headers, timeout: 8000 });
        var activeRide = response.data && response.data.ride;
        if (!activeRide || String(activeRide.id) !== String(rideRef.current.id)) {
          clearRide('A corrida foi encerrada ou cancelada. Você voltou ao painel inicial.');
          return;
        }
        setRide(activeRide);
        var loc = ridePickup(activeRide);
        if (loc) setPassengerLocation(loc);
      } catch (_) {}
    }
    syncActive();
    var timer = setInterval(syncActive, 3000);
    return function () { dead = true; clearInterval(timer); };
  }, [token, uid, ride && ride.id]);

  async function toggleOnline() {
    if (busy || !uid || rideRef.current) return;
    setBusy(true);
    setMessage('');
    try {
      if (!onlineRef.current) {
        var loc = await getFreshLocation();
        await axios.post(BACKEND_URL + '/api/drivers/' + uid + '/status', { isOnline: true, currentLocation: loc }, { headers: headers, timeout: 12000 });
        onlineRef.current = true;
        setOnline(true);
        WebSocketService.connect();
        WebSocketService.joinDriversRoom();
        WebSocketService.sendPresenceLocation(loc.lat, loc.lng);
        startLocation();
        setMessage('Você está online e receberá corridas próximas.');
      } else {
        stopLocation();
        await axios.post(BACKEND_URL + '/api/drivers/' + uid + '/status', { isOnline: false }, { headers: headers, timeout: 12000 });
        onlineRef.current = false;
        setOnline(false);
        setRequests([]);
        setDriverLocation(null);
        WebSocketService.disconnect();
        setMessage('Você ficou offline.');
      }
    } catch (error) {
      setMessage(errorMessage(error, 'Não foi possível alterar o status.'));
    } finally { setBusy(false); }
  }

  async function acceptRide(request) {
    if (busy || rideRef.current || !request || !request.id) return;
    setBusy(true);
    setMessage('Aceitando corrida…');
    try {
      var response = await axios.post(BACKEND_URL + '/api/rides/accept', { rideId: request.id }, { headers: headers, timeout: 15000 });
      var accepted = response.data && response.data.ride;
      if (!accepted || !accepted.id) throw new Error('O servidor não retornou os dados da corrida.');
      setRide(accepted);
      setPassengerLocation(ridePickup(accepted));
      setRequests(function (items) { return items.filter(function (x) { return String(x.id) !== String(request.id); }); });
      startLocation();
      WebSocketService.connect();
      WebSocketService.joinRideRoom(accepted.id);
      setMessage('Corrida aceita. Navegação interna até o passageiro ativada.');
      setTimeout(function () {
        var map = document.querySelector('.driver-map-shell');
        if (map && typeof map.scrollIntoView === 'function') map.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    } catch (error) {
      setMessage(errorMessage(error, 'Não foi possível aceitar a corrida.'));
    } finally { setBusy(false); }
  }

  async function updateStatus(nextStatus) {
    var currentRide = rideRef.current;
    if (!currentRide || !currentRide.id || busy) return;
    setBusy(true);
    setMessage(nextStatus === 'IN_PROGRESS' ? 'Atualizando GPS e iniciando a corrida…' : 'Finalizando corrida…');
    try {
      var loc = await getFreshLocation();
      await syncDriverLocationToServer(loc);
      var response = await axios.patch(BACKEND_URL + '/api/rides/' + currentRide.id + '/status', { status: nextStatus }, { headers: headers, timeout: 15000 });
      var updated = response.data && response.data.ride ? response.data.ride : Object.assign({}, currentRide, { status: nextStatus });
      if (nextStatus === 'IN_PROGRESS') {
        setRide(updated);
        WebSocketService.joinRideRoom(currentRide.id);
        setMessage('✅ Corrida iniciada. O mapa interno agora mostra o destino.');
      } else if (nextStatus === 'COMPLETED') {
        finishLocal(updated);
      }
    } catch (error) {
      setMessage(errorMessage(error, nextStatus === 'IN_PROGRESS' ? 'Não foi possível iniciar a corrida.' : 'Não foi possível finalizar a corrida.'));
    } finally { setBusy(false); }
  }

  async function cancelRide() {
    if (!rideRef.current || !rideRef.current.id || busy || !window.confirm('Cancelar esta corrida?')) return;
    setBusy(true);
    try {
      await axios.patch(BACKEND_URL + '/api/rides/' + rideRef.current.id + '/status', { status: 'CANCELLED', cancellationReason: 'Cancelada pelo motorista' }, { headers: headers, timeout: 12000 });
      clearRide('Corrida cancelada.');
    } catch (error) {
      setMessage(errorMessage(error, 'Erro ao cancelar a corrida.'));
    } finally { setBusy(false); }
  }

  if (!user || user.userType !== 'driver') return <div style={{ padding: 30 }}>Acesso restrito ao motorista.</div>;

  var pickupDistance = distanceKm(driverLocation, ridePickup(ride));
  var destinationDistance = distanceKm(driverLocation, rideDestination(ride));
  var nearPickup = Number.isFinite(pickupDistance) && pickupDistance <= ARRIVAL_RADIUS_KM;
  var nearDestination = Number.isFinite(destinationDistance) && destinationDistance <= ARRIVAL_RADIUS_KM;

  return <div className="driver-pro">
    <style>{'.driver-pro{min-height:100vh;background:#f3f4f6;padding:18px;font-family:Arial,sans-serif}.driver-box{max-width:920px;margin:0 auto 15px;background:#fff;border-radius:18px;padding:18px;box-shadow:0 4px 18px rgba(0,0,0,.08)}.driver-row{display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap}.driver-btn{border:0;border-radius:12px;padding:12px 16px;font-weight:800;cursor:pointer}.driver-btn:disabled{opacity:.55;cursor:not-allowed}.driver-on{background:#16a34a;color:#fff}.driver-off,.driver-danger{background:#dc2626;color:#fff}.driver-accent{background:#ff6a00;color:#fff}.driver-muted{color:#69717b;font-size:13px;line-height:1.45}.driver-avatar{width:52px;height:52px;border-radius:50%;background:#111;color:#fff;display:flex;align-items:center;justify-content:center;overflow:hidden;font-weight:800}.driver-avatar img{width:100%;height:100%;object-fit:cover}.driver-person{display:flex;gap:10px;align-items:center}.driver-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.driver-info{background:#f5f6f7;border-radius:12px;padding:11px}.driver-info b{display:block;color:#6b7280;font-size:12px;margin-bottom:4px}.driver-request{border:1px solid #e1e5e9;border-radius:15px;padding:14px;margin-top:10px}.driver-arrival{margin-top:12px;border-radius:14px;padding:12px;background:#fff7ed;border:1px solid #fed7aa}.driver-success{background:#ecfdf5;border:1px solid #a7f3d0;border-radius:16px;padding:16px}@media(max-width:640px){.driver-pro{padding:10px}.driver-grid{grid-template-columns:1fr}.driver-btn{width:100%}}'}</style>
    <div className="driver-box"><div className="driver-row"><div><h1 style={{ margin: 0 }}>Painel do motorista</h1><div className="driver-muted">{user.name || user.email}</div></div><button className={'driver-btn ' + (online ? 'driver-off' : 'driver-on')} disabled={busy || !!ride} onClick={toggleOnline}>{busy ? 'Aguarde…' : online ? 'Ficar offline' : 'Ficar online'}</button></div><p><b>Status:</b> {online ? '🟢 Online' : '⚪ Offline'}</p>{message && <div className="driver-info">{message}</div>}</div>

    {completed && <div className="driver-box"><div className="driver-success"><h2 style={{ marginTop: 0 }}>✅ Corrida finalizada</h2><div className="driver-grid"><div className="driver-info"><b>Passageiro</b>{completed.passengerName}</div><div className="driver-info"><b>Valor da corrida</b>R$ {completed.price.toFixed(2)}</div><div className="driver-info"><b>Distância</b>{completed.distance.toFixed(2)} km</div><div className="driver-info"><b>Status</b>Concluída</div></div><p className="driver-muted">Voltando automaticamente ao painel inicial…</p></div></div>}

    {!ride && !completed && requests.length > 0 && <div className="driver-box"><h2 style={{ marginTop: 0 }}>🚕 Corridas disponíveis</h2>{requests.map(function (request) { return <div className="driver-request" key={request.id}><div className="driver-row"><div><b>{request.passengerName || 'Passageiro'}</b><div className="driver-muted">{request.origin && request.origin.address ? request.origin.address : 'Embarque'} → {request.destination && request.destination.address ? request.destination.address : 'Destino'}</div></div><b>R$ {Number(request.price || 0).toFixed(2)}</b></div><button className="driver-btn driver-accent" style={{ marginTop: 10, width: '100%' }} disabled={busy} onClick={function () { acceptRide(request); }}>Aceitar corrida</button></div>; })}</div>}

    {ride && <div className="driver-box"><div className="driver-row"><h2 style={{ margin: 0 }}>📍 Corrida atual</h2><b>{ride.status === 'ACCEPTED' ? 'A CAMINHO DO PASSAGEIRO' : 'EM CORRIDA'}</b></div><div className="driver-person" style={{ marginTop: 12 }}><Avatar photo={ride.passengerProfilePhoto} name={ride.passengerName} /><div><b>{ride.passengerName || 'Passageiro'}</b><div className="driver-muted">{ride.status === 'ACCEPTED' ? 'Dirija até o embarque.' : 'Passageiro embarcado. Siga a rota até o destino.'}</div></div></div><div className="driver-grid" style={{ marginTop: 12 }}><div className="driver-info"><b>Embarque</b>{(ride.origin && ride.origin.address) || '—'}{Number.isFinite(pickupDistance) && <div className="driver-muted">{pickupDistance.toFixed(2)} km</div>}</div><div className="driver-info"><b>Destino</b>{(ride.destination && ride.destination.address) || '—'}{ride.status === 'IN_PROGRESS' && Number.isFinite(destinationDistance) && <div className="driver-muted">{destinationDistance.toFixed(2)} km</div>}</div><div className="driver-info"><b>Valor</b>R$ {Number(ride.price || 0).toFixed(2)}</div><div className="driver-info"><b>Distância</b>{Number(ride.distance || 0).toFixed(2)} km</div></div><div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}><b>🧭 Navegação interna PreçoFixo17</b><span className="driver-muted">Sem abrir outro aplicativo.</span></div><DriverRideMap driverLocation={driverLocation} passengerLocation={passengerLocation || (ride.origin && ride.origin.location) || null} destinationLocation={ride.destination && ride.destination.location} status={ride.status} />{ride.status === 'ACCEPTED' && <div className="driver-arrival"><b>{nearPickup ? '✅ Você está no embarque' : '🚘 Rota até o passageiro ativa'}</b><div className="driver-muted">{nearPickup ? 'Toque em “Passageiro embarcou • Iniciar corrida” para iniciar.' : 'O mapa permanece dentro do PreçoFixo17 enquanto você se aproxima.'}</div></div>}{ride.status === 'IN_PROGRESS' && <div className="driver-arrival"><b>{nearDestination ? '✅ Você chegou ao destino.' : '🧭 Rota até o destino ativa.'}</b><div className="driver-muted">A posição é atualizada continuamente pelo GPS.</div></div>}<div className="driver-row" style={{ marginTop: 14 }}>{ride.status === 'ACCEPTED' && <button className="driver-btn driver-accent" disabled={busy} onClick={function () { updateStatus('IN_PROGRESS'); }}>{busy ? 'Iniciando…' : '👤 Passageiro embarcou • Iniciar corrida'}</button>}{ride.status === 'IN_PROGRESS' && <button className="driver-btn driver-on" disabled={busy} onClick={function () { updateStatus('COMPLETED'); }}>{busy ? 'Finalizando…' : '✅ Finalizar corrida'}</button>}{ACTIVE.indexOf(ride.status) !== -1 && <button className="driver-btn driver-danger" disabled={busy} onClick={cancelRide}>Cancelar corrida</button>}</div></div>}
  </div>;
}
