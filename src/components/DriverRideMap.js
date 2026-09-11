import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const ROUTE_URL = 'https://router.project-osrm.org/route/v1/driving/';

function normalizeLocation(value) {
  if (!value) return null;
  const source = value.location || value.currentLocation || value;
  const lat = Number(source.lat != null ? source.lat : source.latitude);
  const lng = Number(source.lng != null ? source.lng : source.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

function pin(className, label) {
  return L.divIcon({
    className: 'pf17-driver-pin-wrapper',
    html: `<div class="pf17-driver-pin ${className}"><span>${label}</span></div>`,
    iconSize: [46, 46],
    iconAnchor: [23, 23]
  });
}

export default function DriverRideMap({ driverLocation, passengerLocation, destinationLocation, status }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const driverMarkerRef = useRef(null);
  const targetMarkerRef = useRef(null);
  const routeLayerRef = useRef(null);
  const requestRef = useRef(0);
  const mountedRef = useRef(true);
  const [mapError, setMapError] = useState('');

  const driver = normalizeLocation(driverLocation);
  const passenger = normalizeLocation(passengerLocation);
  const destination = normalizeLocation(destinationLocation);
  const target = status === 'IN_PROGRESS' ? destination : passenger;

  useEffect(() => {
    mountedRef.current = true;
    let timer = null;
    try {
      if (!mapRef.current || mapInstanceRef.current) return undefined;
      timer = window.setTimeout(() => {
        if (!mountedRef.current || !mapRef.current || mapInstanceRef.current) return;
        try {
          const map = L.map(mapRef.current, { zoomControl: false, attributionControl: true, preferCanvas: true }).setView([-21.6136, -55.1684], 14);
          L.tileLayer(TILE_URL, { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors', updateWhenIdle: true }).addTo(map);
          L.control.zoom({ position: 'bottomright' }).addTo(map);
          mapInstanceRef.current = map;
          const resize = () => { try { map.invalidateSize(); } catch (_) {} };
          window.addEventListener('resize', resize);
          window.setTimeout(resize, 100);
          window.setTimeout(resize, 500);
          map.__pf17Resize = resize;
        } catch (error) {
          console.error('Driver map initialization failed:', error);
          if (mountedRef.current) setMapError('O mapa da corrida não pôde ser carregado. A corrida continua ativa.');
        }
      }, 0);
    } catch (error) {
      console.error('Driver map setup failed:', error);
      if (mountedRef.current) setMapError('O mapa da corrida não pôde ser carregado. A corrida continua ativa.');
    }
    return () => {
      mountedRef.current = false;
      if (timer) window.clearTimeout(timer);
      const map = mapInstanceRef.current;
      try {
        if (map?.__pf17Resize) window.removeEventListener('resize', map.__pf17Resize);
        if (map) map.remove();
      } catch (_) {}
      mapInstanceRef.current = null;
      driverMarkerRef.current = null;
      targetMarkerRef.current = null;
      routeLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return undefined;
    try {
      map.invalidateSize();
      if (driver) {
        if (!driverMarkerRef.current) driverMarkerRef.current = L.marker([driver.lat, driver.lng], { icon: pin('pf17-driver-self', '🚙'), zIndexOffset: 1200, title: 'Sua localização' }).addTo(map);
        else driverMarkerRef.current.setLatLng([driver.lat, driver.lng]);
        driverMarkerRef.current.bindTooltip('Você', { direction: 'top', offset: [0, -22] });
      } else if (driverMarkerRef.current) {
        driverMarkerRef.current.remove();
        driverMarkerRef.current = null;
      }
      if (target) {
        const inProgress = status === 'IN_PROGRESS';
        if (!targetMarkerRef.current) targetMarkerRef.current = L.marker([target.lat, target.lng], { icon: pin(inProgress ? 'pf17-destination' : 'pf17-passenger', inProgress ? '🏁' : '👤'), zIndexOffset: 1100, title: inProgress ? 'Destino' : 'Passageiro' }).addTo(map);
        else {
          targetMarkerRef.current.setLatLng([target.lat, target.lng]);
          targetMarkerRef.current.setIcon(pin(inProgress ? 'pf17-destination' : 'pf17-passenger', inProgress ? '🏁' : '👤'));
        }
        targetMarkerRef.current.bindTooltip(inProgress ? 'Destino' : 'Passageiro', { direction: 'top', offset: [0, -22] });
      } else if (targetMarkerRef.current) {
        targetMarkerRef.current.remove();
        targetMarkerRef.current = null;
      }
      const points = [driver, target].filter(Boolean).map((item) => [item.lat, item.lng]);
      if (points.length === 2) map.fitBounds(L.latLngBounds(points).pad(0.22), { animate: false, maxZoom: 16 });
      else if (driver) map.setView([driver.lat, driver.lng], Math.max(16, map.getZoom()), { animate: false });
      else if (target) map.setView([target.lat, target.lng], 15, { animate: false });
    } catch (error) {
      console.error('Driver map update failed:', error);
      if (mountedRef.current) setMapError('Não foi possível atualizar o mapa. A corrida continua ativa.');
    }
    return undefined;
  }, [driverLocation, passengerLocation, destinationLocation, status]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !driver || !target) return undefined;
    const requestId = ++requestRef.current;
    const controller = new AbortController();
    const draw = (coordinates, fallback) => {
      if (requestId !== requestRef.current) return;
      try {
        if (routeLayerRef.current) routeLayerRef.current.remove();
        const group = L.layerGroup();
        group.addLayer(L.polyline(coordinates, { color: '#111', weight: 10, opacity: 0.7, lineCap: 'round', lineJoin: 'round' }));
        group.addLayer(L.polyline(coordinates, { color: '#ff5a00', weight: fallback ? 5 : 5.5, opacity: 0.95, dashArray: fallback ? '9 8' : undefined, lineCap: 'round', lineJoin: 'round' }));
        group.addTo(map);
        routeLayerRef.current = group;
      } catch (error) {
        console.error('Driver route drawing failed:', error);
      }
    };
    const fallback = () => draw([[driver.lat, driver.lng], [target.lat, target.lng]], true);
    const url = `${ROUTE_URL}${driver.lng},${driver.lat};${target.lng},${target.lat}?overview=full&geometries=geojson&steps=false`;
    fetch(url, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('route')))
      .then((data) => {
        if (requestId !== requestRef.current) return;
        const coordinates = (data.routes?.[0]?.geometry?.coordinates || []).map(([lng, lat]) => [Number(lat), Number(lng)]).filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));
        if (coordinates.length >= 2) draw(coordinates, false); else fallback();
      })
      .catch((error) => { if (error?.name !== 'AbortError') fallback(); });
    return () => controller.abort();
  }, [driverLocation, passengerLocation, destinationLocation, status]);

  const inProgress = status === 'IN_PROGRESS';
  const searching = status === 'SEARCHING';
  return (
    <div className="driver-map-shell">
      <div className="driver-map-topbar"><span className="driver-map-live-dot" /><strong>{inProgress ? 'EM VIAGEM' : searching ? 'MAPA DO MOTORISTA' : 'A CAMINHO'}</strong><span>{inProgress ? 'Rota até o destino' : searching ? 'Sua localização' : 'Rota até o passageiro'}</span></div>
      <div ref={mapRef} className="driver-ride-map" />
      {mapError && <div className="driver-map-error">⚠️ {mapError}</div>}
      <div className="driver-map-caption"><b>{inProgress ? 'Destino da corrida' : searching ? 'Mapa ativo' : 'Ponto de embarque'}</b><span>Mapa OpenStreetMap • sem chave de API</span></div>
      <style>{`
        .driver-map-shell{position:relative;margin-top:14px;border-radius:22px;overflow:hidden;border:1px solid #303a41;background:#080b0d;box-shadow:0 20px 55px rgba(0,0,0,.56),inset 0 0 0 1px rgba(255,255,255,.025)}
        .driver-ride-map{height:420px;width:100%;z-index:1;background:#e8edf0}
        .driver-map-topbar{position:absolute;left:12px;right:12px;top:12px;z-index:500;display:flex;align-items:center;gap:8px;padding:10px 12px;border:1px solid rgba(255,255,255,.14);border-radius:14px;background:rgba(3,6,8,.86);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);box-shadow:0 10px 28px rgba(0,0,0,.38);font:800 10px/1 Arial,sans-serif;color:#fff;letter-spacing:.04em;text-transform:uppercase}
        .driver-map-topbar span:last-child{margin-left:auto;color:#c0c8cd;font-weight:700;letter-spacing:0;text-transform:none}.driver-map-live-dot{width:8px;height:8px;border-radius:50%;background:#27c96f;box-shadow:0 0 0 5px rgba(39,201,111,.12),0 0 14px rgba(39,201,111,.42)}
        .driver-map-caption{position:absolute;left:12px;right:12px;bottom:12px;z-index:500;display:flex;align-items:center;gap:8px;background:rgba(3,6,8,.92);color:#fff;border:1px solid rgba(255,90,0,.78);border-radius:15px;padding:10px 12px;box-shadow:0 8px 25px rgba(0,0,0,.42);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);font:800 12px/1.15 Arial,sans-serif}.driver-map-caption span{margin-left:auto;color:#c0c8cd;font-size:10px;font-weight:700}
        .driver-map-error{position:absolute;left:12px;right:12px;bottom:62px;z-index:600;background:rgba(127,29,29,.94);color:#fff;border:1px solid rgba(254,202,202,.45);border-radius:12px;padding:9px 11px;font:700 11px/1.3 Arial,sans-serif}
        .pf17-driver-pin-wrapper{background:transparent;border:0}.pf17-driver-pin{width:42px;height:42px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid #fff;box-shadow:0 7px 22px rgba(0,0,0,.45);font-size:19px}.pf17-driver-self{background:#111820}.pf17-passenger,.pf17-destination{background:#ff5a00;box-shadow:0 7px 22px rgba(255,90,0,.38),0 0 0 6px rgba(255,90,0,.10)}
        .driver-map-shell .leaflet-control-zoom{border:1px solid #303a41!important;border-radius:12px!important;overflow:hidden;box-shadow:0 10px 25px rgba(0,0,0,.35)!important;margin-right:12px!important;margin-bottom:78px!important}.driver-map-shell .leaflet-control-zoom a{width:40px!important;height:40px!important;line-height:38px!important;background:rgba(5,8,10,.92)!important;color:#fff!important;border:0!important;border-bottom:1px solid #303a41!important;font-weight:900!important}.driver-map-shell .leaflet-control-zoom a:last-child{border-bottom:0!important}.driver-map-shell .leaflet-control-zoom a:hover{background:#ff5a00!important;color:#fff!important}.driver-map-shell .leaflet-control-attribution{background:rgba(255,255,255,.86)!important;color:#55616a!important;font-size:9px!important}.driver-map-shell .leaflet-control-attribution a{color:#d84f00!important}
        @media(max-width:640px){.driver-ride-map{height:335px}.driver-map-topbar{top:10px;left:10px;right:10px}.driver-map-caption{left:10px;right:10px;bottom:10px}.driver-map-caption span{display:none}}
      `}</style>
    </div>
  );
}
