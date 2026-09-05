import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { BACKEND_URL } from '../config';
import DriverRideMap from './DriverRideMap';

const ACTIVE = ['ACCEPTED', 'IN_PROGRESS'];

function locationOf(value) {
  if (!value) return null;
  var source = value.location || value.currentLocation || value;
  var lat = Number(source.lat != null ? source.lat : source.latitude);
  var lng = Number(source.lng != null ? source.lng : source.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat: lat, lng: lng };
}

function pickupOf(ride) {
  return locationOf(ride && (ride.passengerLocation || (ride.origin && ride.origin.location)));
}

function destinationOf(ride) {
  return locationOf(ride && ride.destination && ride.destination.location);
}

export default function DriverNavigationMap() {
  var token = localStorage.getItem('token');
  var user = null;
  try { user = JSON.parse(localStorage.getItem('user') || 'null'); } catch (_) {}
  var uid = user && user.uid;
  var state = useState(null), ride = state[0], setRide = state[1];
  var driverState = useState(null), driverLocation = driverState[0], setDriverLocation = driverState[1];
  var loadingState = useState(true), loading = loadingState[0], setLoading = loadingState[1];
  var messageState = useState(''), message = messageState[0], setMessage = messageState[1];
  var watchRef = useRef(null);

  useEffect(function () {
    if (!token || !uid) return undefined;
    var dead = false;
    async function sync() {
      try {
        var response = await axios.get(BACKEND_URL + '/api/rides/active', { headers: { Authorization: 'Bearer ' + token }, timeout: 8000 });
        var activeRide = response.data && response.data.ride;
        if (dead) return;
        if (activeRide && activeRide.driverId && String(activeRide.driverId) === String(uid) && ACTIVE.indexOf(activeRide.status) !== -1) {
          setRide(activeRide);
          setMessage(activeRide.status === 'IN_PROGRESS' ? 'Navegação interna ativa: seguindo para o destino.' : 'Navegação interna ativa: seguindo para o passageiro.');
        } else {
          setRide(null);
          setMessage('Aguardando corrida. O mapa ficará pronto automaticamente.');
        }
      } catch (_) {
        if (!dead) setMessage('Não foi possível sincronizar a corrida agora.');
      } finally {
        if (!dead) setLoading(false);
      }
    }
    sync();
    var timer = window.setInterval(sync, 2500);
    return function () { dead = true; window.clearInterval(timer); };
  }, [token, uid]);

  useEffect(function () {
    if (!navigator.geolocation || !token || !uid) return undefined;
    var active = true;
    function success(position) {
      if (!active) return;
      var loc = { lat: Number(position.coords.latitude), lng: Number(position.coords.longitude) };
      if (Number.isFinite(loc.lat) && Number.isFinite(loc.lng)) setDriverLocation(loc);
    }
    watchRef.current = navigator.geolocation.watchPosition(success, function () {}, { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 });
    return function () { active = false; if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current); watchRef.current = null; };
  }, [token, uid]);

  var passenger = pickupOf(ride);
  var destination = destinationOf(ride);
  var status = ride && ride.status ? ride.status : 'IDLE';

  return <section className="driver-nav-card">
    <div className="driver-nav-head">
      <div><div className="driver-nav-kicker">NAVEGAÇÃO DO MOTORISTA</div><h2>Mapa da corrida</h2><p>{message}</p></div>
      <div className="driver-nav-badge">{status === 'ACCEPTED' ? '👤 A caminho do passageiro' : status === 'IN_PROGRESS' ? '🏁 A caminho do destino' : '🟢 Disponível'}</div>
    </div>
    {loading ? <div className="driver-nav-loading">Carregando mapa do motorista…</div> : <DriverRideMap driverLocation={driverLocation} passengerLocation={passenger} destinationLocation={destination} status={status} />}
    <div className="driver-nav-foot"><span>📍 GPS do motorista ativo</span><span>🗺️ Rota calculada dentro do PreçoFixo17</span><span>{passenger ? '👤 Passageiro localizado' : '⏳ Aguardando localização do passageiro'}</span></div>
    <style>{`.driver-nav-card{margin:0 0 18px;background:#fff;border:1px solid #e5e7eb;border-radius:20px;padding:16px;box-shadow:0 8px 28px rgba(0,0,0,.08)}.driver-nav-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;flex-wrap:wrap}.driver-nav-kicker{font-size:11px;font-weight:900;letter-spacing:.14em;color:#ff5a00}.driver-nav-head h2{margin:4px 0 4px;font-size:22px}.driver-nav-head p{margin:0;color:#6b7280;font-size:13px}.driver-nav-badge{background:#111827;color:#fff;border-radius:999px;padding:9px 12px;font-size:12px;font-weight:800}.driver-nav-loading{height:390px;border-radius:18px;background:linear-gradient(90deg,#eef1f5,#f7f8fa,#eef1f5);display:flex;align-items:center;justify-content:center;color:#4b5563;font-weight:800}.driver-nav-foot{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.driver-nav-foot span{background:#f5f6f7;border-radius:999px;padding:8px 10px;color:#4b5563;font-size:11px;font-weight:700}@media(max-width:640px){.driver-nav-card{padding:10px}.driver-nav-loading{height:320px}}`}</style>
  </section>;
}
