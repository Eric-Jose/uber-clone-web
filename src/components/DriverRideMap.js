import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const ROUTE_URL = 'https://router.project-osrm.org/route/v1/driving/';
const CARTO_DARK_TILES = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

function normalizeLocation(value) {
  if (!value) return null;
  const source = value.location || value.currentLocation || value;
  const lat = Number(source.lat ?? source.latitude);
  const lng = Number(source.lng ?? source.longitude);
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
    const map = L.map(mapRef.current, {
      zoomControl: true,
      attributionControl: true,
      zoomSnap: 0.5,
      zoomDelta: 0.5,
      preferCanvas: true,
    });
    L.tileLayer(CARTO_DARK_TILES, {
      maxZoom: 20,
      subdomains: 'abcd',
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      crossOrigin: true,
    }).addTo(map);
    map.setView([-14.235, -51.925], 5);
    mapInstanceRef.current = map;
    const resizeTimer = setTimeout(() => map.invalidateSize(), 160);
    return () => {
      clearTimeout(resizeTimer);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      driverMarkerRef.current = null;
      targetMarkerRef.current = null;
      routeLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    map.invalidateSize();

    const markerIcon = (className, label) => L.divIcon({
      className: 'driver-map-pin-wrapper',
      html: `<div class="driver-map-pin ${className}"><span>${label}</span></div>`,
      iconSize: [48, 48],
      iconAnchor: [24, 24],
    });

    if (driver) {
      if (!driverMarkerRef.current) {
        driverMarkerRef.current = L.marker([driver.lat, driver.lng], {
          icon: markerIcon('driver-pin', '🚙'),
          zIndexOffset: 1000,
        }).addTo(map);
      } else {
        driverMarkerRef.current.setLatLng([driver.lat, driver.lng]);
      }
      driverMarkerRef.current.bindTooltip('Você', {
        direction: 'top',
        offset: [0, -22],
        opacity: 0.96,
        className: 'driver-map-tooltip',
      });
    }

    if (target) {
      const isDestination = status === 'IN_PROGRESS';
      const label = isDestination ? '🏁' : '👤';
      const title = isDestination ? 'Destino' : 'Passageiro';
      const pinClass = isDestination ? 'destination-pin' : 'passenger-pin';
      if (!targetMarkerRef.current) {
        targetMarkerRef.current = L.marker([target.lat, target.lng], {
          icon: markerIcon(pinClass, label),
          zIndexOffset: 900,
        }).addTo(map);
      } else {
        targetMarkerRef.current.setLatLng([target.lat, target.lng]);
        targetMarkerRef.current.setIcon(markerIcon(pinClass, label));
      }
      targetMarkerRef.current.bindTooltip(title, {
        direction: 'top',
        offset: [0, -22],
        opacity: 0.96,
        className: 'driver-map-tooltip',
      });
    } else if (targetMarkerRef.current) {
      targetMarkerRef.current.remove();
      targetMarkerRef.current = null;
    }

    const points = [driver, target].filter(Boolean).map((item) => [item.lat, item.lng]);
    if (points.length === 2) {
      map.fitBounds(L.latLngBounds(points).pad(0.25), { animate: true, maxZoom: 16 });
    } else if (driver) {
      map.setView([driver.lat, driver.lng], Math.max(map.getZoom(), 15), { animate: true });
    } else if (target) {
      map.setView([target.lat, target.lng], 15, { animate: true });
    }
  }, [driverLocation, passengerLocation, destinationLocation, status]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !driver || !target) return undefined;
    const requestId = ++routeRequestRef.current;
    const controller = new AbortController();

    const drawRoute = (latLngs, fallback = false) => {
      if (requestId !== routeRequestRef.current) return;
      if (routeLayerRef.current) routeLayerRef.current.remove();
      const group = L.layerGroup();
      group.addLayer(L.polyline(latLngs, {
        color: '#090c0f',
        weight: 11,
        opacity: 0.72,
        lineCap: 'round',
        lineJoin: 'round',
      }));
      group.addLayer(L.polyline(latLngs, {
        color: '#ff6b00',
        weight: fallback ? 5 : 6,
        opacity: 0.98,
        dashArray: fallback ? '10 8' : undefined,
        lineCap: 'round',
        lineJoin: 'round',
      }));
      group.addTo(map);
      routeLayerRef.current = group;
    };

    const fallback = () => drawRoute([[driver.lat, driver.lng], [target.lat, target.lng]], true);
    const url = `${ROUTE_URL}${driver.lng},${driver.lat};${target.lng},${target.lat}?overview=full&geometries=geojson&steps=false`;

    fetch(url, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Rota indisponível')))
      .then((data) => {
        if (requestId !== routeRequestRef.current) return;
        const coordinates = data.routes?.[0]?.geometry?.coordinates || [];
        const latLngs = coordinates
          .map(([lng, lat]) => [Number(lat), Number(lng)])
          .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));
        if (!latLngs.length) {
          fallback();
          return;
        }
        drawRoute(latLngs, false);
      })
      .catch((error) => {
        if (error?.name !== 'AbortError') fallback();
      });

    return () => controller.abort();
  }, [driverLocation, passengerLocation, destinationLocation, status]);

  const caption = status === 'IN_PROGRESS' ? 'Rota até o destino' : 'Rota até o passageiro';
  const subcaption = status === 'IN_PROGRESS' ? 'Corrida em andamento' : 'A caminho do embarque';

  return (
    <div className="driver-map-shell">
      <div className="driver-map-topbar">
        <span className="driver-map-live-dot" />
        <strong>{status === 'IN_PROGRESS' ? 'EM VIAGEM' : 'A CAMINHO'}</strong>
        <span>{subcaption}</span>
      </div>
      <div ref={mapRef} className="driver-ride-map" />
      <div className="driver-map-caption">
        <b>{caption}</b>
        <span>{status === 'IN_PROGRESS' ? 'Siga a rota destacada' : 'Chegue ao ponto de embarque'}</span>
      </div>
      <style>{`
        .driver-map-shell{position:relative;margin-top:14px;border-radius:22px;overflow:hidden;border:1px solid #303a41;background:#080b0d;box-shadow:0 20px 55px rgba(0,0,0,.56),inset 0 0 0 1px rgba(255,255,255,.025)}
        .driver-ride-map{height:420px;width:100%;z-index:1;background:#0b1014}
        .driver-map-topbar{position:absolute;left:12px;right:12px;top:12px;z-index:500;display:flex;align-items:center;gap:8px;padding:10px 12px;border:1px solid rgba(255,255,255,.09);border-radius:14px;background:rgba(3,6,8,.82);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);box-shadow:0 10px 28px rgba(0,0,0,.38);font:800 10px/1 Arial,sans-serif;color:#fff;letter-spacing:.04em;text-transform:uppercase}
        .driver-map-topbar span:last-child{margin-left:auto;color:#aab4ba;font-weight:700;letter-spacing:0;text-transform:none}
        .driver-map-live-dot{width:8px;height:8px;border-radius:50%;background:#27c96f;box-shadow:0 0 0 5px rgba(39,201,111,.12),0 0 14px rgba(39,201,111,.42)}
        .driver-map-caption{position:absolute;left:12px;right:12px;bottom:12px;z-index:500;display:flex;align-items:center;gap:8px;background:rgba(3,6,8,.91);color:#fff;border:1px solid rgba(255,107,0,.74);border-radius:15px;padding:10px 12px;box-shadow:0 8px 25px rgba(0,0,0,.42);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);font:800 12px/1.15 Arial,sans-serif}
        .driver-map-caption b{font-size:12px}.driver-map-caption span{margin-left:auto;color:#c0c8cd;font-size:10px;font-weight:700}
        .driver-map-pin-wrapper{background:transparent;border:0}.driver-map-pin{position:relative;width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid #fff;box-shadow:0 7px 22px rgba(0,0,0,.48),0 0 0 6px rgba(255,255,255,.08);font-size:20px}.driver-map-pin span{transform:translateY(-1px)}.driver-pin{background:#111820}.driver-pin::after{content:"";position:absolute;inset:-10px;border:1px solid rgba(255,107,0,.34);border-radius:50%}.passenger-pin,.destination-pin{background:#ff6b00;box-shadow:0 7px 22px rgba(255,107,0,.34),0 0 0 6px rgba(255,107,0,.10)}
        .driver-map-tooltip{background:#05080a!important;color:#fff!important;border:1px solid #303a41!important;border-radius:9px!important;box-shadow:0 8px 20px rgba(0,0,0,.45)!important;font:800 11px/1 Arial,sans-serif!important;padding:6px 8px!important}.driver-map-tooltip:before{border-top-color:#05080a!important}
        .driver-map-shell .leaflet-control-zoom{border:1px solid #303a41!important;border-radius:12px!important;overflow:hidden;box-shadow:0 10px 25px rgba(0,0,0,.46)!important;margin-top:74px!important;margin-right:12px!important}.driver-map-shell .leaflet-control-zoom a{width:40px!important;height:40px!important;line-height:38px!important;background:rgba(5,8,10,.92)!important;color:#fff!important;border:0!important;border-bottom:1px solid #303a41!important;font-weight:900!important}.driver-map-shell .leaflet-control-zoom a:last-child{border-bottom:0!important}.driver-map-shell .leaflet-control-zoom a:hover{background:#ff6b00!important;color:#fff!important}
        .driver-map-shell .leaflet-control-attribution{background:rgba(3,6,8,.70)!important;color:#7f8b93!important;font-size:9px!important}.driver-map-shell .leaflet-control-attribution a{color:#ff8b1f!important}
        .driver-map-shell .leaflet-tile-pane{filter:none!important}
        @media(max-width:640px){.driver-ride-map{height:335px}.driver-map-topbar{top:10px;left:10px;right:10px}.driver-map-caption{left:10px;right:10px;bottom:10px}.driver-map-caption span{display:none}.driver-map-shell .leaflet-control-zoom{margin-top:68px!important;margin-right:9px!important}}
      `}</style>
    </div>
  );
}

