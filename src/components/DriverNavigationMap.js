import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { BACKEND_URL } from '../config';
import DriverRideMap from './DriverRideMap';

const ACTIVE = ['ACCEPTED', 'IN_PROGRESS'];

function locationOf(value) {
  if (!value) return null;
  const source = value.location || value.currentLocation || value;
  const lat = Number(source.lat != null ? source.lat : source.latitude);
  const lng = Number(source.lng != null ? source.lng : source.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function normalizeRide(ride) {
  if (!ride) return null;
  return {
    ...ride,
    passengerLocation: locationOf(ride.passengerLocation || (ride.origin && ride.origin.location)),
    destinationLocation: locationOf(ride.destination && ride.destination.location),
  };
}

export default function DriverNavigationMap() {
  const [ride, setRide] = useState(null);
  const [driverLocation, setDriverLocation] = useState(null);
  const [showDestination, setShowDestination] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('Aguardando corrida.');

  const user = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch (_) { return null; }
  }, []);
  const token = localStorage.getItem('token');
  const uid = user && user.uid;

  useEffect(() => {
    if (!token || !uid) return undefined;
    let dead = false;
    async function sync() {
      try {
        const response = await axios.get(BACKEND_URL + '/api/rides/active', {
          headers: { Authorization: 'Bearer ' + token },
          timeout: 8000,
        });
        const active = response.data && response.data.ride;
        if (dead) return;
        if (active && String(active.driverId) === String(uid) && ACTIVE.includes(active.status)) {
          const next = normalizeRide(active);
          setRide(next);
          if (active.status === 'ACCEPTED') {
            setShowDestination(false);
            setMessage('Corrida aceita. Toque em Iniciar para abrir o mapa do passageiro.');
          } else if (active.status === 'IN_PROGRESS') {
            setMessage(showDestination ? 'Rota do passageiro: destino ativo no mapa.' : 'Corrida iniciada. O mapa está mostrando a localização do passageiro.');
          }
        } else {
          setRide(null);
          setShowDestination(false);
          setMessage('Aguardando corrida.');
        }
      } catch (_) {
        if (!dead) setMessage('Não foi possível sincronizar a corrida agora.');
      } finally {
        if (!dead) setLoading(false);
      }
    }
    sync();
    const timer = window.setInterval(sync, 2500);
    return () => { dead = true; window.clearInterval(timer); };
  }, [token, uid, showDestination]);

  useEffect(() => {
    if (!token || !uid || !navigator.geolocation) return undefined;
    let active = true;
    const watch = navigator.geolocation.watchPosition(
      (position) => {
        if (!active) return;
        const loc = { lat: Number(position.coords.latitude), lng: Number(position.coords.longitude) };
        if (Number.isFinite(loc.lat) && Number.isFinite(loc.lng)) setDriverLocation(loc);
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 },
    );
    return () => {
      active = false;
      navigator.geolocation.clearWatch(watch);
    };
  }, [token, uid]);

  async function startRide() {
    if (!ride || ride.status !== 'ACCEPTED' || busy) return;
    setBusy(true);
    setMessage('Iniciando corrida e abrindo o mapa do passageiro…');
    try {
      const response = await axios.patch(BACKEND_URL + '/api/rides/' + ride.id + '/status', {
        status: 'IN_PROGRESS',
      }, {
        headers: { Authorization: 'Bearer ' + token },
        timeout: 15000,
      });
      const updated = normalizeRide(response.data && response.data.ride ? response.data.ride : { ...ride, status: 'IN_PROGRESS' });
      setRide(updated);
      setShowDestination(false);
      setMessage('✅ Corrida iniciada. Mapa aberto com a localização do passageiro.');
    } catch (error) {
      const data = error && error.response && error.response.data;
      setMessage((data && (data.error || data.details)) || 'Não foi possível iniciar a corrida.');
    } finally {
      setBusy(false);
    }
  }

  function openPassengerRoute() {
    if (!ride || ride.status !== 'IN_PROGRESS') return;
    setShowDestination(true);
    setMessage('🧭 Rota do passageiro ativada: seguindo automaticamente para o destino.');
  }

  const passenger = ride && ride.passengerLocation;
  const destination = ride && ride.destinationLocation;
  const status = ride ? ride.status : 'IDLE';
  const mapStatus = status === 'IN_PROGRESS' && showDestination ? 'IN_PROGRESS' : 'ACCEPTED';
  const mapDestination = showDestination ? destination : passenger;

  return (
    <section className="driver-nav-card">
      <div className="driver-nav-head">
        <div>
          <div className="driver-nav-kicker">NAVEGAÇÃO DO MOTORISTA</div>
          <h2>Mapa da corrida</h2>
          <p>{loading ? 'Carregando corrida…' : message}</p>
        </div>
        <div className="driver-nav-badge">
          {status === 'ACCEPTED' ? '🟠 Corrida aceita' : status === 'IN_PROGRESS' && showDestination ? '🏁 Rota até o destino' : status === 'IN_PROGRESS' ? '👤 Passageiro no mapa' : '🟢 Disponível'}
        </div>
      </div>

      {ride && status === 'ACCEPTED' && (
        <div className="driver-nav-actions">
          <div className="driver-nav-step"><strong>1</strong><span>Corrida aceita</span></div>
          <button type="button" className="driver-nav-primary" disabled={busy} onClick={startRide}>
            {busy ? 'Iniciando…' : '▶ Iniciar corrida'}
          </button>
        </div>
      )}

      {ride && status === 'IN_PROGRESS' && (
        <div className="driver-nav-actions">
          <div className="driver-nav-step"><strong>2</strong><span>{showDestination ? 'Destino ativo' : 'Localização do passageiro'}</span></div>
          <button type="button" className={showDestination ? 'driver-nav-secondary active' : 'driver-nav-secondary'} onClick={openPassengerRoute}>
            🧭 Rota do passageiro
          </button>
        </div>
      )}

      {ride && status === 'IN_PROGRESS' ? (
        <DriverRideMap
          driverLocation={driverLocation}
          passengerLocation={passenger}
          destinationLocation={mapDestination}
          status={showDestination ? 'IN_PROGRESS' : 'ACCEPTED'}
        />
      ) : (
        <div className="driver-nav-empty">
          <div className="driver-nav-empty-icon">🗺️</div>
          <strong>O mapa será aberto ao iniciar</strong>
          <span>Após aceitar a corrida, toque em “Iniciar corrida” para abrir a localização do passageiro.</span>
        </div>
      )}

      <div className="driver-nav-foot">
        <span>📍 GPS do motorista ativo</span>
        <span>{passenger ? '👤 Passageiro localizado' : '⏳ Aguardando localização do passageiro'}</span>
        <span>{showDestination && destination ? '🏁 Destino localizado' : '🧭 Rota do passageiro disponível após iniciar'}</span>
      </div>

      <style>{`
        .driver-nav-card{margin:0 0 18px;background:#fff;border:1px solid #e5e7eb;border-radius:20px;padding:16px;box-shadow:0 8px 28px rgba(0,0,0,.08)}
        .driver-nav-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;flex-wrap:wrap}
        .driver-nav-kicker{font-size:11px;font-weight:900;letter-spacing:.14em;color:#ff5a00}
        .driver-nav-head h2{margin:4px 0;font-size:22px}.driver-nav-head p{margin:0;color:#6b7280;font-size:13px}
        .driver-nav-badge{background:#111827;color:#fff;border-radius:999px;padding:9px 12px;font-size:12px;font-weight:800}
        .driver-nav-actions{display:flex;align-items:center;gap:10px;margin:14px 0 4px;flex-wrap:wrap}
        .driver-nav-step{display:flex;align-items:center;gap:8px;color:#374151;font-size:13px;font-weight:800;background:#f5f6f7;border-radius:12px;padding:10px 12px}
        .driver-nav-step strong{display:grid;place-items:center;width:28px;height:28px;border-radius:50%;background:#ff5a00;color:#fff}
        .driver-nav-primary,.driver-nav-secondary{border:0;border-radius:12px;padding:13px 17px;font-weight:900;cursor:pointer}
        .driver-nav-primary{background:#ff5a00;color:#fff}.driver-nav-primary:disabled{opacity:.6;cursor:not-allowed}
        .driver-nav-secondary{background:#111827;color:#fff}.driver-nav-secondary.active{background:#ff5a00}
        .driver-nav-empty{min-height:240px;margin-top:14px;border-radius:18px;background:#f6f7f8;border:2px dashed #d8dde3;display:flex;align-items:center;justify-content:center;flex-direction:column;text-align:center;padding:30px;gap:8px}
        .driver-nav-empty-icon{font-size:42px}.driver-nav-empty strong{font-size:17px;color:#111827}.driver-nav-empty span{max-width:520px;color:#6b7280;font-size:13px;line-height:1.5}
        .driver-nav-foot{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.driver-nav-foot span{background:#f5f6f7;border-radius:999px;padding:8px 10px;color:#4b5563;font-size:11px;font-weight:700}
        .driver-pro .driver-map-shell{display:none!important}
        @media(max-width:640px){.driver-nav-card{padding:10px}.driver-nav-primary,.driver-nav-secondary{width:100%}.driver-nav-actions{display:grid;grid-template-columns:1fr}.driver-nav-empty{min-height:210px}}
      `}</style>
    </section>
  );
}
