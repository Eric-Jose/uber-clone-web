import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const ROUTE_URL = 'https://router.project-osrm.org/route/v1/driving/';

function normalizeLocation(value) {
  if (!value) return null;
  const lat = Number(value.lat ?? value.latitude);
  const lng = Number(value.lng ?? value.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

export default function DriverRideMap({ driverLocation, passengerLocation, destinationLocation, status }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const driverMarkerRef = useRef(null);
  const targetMarkerRef = useRef(null);
  const routeLayerRef = useRef(null);
  const routeRequestRef = useRef(0);

  const driver = normalizeLocation(driverLocation);
  const passenger = normalizeLocation(passengerLocation);
  const destination = normalizeLocation(destinationLocation);
  const target = status === 'IN_PROGRESS' ? destination : passenger;

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return undefined;
    const map = L.map(mapRef.current, { zoomControl: true, attributionControl: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(map);
    map.setView([-14.235, -51.925], 5);
    mapInstanceRef.current = map;
    const resizeTimer = setTimeout(() => map.invalidateSize(), 120);
    return () => { clearTimeout(resizeTimer); if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; } driverMarkerRef.current = null; targetMarkerRef.current = null; routeLayerRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    map.invalidateSize();
    const markerIcon = (className, label) => L.divIcon({ className: 'driver-map-pin-wrapper', html: `<div class="driver-map-pin ${className}">${label}</div>`, iconSize: [40, 40], iconAnchor: [20, 20] });
    if (driver) {
      if (!driverMarkerRef.current) driverMarkerRef.current = L.marker([driver.lat, driver.lng], { icon: markerIcon('driver-pin', '🚙') }).addTo(map);
      else driverMarkerRef.current.setLatLng([driver.lat, driver.lng]);
      driverMarkerRef.current.bindTooltip('Você', { direction: 'top', offset: [0, -18] });
    }
    if (target) {
      const label = status === 'IN_PROGRESS' ? '🏁' : '👤';
      const title = status === 'IN_PROGRESS' ? 'Destino' : 'Passageiro';
      if (!targetMarkerRef.current) targetMarkerRef.current = L.marker([target.lat, target.lng], { icon: markerIcon(status === 'IN_PROGRESS' ? 'destination-pin' : 'passenger-pin', label) }).addTo(map);
      else { targetMarkerRef.current.setLatLng([target.lat, target.lng]); targetMarkerRef.current.setIcon(markerIcon(status === 'IN_PROGRESS' ? 'destination-pin' : 'passenger-pin', label)); }
      targetMarkerRef.current.bindTooltip(title, { direction: 'top', offset: [0, -18] });
    }
    const points = [driver, target].filter(Boolean).map((item) => [item.lat, item.lng]);
    if (points.length === 2) map.fitBounds(L.latLngBounds(points).pad(0.25), { animate: true, maxZoom: 16 });
    else if (driver) map.setView([driver.lat, driver.lng], Math.max(map.getZoom(), 15), { animate: true });
    else if (target) map.setView([target.lat, target.lng], 15, { animate: true });
  }, [driverLocation, passengerLocation, destinationLocation, status]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !driver || !target) return undefined;
    const requestId = ++routeRequestRef.current;
    const controller = new AbortController();
    const fallback = () => {
      if (requestId !== routeRequestRef.current) return;
      if (routeLayerRef.current) routeLayerRef.current.remove();
      routeLayerRef.current = L.polyline([[driver.lat, driver.lng], [target.lat, target.lng]], { color: '#ff6a00', weight: 6, opacity: 0.9, dashArray: '10 8', lineCap: 'round', lineJoin: 'round' }).addTo(map);
    };
    const url = `${ROUTE_URL}${driver.lng},${driver.lat};${target.lng},${target.lat}?overview=full&geometries=geojson&steps=false`;
    fetch(url, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Rota indisponível')))
      .then((data) => {
        if (requestId !== routeRequestRef.current || !data.routes || !data.routes[0]) { fallback(); return; }
        const coordinates = data.routes[0].geometry?.coordinates || [];
        const latLngs = coordinates.map(([lng, lat]) => [lat, lng]).filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));
        if (!latLngs.length) { fallback(); return; }
        if (routeLayerRef.current) routeLayerRef.current.remove();
        routeLayerRef.current = L.polyline(latLngs, { color: '#ff6a00', weight: 6, opacity: 0.9, lineCap: 'round', lineJoin: 'round' }).addTo(map);
      })
      .catch(() => fallback());
    return () => controller.abort();
  }, [driverLocation, passengerLocation, destinationLocation, status]);

  return <div className="driver-map-shell"><div ref={mapRef} className="driver-ride-map" /><div className="driver-map-caption">{status === 'IN_PROGRESS' ? 'Rota até o destino' : 'Rota até o passageiro'}</div><style>{`.driver-map-shell{position:relative;margin-top:14px;border-radius:18px;overflow:hidden;border:1px solid #e5e7eb;background:#eef2f7;box-shadow:0 8px 24px rgba(0,0,0,.08)}.driver-ride-map{height:390px;width:100%;z-index:1}.driver-map-caption{position:absolute;left:12px;bottom:12px;z-index:500;background:#111827;color:#fff;border-radius:999px;padding:9px 13px;font:800 12px/1 Arial,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.2)}.driver-map-pin-wrapper{background:transparent;border:0}.driver-map-pin{width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid #fff;box-shadow:0 3px 12px rgba(0,0,0,.3);font-size:19px}.driver-pin{background:#111827}.passenger-pin{background:#ff6a00}.destination-pin{background:#dc2626}@media(max-width:640px){.driver-ride-map{height:320px}.driver-map-caption{font-size:11px}}`}</style></div>;
}
