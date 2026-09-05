import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { BACKEND_URL } from '../config';

const ACTIVE = ['ACCEPTED', 'IN_PROGRESS'];
const DEFAULT_CENTER = [-14.235, -51.925];

function normalize(value) {
  if (!value) return null;
  const source = value.location || value.currentLocation || value;
  const lat = Number(source.lat ?? source.latitude);
  const lng = Number(source.lng ?? source.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function getRideTarget(ride) {
  if (!ride) return null;
  return ride.status === 'IN_PROGRESS'
    ? normalize(ride.destination?.location)
    : normalize(ride.passengerLocation || ride.origin?.location);
}

export default function DriverPanelMap() {
  const [ride, setRide] = useState(null);
  const [driver, setDriver] = useState(null);
  const [message, setMessage] = useState('Mapa do motorista pronto. Aguardando corrida.');
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const driverMarker = useRef(null);
  const targetMarker = useRef(null);
  const routeLayer = useRef(null);
  const watchId = useRef(null);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return undefined;
    const map = L.map(mapRef.current, { zoomControl: true, attributionControl: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);
    map.setView(DEFAULT_CENTER, 5);
    mapInstance.current = map;
    const timer = window.setTimeout(() => map.invalidateSize(), 200);
    return () => {
      window.clearTimeout(timer);
      map.remove();
      mapInstance.current = null;
    };
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) {
      setMessage('GPS indisponível neste dispositivo. O mapa continua ativo.');
      return undefined;
    }
    watchId.current = navigator.geolocation.watchPosition(
      (position) => {
        const next = { lat: position.coords.latitude, lng: position.coords.longitude };
        setDriver(next);
        setMessage((current) => current === 'Mapa do motorista pronto. Aguardando corrida.' || current.includes('GPS') ? 'GPS do motorista ativo. Aguardando corrida.' : current);
      },
      () => setMessage('GPS não autorizado. Ative a localização para navegação precisa.'),
      { enableHighAccuracy: true, maximumAge: 1500, timeout: 10000 }
    );
    return () => {
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    };
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    let user = null;
    try { user = JSON.parse(localStorage.getItem('user') || 'null'); } catch (_) {}
    const uid = user?.uid;
    if (!token || !uid) return undefined;
    let dead = false;
    const sync = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/api/rides/active`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        const data = await response.json().catch(() => ({}));
        const active = data?.ride;
        if (dead) return;
        if (active && String(active.driverId) === String(uid) && ACTIVE.includes(active.status)) {
          setRide(active);
          setMessage(active.status === 'IN_PROGRESS' ? 'Corrida em andamento: navegando para o destino.' : 'Corrida aceita: navegando até o passageiro.');
        } else {
          setRide(null);
          setMessage('Mapa do motorista pronto. Aguardando corrida.');
        }
      } catch (_) {
        if (!dead) setMessage('Mapa ativo. Não foi possível sincronizar a corrida neste momento.');
      }
    };
    sync();
    const timer = window.setInterval(sync, 2500);
    return () => { dead = true; window.clearInterval(timer); };
  }, []);

  const target = getRideTarget(ride);
  const status = ride?.status || 'IDLE';

  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;
    map.invalidateSize();

    const icon = (className, label) => L.divIcon({
      className: 'driver-panel-pin-wrapper',
      html: `<div class="driver-panel-pin ${className}">${label}</div>`,
      iconSize: [42, 42],
      iconAnchor: [21, 21],
    });

    if (driver) {
      if (!driverMarker.current) driverMarker.current = L.marker([driver.lat, driver.lng], { icon: icon('driver', '🚙') }).addTo(map);
      else driverMarker.current.setLatLng([driver.lat, driver.lng]);
      driverMarker.current.bindTooltip('Sua localização', { direction: 'top', offset: [0, -18] });
    }

    if (target) {
      const isDestination = status === 'IN_PROGRESS';
      const targetIcon = icon(isDestination ? 'destination' : 'passenger', isDestination ? '🏁' : '👤');
      if (!targetMarker.current) targetMarker.current = L.marker([target.lat, target.lng], { icon: targetIcon }).addTo(map);
      else {
        targetMarker.current.setLatLng([target.lat, target.lng]);
        targetMarker.current.setIcon(targetIcon);
      }
      targetMarker.current.bindTooltip(isDestination ? 'Destino' : 'Passageiro', { direction: 'top', offset: [0, -18] });
    } else if (targetMarker.current) {
      targetMarker.current.remove();
      targetMarker.current = null;
    }

    if (driver && target) {
      map.fitBounds(L.latLngBounds([[driver.lat, driver.lng], [target.lat, target.lng]]).pad(0.25), { animate: true, maxZoom: 16 });
    } else if (driver) {
      map.setView([driver.lat, driver.lng], 15, { animate: true });
    }
  }, [driver, target, status]);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !driver || !target) return undefined;
    const controller = new AbortController();
    const url = `https://router.project-osrm.org/route/v1/driving/${driver.lng},${driver.lat};${target.lng},${target.lat}?overview=full&geometries=geojson&steps=false`;
    fetch(url, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('route')))
      .then((data) => {
        const coords = data?.routes?.[0]?.geometry?.coordinates || [];
        const latLngs = coords.map(([lng, lat]) => [lat, lng]).filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));
        if (routeLayer.current) routeLayer.current.remove();
        routeLayer.current = latLngs.length
          ? L.polyline(latLngs, { color: '#ff5a00', weight: 6, opacity: 0.9, lineCap: 'round', lineJoin: 'round' }).addTo(map)
          : L.polyline([[driver.lat, driver.lng], [target.lat, target.lng]], { color: '#ff5a00', weight: 5, dashArray: '10 8' }).addTo(map);
      })
      .catch(() => {
        if (routeLayer.current) routeLayer.current.remove();
        routeLayer.current = L.polyline([[driver.lat, driver.lng], [target.lat, target.lng]], { color: '#ff5a00', weight: 5, dashArray: '10 8' }).addTo(map);
      });
    return () => controller.abort();
  }, [driver, target]);

  return (
    <section className="driver-panel-map-card">
      <div className="driver-panel-map-title">
        <div>
          <div className="driver-panel-map-kicker">NAVEGAÇÃO DO MOTORISTA</div>
          <h2>Mapa do motorista</h2>
          <p>{message}</p>
        </div>
        <strong>{status === 'ACCEPTED' ? '👤 PASSAGEIRO' : status === 'IN_PROGRESS' ? '🏁 DESTINO' : '🟢 ONLINE'}</strong>
      </div>
      <div className="driver-panel-map-shell">
        <div ref={mapRef} className="driver-panel-map-canvas" />
        <div className="driver-panel-map-overlay">{status === 'ACCEPTED' ? 'Rota até o passageiro' : status === 'IN_PROGRESS' ? 'Rota até o destino' : 'Mapa do motorista — aguardando corrida'}</div>
      </div>
      <div className="driver-panel-map-meta">
        <span>📍 GPS do motorista</span>
        <span>🗺️ Navegação dentro do PreçoFixo17</span>
        <span>{target ? '🎯 Destino localizado' : '⏳ Nenhuma corrida ativa'}</span>
      </div>
      <style>{`
        .driver-panel-map-card{margin:0 0 18px;padding:16px;background:#fff;border:2px solid #111;border-radius:20px;box-shadow:0 10px 30px rgba(0,0,0,.10)}
        .driver-panel-map-title{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;flex-wrap:wrap;margin-bottom:12px}
        .driver-panel-map-kicker{font-size:11px;letter-spacing:.14em;font-weight:950;color:#ff5a00}
        .driver-panel-map-title h2{margin:3px 0 4px;font-size:23px;color:#111}
        .driver-panel-map-title p{margin:0;color:#616875;font-size:13px}
        .driver-panel-map-title strong{background:#111;color:#fff;border-radius:999px;padding:9px 12px;font-size:12px}
        .driver-panel-map-shell{position:relative;height:430px;min-height:430px;border-radius:18px;overflow:hidden;background:#dfe7ee;border:2px solid #111}
        .driver-panel-map-canvas{height:100%;width:100%;min-height:430px}
        .driver-panel-map-overlay{position:absolute;left:12px;bottom:12px;z-index:900;background:#111;color:#fff;border-radius:999px;padding:10px 13px;font-size:12px;font-weight:900;box-shadow:0 5px 18px rgba(0,0,0,.25)}
        .driver-panel-map-meta{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
        .driver-panel-map-meta span{background:#f2f3f5;border-radius:999px;padding:8px 10px;font-size:11px;font-weight:800;color:#4b5563}
        .driver-panel-map-shell .leaflet-container{height:100%;width:100%;font-family:Arial,sans-serif}
        .driver-panel-pin-wrapper{background:transparent;border:0}
        .driver-panel-pin{width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid #fff;box-shadow:0 3px 12px rgba(0,0,0,.3);font-size:19px}
        .driver-panel-pin.driver{background:#111}
        .driver-panel-pin.passenger{background:#ff5a00}
        .driver-panel-pin.destination{background:#d32f2f}
        @media(max-width:640px){.driver-panel-map-card{padding:10px}.driver-panel-map-shell,.driver-panel-map-canvas{height:330px;min-height:330px}.driver-panel-map-title h2{font-size:20px}}
      `}</style>
    </section>
  );
}