// O painel do motorista precisa ter um mapa mesmo antes de existir uma corrida.
// Este mapa leve é montado no fluxo do painel e desaparece quando o mapa da corrida
// já está presente. Assim o motorista vê sua posição/GPS e, ao aceitar, a rota passa
// automaticamente para o componente completo acima.
let idleDriverMapStarted = false;

function startIdleDriverMap() {
  if (idleDriverMapStarted || typeof window === 'undefined' || typeof document === 'undefined') return;
  idleDriverMapStarted = true;

  let map = null;
  let marker = null;
  let targetMarker = null;
  let routeLayer = null;
  let watchId = null;
  let lastDriver = null;
  let activeRideId = null;
  let routeSeq = 0;
  let pollTimer = null;
  let observer = null;

  const getUser = () => {
    try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch (_) { return null; }
  };
  const getToken = () => localStorage.getItem('token');
  const isDriverPanel = () => !!document.querySelector('.driver-pro');
  const realRideMapExists = () => !!document.querySelector('.driver-pro .driver-map-shell');

  const ensureHost = () => {
    if (!isDriverPanel() || realRideMapExists()) return null;
    let host = document.getElementById('pf17-driver-live-map');
    if (!host) {
      const panel = document.querySelector('.driver-pro');
      const firstBox = panel && panel.querySelector('.driver-box');
      if (!panel) return null;
      host = document.createElement('div');
      host.id = 'pf17-driver-live-map';
      host.className = 'driver-idle-map-shell';
      host.innerHTML = '<div class="driver-idle-map-head"><span><i></i> MAPA DO MOTORISTA</span><b>GPS EM TEMPO REAL</b></div><div class="driver-idle-map-canvas"></div><div class="driver-idle-map-foot"><strong>🚘 Sua posição</strong><span>Fique online para receber corridas próximas</span></div>';
      if (firstBox && firstBox.parentNode) firstBox.parentNode.insertBefore(host, firstBox.nextSibling);
      else panel.appendChild(host);
    }
    return host;
  };

  const clearRoute = () => {
    if (routeLayer && map) map.removeLayer(routeLayer);
    routeLayer = null;
  };

  const drawRoute = async (driver, target) => {
    if (!map || !driver || !target) return;
    const seq = ++routeSeq;
    clearRoute();
    const controller = new AbortController();
    try {
      const url = `${ROUTE_URL}${driver.lng},${driver.lat};${target.lng},${target.lat}?overview=full&geometries=geojson&steps=false`;
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error('route');
      const data = await response.json();
      if (seq !== routeSeq) return;
      const coords = data.routes?.[0]?.geometry?.coordinates || [];
      const points = coords.map(([lng, lat]) => [Number(lat), Number(lng)]).filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));
      const finalPoints = points.length > 1 ? points : [[driver.lat, driver.lng], [target.lat, target.lng]];
      routeLayer = L.layerGroup([
        L.polyline(finalPoints, { color:'#05080a', weight:10, opacity:.78, lineCap:'round', lineJoin:'round' }),
        L.polyline(finalPoints, { color:'#ff6b00', weight:5, opacity:.98, lineCap:'round', lineJoin:'round' })
      ]).addTo(map);
      map.fitBounds(L.latLngBounds(finalPoints).pad(.22), { animate:true, maxZoom:16 });
    } catch (_) {
      if (seq !== routeSeq) return;
      const points = [[driver.lat, driver.lng], [target.lat, target.lng]];
      routeLayer = L.polyline(points, { color:'#ff6b00', weight:5, dashArray:'10 8', lineCap:'round' }).addTo(map);
      map.fitBounds(L.latLngBounds(points).pad(.22), { animate:true, maxZoom:16 });
    }
  };

  const updateTarget = (ride) => {
    if (!map) return;
    const status = ride && ride.status;
    const source = status === 'IN_PROGRESS' ? ride?.destination?.location : (ride?.passengerLocation || ride?.origin?.location);
    const target = normalizeLocation(source);
    if (!target) {
      if (targetMarker) { map.removeLayer(targetMarker); targetMarker = null; }
      clearRoute();
      return;
    }
    if (!targetMarker) {
      targetMarker = L.circleMarker([target.lat,target.lng], { radius:10, color:'#fff', weight:3, fillColor:status === 'IN_PROGRESS' ? '#27c96f' : '#ff6b00', fillOpacity:1 }).addTo(map);
    } else {
      targetMarker.setLatLng([target.lat,target.lng]);
      targetMarker.setStyle({ fillColor:status === 'IN_PROGRESS' ? '#27c96f' : '#ff6b00' });
    }
    if (lastDriver) drawRoute(lastDriver, target);
  };

  const updateDriver = (loc) => {
    if (!map || !loc) return;
    lastDriver = loc;
    if (!marker) {
      marker = L.circleMarker([loc.lat,loc.lng], { radius:10, color:'#fff', weight:3, fillColor:'#ff6b00', fillOpacity:1 }).addTo(map);
      marker.bindTooltip('Você', { direction:'top', opacity:.95 });
    } else marker.setLatLng([loc.lat,loc.lng]);
    if (!targetMarker) map.setView([loc.lat,loc.lng], 16, { animate:true });
  };

  const initMap = () => {
    const host = ensureHost();
    if (!host || map) return;
    const canvas = host.querySelector('.driver-idle-map-canvas');
    if (!canvas) return;
    map = L.map(canvas, { zoomControl:true, attributionControl:true, preferCanvas:true, zoomControl:false }).setView([-14.235,-51.925],5);
    L.tileLayer(CARTO_DARK_TILES, { maxZoom:20, subdomains:'abcd', attribution:'&copy; OpenStreetMap contributors &copy; CARTO' }).addTo(map);
    L.control.zoom({ position:'topright' }).addTo(map);
    setTimeout(() => map && map.invalidateSize(), 100);
  };

  const pollRide = async () => {
    if (!isDriverPanel() || realRideMapExists()) return;
    const token = getToken();
    if (!token) return;
    try {
      const response = await fetch(`${window.__PF17_BACKEND_URL__ || ''}/api/rides/active`, { headers:{ Authorization:`Bearer ${token}` } });
      if (!response.ok) return;
      const data = await response.json();
      const ride = data && data.ride;
      if (!ride) {
        activeRideId = null;
        if (targetMarker && map) { map.removeLayer(targetMarker); targetMarker=null; }
        clearRoute();
        return;
      }
      activeRideId = ride.id;
      updateTarget(ride);
    } catch (_) {}
  };

  const startGps = () => {
    if (watchId !== null || !navigator.geolocation) return;
    watchId = navigator.geolocation.watchPosition((position) => {
      const loc = { lat:Number(position.coords.latitude), lng:Number(position.coords.longitude) };
      if (!Number.isFinite(loc.lat) || !Number.isFinite(loc.lng)) return;
      updateDriver(loc);
      if (activeRideId) pollRide();
    }, () => {}, { enableHighAccuracy:true, maximumAge:1500, timeout:10000 });
  };

  const refresh = () => {
    const host = ensureHost();
    if (!host) return;
    if (realRideMapExists()) { host.style.display='none'; return; }
    host.style.display='block';
    initMap();
    if (map) map.invalidateSize();
    startGps();
  };

  const boot = () => {
    const user = getUser();
    if (!user || user.userType !== 'driver') return;
    refresh();
    if (!pollTimer) pollTimer = window.setInterval(refresh, 1500);
    window.setInterval(pollRide, 2500);
    observer = new MutationObserver(refresh);
    observer.observe(document.body, { childList:true, subtree:true });
  };

  window.setTimeout(boot, 500);
}

startIdleDriverMap();
