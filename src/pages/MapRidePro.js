import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import WebSocketService from '../services/WebSocketService';
import { BACKEND_URL as B } from '../config';
import precoFixo17Car from '../assets/precoFixo17Car';
import '../styles/PrecoFixo17Reference.css';

const NOMINATIM = 'https://nominatim.openstreetmap.org';
const PHOTON = 'https://photon.komoot.io/api/';
const OSRM = 'https://router.project-osrm.org/route/v1/driving';
const FIXED_RIDE_PRICE = 17;

// Default Mockup Locations (São Paulo Centro / Jardim das Flores)
const DEFAULT_ORIGIN = { lat: -23.5505, lng: -46.6333, address: 'Av. das Palmeiras, 123 - Centro' };
const DEFAULT_DESTINATION = { lat: -23.5615, lng: -46.6560, address: 'Rua dos Ipês, 456 - Jardim das Flores' };

export default function MapRidePro({ onRideCreate, onBack, onNavigate, onOpenMenu, onOpenNotifications }) {
  const mapEl = useRef(null);
  const map = useRef(null);
  const userMarker = useRef(null);
  const destMarker = useRef(null);
  const carMarker = useRef(null);
  const routeLayer = useRef(null);
  const carAnimTimer = useRef(null);

  // Flow State: 'plan' (Screen 2) | 'arriving' (Screen 3) | 'in_progress' (Screen 4)
  const [stage, setStage] = useState('plan');

  // Route details
  const [origin, setOrigin] = useState(DEFAULT_ORIGIN);
  const [destination, setDestination] = useState(DEFAULT_DESTINATION.address);
  const [destinationCoords, setDestinationCoords] = useState(DEFAULT_DESTINATION);
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [distanceKm, setDistanceKm] = useState(3.5);
  const [durationMin, setDurationMin] = useState(8);

  // Options
  const [paymentMethod, setPaymentMethod] = useState('Dinheiro');
  const [promoCode, setPromoCode] = useState('Nenhuma');
  const [passengerCount, setPassengerCount] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Modals
  const [modalType, setModalType] = useState(null); // 'payment' | 'promo' | 'passengers' | 'message'
  const [chatMessage, setChatMessage] = useState('');
  const [chatMessages, setChatMessages] = useState([
    { from: 'driver', text: 'Olá! Estou a caminho do seu local de embarque.', time: '14:28' }
  ]);

  // Driver details (matching Carlos Ferreira from mockup Screen 3)
  const [driver] = useState({
    name: 'Carlos Ferreira',
    photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    rating: 4.9,
    ridesCount: 324,
    vehicle: 'Chevrolet Onix',
    plate: 'ABC-1234',
    phone: '(11) 98765-4321'
  });

  // Timers for in-progress & arriving
  const [etaMinutes, setEtaMinutes] = useState(2);
  const [elapsedTime, setElapsedTime] = useState('08:24');

  // 1. Initialize Leaflet Map
  useEffect(() => {
    if (!mapEl.current || map.current) return;

    const mapInstance = L.map(mapEl.current, {
      zoomControl: false,
      attributionControl: false
    }).setView([DEFAULT_ORIGIN.lat, DEFAULT_ORIGIN.lng], 15);

    // Dark carto tiles matching the reference mockup
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd'
    }).addTo(mapInstance);

    L.control.zoom({ position: 'bottomright' }).addTo(mapInstance);
    map.current = mapInstance;

    // Draw initial sample route
    renderRoute(DEFAULT_ORIGIN, DEFAULT_DESTINATION);

    // Try real geolocation
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const userLoc = { lat, lng, address: 'Sua localização atual' };
          setOrigin(userLoc);
          mapInstance.setView([lat, lng], 15);
        },
        () => {},
        { timeout: 6000 }
      );
    }

    return () => {
      clearTimeout(carAnimTimer.current);
      mapInstance.remove();
      map.current = null;
    };
  }, []);

  // 2. Render route on map
  const renderRoute = async (start, end) => {
    if (!map.current) return;

    // Remove existing layers
    if (routeLayer.current) routeLayer.current.remove();
    if (userMarker.current) userMarker.current.remove();
    if (destMarker.current) destMarker.current.remove();
    if (carMarker.current) carMarker.current.remove();

    // Origin marker (Green circle with glow)
    const originIcon = L.divIcon({
      className: 'pf-origin-pin-icon',
      html: `<div style="width: 18px; height: 18px; border-radius: 50%; background: #22c55e; border: 3px solid #ffffff; box-shadow: 0 0 12px rgba(34, 197, 94, 0.8);"></div>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9]
    });
    userMarker.current = L.marker([start.lat, start.lng], { icon: originIcon }).addTo(map.current);

    // Destination marker (Orange circle with glow)
    const destIcon = L.divIcon({
      className: 'pf-dest-pin-icon',
      html: `<div style="width: 18px; height: 18px; border-radius: 50%; background: #ff5a00; border: 3px solid #ffffff; box-shadow: 0 0 12px rgba(255, 90, 0, 0.8);"></div>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9]
    });
    destMarker.current = L.marker([end.lat, end.lng], { icon: destIcon }).addTo(map.current);

    // Moving Car marker with speech bubble (Screen 2: "Motorista parceiro a caminho!")
    const midLat = (start.lat + end.lat) / 2 + 0.001;
    const midLng = (start.lng + end.lng) / 2;

    const carHtml = `
      <div style="position: relative; display: flex; flex-direction: column; align-items: center;">
        <div style="background: #0f1216; border: 1px solid #ff5a00; color: #ffffff; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 999px; white-space: nowrap; box-shadow: 0 4px 14px rgba(0,0,0,0.6); margin-bottom: 6px;">
          🚗 Motorista parceiro a caminho!
        </div>
        <div style="width: 32px; height: 32px; border-radius: 50%; background: #ff5a00; border: 2px solid #ffffff; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 16px rgba(255, 90, 0, 0.9); font-size: 16px;">
          🚕
        </div>
      </div>
    `;
    const carIcon = L.divIcon({
      className: 'pf-car-pin-icon',
      html: carHtml,
      iconSize: [180, 70],
      iconAnchor: [90, 65]
    });
    carMarker.current = L.marker([midLat, midLng], { icon: carIcon }).addTo(map.current);

    // Fetch OSRM route geometry
    try {
      const resp = await fetch(`${OSRM}/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`);
      if (resp.ok) {
        const data = await resp.json();
        const route = data.routes?.[0];
        if (route?.geometry) {
          routeLayer.current = L.geoJSON(route.geometry, {
            style: {
              color: '#ff5a00',
              weight: 5.5,
              opacity: 0.95,
              lineCap: 'round',
              lineJoin: 'round'
            }
          }).addTo(map.current);

          setDistanceKm(Number((route.distance / 1000).toFixed(1)));
          setDurationMin(Math.max(3, Math.ceil(route.duration / 60)));
          map.current.fitBounds(routeLayer.current.getBounds(), { padding: [80, 80] });
          return;
        }
      }
    } catch (_) {}

    // Fallback line
    routeLayer.current = L.polyline([[start.lat, start.lng], [end.lat, end.lng]], {
      color: '#ff5a00',
      weight: 5,
      opacity: 0.9
    }).addTo(map.current);
    map.current.fitBounds(routeLayer.current.getBounds(), { padding: [80, 80] });
  };

  // 3. Search addresses
  const handleSearch = (value) => {
    setDestination(value);
    if (value.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    setSearching(true);
    const q = encodeURIComponent(value.trim());
    fetch(`${NOMINATIM}/search?format=jsonv2&q=${q}&countrycodes=br&limit=5`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setSuggestions(data);
      })
      .catch(() => {})
      .finally(() => setSearching(false));
  };

  const handleSelectDestination = (item) => {
    const lat = parseFloat(item.lat);
    const lng = parseFloat(item.lon);
    const dest = { lat, lng, address: item.display_name };
    setDestination(item.display_name);
    setDestinationCoords(dest);
    setSuggestions([]);
    renderRoute(origin, dest);
  };

  // 4. Ride request action (Screen 2 -> Screen 3)
  const handleRequestRide = async () => {
    setBusy(true);
    setError('');

    // Attempt real backend call
    const token = localStorage.getItem('token');
    if (token) {
      try {
        await fetch(`${B}/api/rides/request`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            origin: { address: origin.address, location: { lat: origin.lat, lng: origin.lng } },
            destination: { address: destination, location: { lat: destinationCoords.lat, lng: destinationCoords.lng } },
            price: FIXED_RIDE_PRICE,
            distance: distanceKm
          })
        });
      } catch (_) {}
    }

    // Advance to Screen 3: "Motorista chegando"
    setTimeout(() => {
      setBusy(false);
      setStage('arriving');
      setEtaMinutes(2);

      // Auto advance to "in_progress" after 6 seconds if user watches, or can click directly
      carAnimTimer.current = setTimeout(() => {
        setStage('in_progress');
      }, 7000);
    }, 800);
  };

  // 5. Cancel ride (Screen 3 -> Screen 2)
  const handleCancelRide = () => {
    clearTimeout(carAnimTimer.current);
    setStage('plan');
  };

  // 6. Finish ride (Screen 4 -> Screen 5 Payment)
  const handleFinishRide = () => {
    clearTimeout(carAnimTimer.current);
    if (typeof onNavigate === 'function') {
      onNavigate('payment');
    } else {
      setStage('plan');
    }
  };

  // Send message in chat
  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!chatMessage.trim()) return;
    setChatMessages((prev) => [
      ...prev,
      { from: 'me', text: chatMessage.trim(), time: 'agora' }
    ]);
    setChatMessage('');
  };

  return (
    <div className="pf-map-screen">
      <style>{`
        .pf-map-screen {
          position: relative;
          width: 100%;
          height: 100vh;
          overflow: hidden;
          background: #050505;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          color: #ffffff;
        }
        .pf-map-canvas {
          position: absolute;
          inset: 0;
          z-index: 1;
        }

        /* Top Header */
        .pf-map-topbar {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 56px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 16px;
          background: rgba(5, 5, 5, 0.85);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          z-index: 1000;
        }
        .pf-map-icon-btn {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: #111418;
          border: 1px solid #242a34;
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          position: relative;
          transition: background 0.15s ease;
        }
        .pf-map-icon-btn:hover { background: #1a2029; }
        .pf-map-bell-badge {
          position: absolute;
          top: 4px;
          right: 4px;
          background: #ef4444;
          color: #ffffff;
          font-size: 10px;
          font-weight: 800;
          min-width: 16px;
          height: 16px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0 4px;
        }
        .pf-map-logo {
          font-size: 19px;
          font-weight: 900;
          font-style: italic;
          letter-spacing: -0.02em;
        }
        .pf-map-logo span { color: #ffffff; }
        .pf-map-logo b { color: #ff5a00; }

        /* SCREEN 2: Route Input Card */
        .pf-route-card {
          position: absolute;
          top: 68px;
          left: 16px;
          right: 16px;
          max-width: 480px;
          margin: 0 auto;
          background: rgba(15, 18, 22, 0.94);
          backdrop-filter: blur(16px);
          border: 1px solid #242a34;
          border-radius: 20px;
          padding: 14px 16px;
          z-index: 1000;
          box-shadow: 0 16px 40px rgba(0, 0, 0, 0.6);
        }
        .pf-route-row {
          display: flex;
          align-items: center;
          gap: 12px;
          position: relative;
        }
        .pf-route-pin {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .pf-route-pin.green {
          background: #22c55e;
          box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.25);
        }
        .pf-route-pin.orange {
          background: #ff5a00;
          box-shadow: 0 0 0 3px rgba(255, 90, 0, 0.25);
        }
        .pf-route-line {
          width: 2px;
          height: 20px;
          background: #2d3644;
          margin-left: 5px;
          margin-top: 2px;
          margin-bottom: 2px;
        }
        .pf-route-input-group {
          flex: 1;
          display: flex;
          flex-direction: column;
        }
        .pf-route-label {
          font-size: 11px;
          color: #7e8b9b;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .pf-route-val {
          background: transparent;
          border: none;
          color: #ffffff;
          font-size: 14px;
          font-weight: 600;
          outline: none;
          padding: 2px 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .pf-route-add-btn {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: #19202a;
          border: 1px solid #333d4e;
          color: #8e98a5;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-size: 16px;
        }
        .pf-route-add-btn:hover { color: #ffffff; background: #222b38; }

        /* SCREEN 2: Bottom Sheet */
        .pf-bottom-sheet {
          position: absolute;
          bottom: 16px;
          left: 16px;
          right: 16px;
          max-width: 480px;
          margin: 0 auto;
          background: rgba(15, 18, 22, 0.96);
          backdrop-filter: blur(16px);
          border: 1px solid #242a34;
          border-radius: 24px;
          padding: 18px;
          z-index: 1000;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.7);
        }
        .pf-sheet-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 14px;
        }
        .pf-sheet-car-thumb {
          width: 105px;
          height: auto;
          filter: drop-shadow(0 6px 12px rgba(0, 0, 0, 0.7));
          border-radius: 8px;
        }
        .pf-sheet-price-box {
          text-align: right;
        }
        .pf-sheet-price-label {
          font-size: 13px;
          color: #8e98a5;
          margin-bottom: 2px;
        }
        .pf-sheet-price-val {
          font-size: 28px;
          font-weight: 900;
          color: #ff5a00;
          letter-spacing: -0.02em;
        }
        .pf-sheet-chips {
          display: flex;
          gap: 8px;
          margin-bottom: 16px;
          overflow-x: auto;
          padding-bottom: 4px;
        }
        .pf-chip {
          display: flex;
          align-items: center;
          gap: 6px;
          background: #111418;
          border: 1px solid #242a34;
          border-radius: 999px;
          padding: 8px 14px;
          color: #d1d5db;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
          transition: border-color 0.15s ease;
        }
        .pf-chip:hover { border-color: #ff5a00; }
        .pf-chip-icon { color: #8e98a5; font-size: 14px; }
        .pf-request-btn {
          width: 100%;
          background: #ff5a00;
          color: #ffffff;
          border: none;
          border-radius: 999px;
          font-size: 16px;
          font-weight: 800;
          padding: 15px;
          cursor: pointer;
          box-shadow: 0 8px 24px rgba(255, 90, 0, 0.35);
          transition: background 0.15s ease, transform 0.1s ease;
        }
        .pf-request-btn:hover { background: #ff6a16; transform: translateY(-1px); }

        /* SCREEN 3: Driver Arriving Card (Top) */
        .pf-driver-arriving-card {
          position: absolute;
          top: 68px;
          left: 16px;
          right: 16px;
          max-width: 480px;
          margin: 0 auto;
          background: rgba(15, 18, 22, 0.95);
          backdrop-filter: blur(16px);
          border: 1px solid #242a34;
          border-radius: 20px;
          padding: 14px 16px;
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: space-between;
          box-shadow: 0 16px 40px rgba(0, 0, 0, 0.6);
        }
        .pf-driver-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .pf-driver-avatar {
          width: 50px;
          height: 50px;
          border-radius: 50%;
          border: 2px solid #ff5a00;
          object-fit: cover;
          background: #1c212a;
        }
        .pf-driver-info-name {
          font-size: 16px;
          font-weight: 800;
          color: #ffffff;
        }
        .pf-driver-info-meta {
          font-size: 12px;
          color: #8e98a5;
          margin-top: 2px;
        }
        .pf-driver-info-meta span {
          color: #fbbf24;
          font-weight: 700;
          margin-right: 4px;
        }
        .pf-driver-info-car {
          font-size: 13px;
          color: #cbd5e1;
          margin-top: 2px;
        }
        .pf-driver-call-btn {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: #ff5a00;
          color: #ffffff;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          cursor: pointer;
          box-shadow: 0 4px 14px rgba(255, 90, 0, 0.4);
          transition: background 0.15s ease;
        }
        .pf-driver-call-btn:hover { background: #ff6a16; }

        /* SCREEN 3: Driver Arriving Bottom Sheet */
        .pf-arriving-sheet {
          position: absolute;
          bottom: 16px;
          left: 16px;
          right: 16px;
          max-width: 480px;
          margin: 0 auto;
          background: rgba(15, 18, 22, 0.96);
          backdrop-filter: blur(16px);
          border: 1px solid #242a34;
          border-radius: 24px;
          padding: 18px;
          z-index: 1000;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.7);
        }
        .pf-arriving-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 12px;
        }
        .pf-arriving-pin {
          color: #38bdf8;
          font-size: 18px;
        }
        .pf-arriving-title {
          font-size: 16px;
          font-weight: 800;
          color: #ffffff;
        }
        .pf-arriving-sub {
          font-size: 13px;
          color: #8e98a5;
        }
        .pf-progress-bar {
          width: 100%;
          height: 6px;
          background: #202733;
          border-radius: 999px;
          overflow: hidden;
          margin-bottom: 16px;
        }
        .pf-progress-fill {
          height: 100%;
          width: 65%;
          background: #ff5a00;
          border-radius: 999px;
          box-shadow: 0 0 10px rgba(255, 90, 0, 0.6);
        }
        .pf-arriving-actions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        .pf-arriving-msg-btn {
          background: #111418;
          border: 1px solid #28313e;
          border-radius: 999px;
          color: #ffffff;
          font-size: 14px;
          font-weight: 700;
          padding: 13px;
          cursor: pointer;
        }
        .pf-arriving-msg-btn:hover { background: #1a2029; }
        .pf-arriving-cancel-btn {
          background: #ff5a00;
          border: none;
          border-radius: 999px;
          color: #ffffff;
          font-size: 14px;
          font-weight: 800;
          padding: 13px;
          cursor: pointer;
        }
        .pf-arriving-cancel-btn:hover { background: #ff6a16; }

        /* SCREEN 4: In Progress Banner (Top) */
        .pf-progress-banner {
          position: absolute;
          top: 68px;
          left: 16px;
          right: 16px;
          max-width: 480px;
          margin: 0 auto;
          background: rgba(15, 18, 22, 0.95);
          backdrop-filter: blur(16px);
          border: 1px solid #242a34;
          border-radius: 20px;
          padding: 14px 16px;
          z-index: 1000;
          display: flex;
          align-items: center;
          gap: 12px;
          box-shadow: 0 16px 40px rgba(0, 0, 0, 0.6);
        }
        .pf-banner-pin {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: rgba(255, 90, 0, 0.15);
          color: #ff5a00;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          flex-shrink: 0;
        }
        .pf-banner-title {
          font-size: 15px;
          font-weight: 800;
          color: #ffffff;
        }
        .pf-banner-dest {
          font-size: 13px;
          color: #8e98a5;
          margin-top: 2px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* SCREEN 4: In Progress Bottom Sheet */
        .pf-progress-sheet {
          position: absolute;
          bottom: 16px;
          left: 16px;
          right: 16px;
          max-width: 480px;
          margin: 0 auto;
          background: rgba(15, 18, 22, 0.96);
          backdrop-filter: blur(16px);
          border: 1px solid #242a34;
          border-radius: 24px;
          padding: 18px;
          z-index: 1000;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.7);
        }
        .pf-stats-cols {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          text-align: center;
          padding-bottom: 14px;
          border-bottom: 1px solid #1e2530;
          margin-bottom: 14px;
        }
        .pf-stat-box-label {
          font-size: 12px;
          color: #8e98a5;
          margin-bottom: 4px;
        }
        .pf-stat-box-val {
          font-size: 18px;
          font-weight: 800;
          color: #ffffff;
        }
        .pf-stat-box-val.orange {
          color: #ff5a00;
        }
        .pf-pay-indicator-row {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: #a4b0bf;
          margin-bottom: 16px;
        }
        .pf-finish-btn {
          width: 100%;
          background: #dc2626;
          color: #ffffff;
          border: none;
          border-radius: 999px;
          font-size: 16px;
          font-weight: 800;
          padding: 15px;
          cursor: pointer;
          box-shadow: 0 8px 24px rgba(220, 38, 38, 0.35);
          transition: background 0.15s ease;
        }
        .pf-finish-btn:hover { background: #b91c1c; }

        /* Suggestions Dropdown */
        .pf-suggest-dropdown {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          background: #0f1216;
          border: 1px solid #242a34;
          border-radius: 14px;
          margin-top: 8px;
          max-height: 220px;
          overflow-y: auto;
          box-shadow: 0 12px 32px rgba(0,0,0,0.8);
          z-index: 2000;
        }
        .pf-suggest-item {
          display: block;
          width: 100%;
          padding: 12px 14px;
          background: transparent;
          border: none;
          border-bottom: 1px solid #1a2029;
          color: #ffffff;
          text-align: left;
          cursor: pointer;
          font-size: 13px;
        }
        .pf-suggest-item:hover { background: #161b22; }

        /* Modals (Payment / Promo / Passengers / Chat) */
        .pf-modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.75);
          backdrop-filter: blur(4px);
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
        }
        .pf-modal-card {
          width: 100%;
          max-width: 380px;
          background: #111418;
          border: 1px solid #28313e;
          border-radius: 20px;
          padding: 20px;
          animation: pfFadeIn 0.2s ease;
        }
      `}</style>

      {/* Map Element */}
      <div className="pf-map-canvas" ref={mapEl} />

      {/* Top Header Bar */}
      <header className="pf-map-topbar">
        {stage === 'plan' ? (
          <button
            type="button"
            className="pf-map-icon-btn"
            onClick={() => onOpenMenu?.()}
            aria-label="Menu lateral"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        ) : (
          <button
            type="button"
            className="pf-map-icon-btn"
            onClick={() => setStage('plan')}
            aria-label="Voltar"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        )}

        <div className="pf-map-logo">
          <span>PREÇO </span>
          <b>FIXO 17</b>
        </div>

        <button
          type="button"
          className="pf-map-icon-btn"
          onClick={() => onOpenNotifications?.()}
          aria-label="Notificações"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          <span className="pf-map-bell-badge">3</span>
        </button>
      </header>

      {/* ========================================================= */}
      {/* SCREEN 2: SOLICITAR CORRIDA                               */}
      {/* ========================================================= */}
      {stage === 'plan' && (
        <>
          {/* Floating Route Card */}
          <div className="pf-route-card">
            {/* Origin Row */}
            <div className="pf-route-row">
              <div className="pf-route-pin green" />
              <div className="pf-route-input-group">
                <span className="pf-route-label">Seu local atual</span>
                <input
                  type="text"
                  className="pf-route-val"
                  value={origin.address}
                  onChange={(e) => setOrigin({ ...origin, address: e.target.value })}
                />
              </div>
            </div>

            <div className="pf-route-line" />

            {/* Destination Row */}
            <div className="pf-route-row" style={{ position: 'relative' }}>
              <div className="pf-route-pin orange" />
              <div className="pf-route-input-group">
                <span className="pf-route-label">Para onde?</span>
                <input
                  type="text"
                  className="pf-route-val"
                  placeholder="Rua dos Ipês, 456 - Jardim das Flores"
                  value={destination}
                  onChange={(e) => handleSearch(e.target.value)}
                />
              </div>
              <button
                type="button"
                className="pf-route-add-btn"
                title="Adicionar parada"
                onClick={() => alert('Parada intermediária adicionada à rota.')}
              >
                +
              </button>

              {/* Suggestions */}
              {suggestions.length > 0 && (
                <div className="pf-suggest-dropdown">
                  {suggestions.map((item, i) => (
                    <button
                      key={i}
                      type="button"
                      className="pf-suggest-item"
                      onClick={() => handleSelectDestination(item)}
                    >
                      {item.display_name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Bottom Sheet */}
          <div className="pf-bottom-sheet">
            <div className="pf-sheet-top">
              <img
                src={precoFixo17Car}
                alt="Carro PreçoFixo17"
                className="pf-sheet-car-thumb"
              />
              <div className="pf-sheet-price-box">
                <div className="pf-sheet-price-label">Preço fixo da corrida</div>
                <div className="pf-sheet-price-val">R$ 17,00</div>
              </div>
            </div>

            {/* Option Chips */}
            <div className="pf-sheet-chips">
              <div
                className="pf-chip"
                onClick={() => setModalType('payment')}
              >
                <span className="pf-chip-icon">💳</span>
                <span>Pagamento: {paymentMethod}</span>
              </div>
              <div
                className="pf-chip"
                onClick={() => setModalType('promo')}
              >
                <span className="pf-chip-icon">🏷️</span>
                <span>Promoção: {promoCode}</span>
              </div>
              <div
                className="pf-chip"
                onClick={() => setModalType('passengers')}
              >
                <span className="pf-chip-icon">👤</span>
                <span>Passageiros: {passengerCount} passageiro{passengerCount > 1 ? 's' : ''}</span>
              </div>
            </div>

            {/* CTA Button */}
            <button
              type="button"
              className="pf-request-btn"
              disabled={busy}
              onClick={handleRequestRide}
            >
              {busy ? 'Localizando motorista…' : 'Solicitar corrida'}
            </button>
          </div>
        </>
      )}

      {/* ========================================================= */}
      {/* SCREEN 3: MOTORISTA CHEGANDO                             */}
      {/* ========================================================= */}
      {stage === 'arriving' && (
        <>
          {/* Top Floating Driver Card */}
          <div className="pf-driver-arriving-card">
            <div className="pf-driver-left">
              <img
                src={driver.photo}
                alt={driver.name}
                className="pf-driver-avatar"
              />
              <div>
                <div className="pf-driver-info-name">{driver.name}</div>
                <div className="pf-driver-info-meta">
                  <span>★ {driver.rating}</span> ({driver.ridesCount} corridas)
                </div>
                <div className="pf-driver-info-car">
                  {driver.vehicle} - {driver.plate}
                </div>
              </div>
            </div>
            <button
              type="button"
              className="pf-driver-call-btn"
              title="Ligar para o motorista"
              onClick={() => alert(`Ligando para ${driver.name} (${driver.phone})…`)}
            >
              📞
            </button>
          </div>

          {/* Bottom Arriving Sheet */}
          <div className="pf-arriving-sheet">
            <div className="pf-arriving-header">
              <span className="pf-arriving-pin">📍</span>
              <div>
                <div className="pf-arriving-title">Motorista chegando</div>
                <div className="pf-arriving-sub">Chegando em {etaMinutes} minutos</div>
              </div>
            </div>

            <div className="pf-progress-bar">
              <div className="pf-progress-fill" />
            </div>

            <div className="pf-arriving-actions">
              <button
                type="button"
                className="pf-arriving-msg-btn"
                onClick={() => setModalType('message')}
              >
                Mensagem
              </button>
              <button
                type="button"
                className="pf-arriving-cancel-btn"
                onClick={handleCancelRide}
              >
                Cancelar
              </button>
            </div>
          </div>
        </>
      )}

      {/* ========================================================= */}
      {/* SCREEN 4: CORRIDA EM ANDAMENTO                           */}
      {/* ========================================================= */}
      {stage === 'in_progress' && (
        <>
          {/* Top Floating Banner */}
          <div className="pf-progress-banner">
            <div className="pf-banner-pin">📍</div>
            <div style={{ minWidth: 0 }}>
              <div className="pf-banner-title">Corrida em andamento</div>
              <div className="pf-banner-dest">Destino: {destination}</div>
            </div>
          </div>

          {/* Bottom In-Progress Sheet */}
          <div className="pf-progress-sheet">
            <div className="pf-stats-cols">
              <div>
                <div className="pf-stat-box-label">Tempo</div>
                <div className="pf-stat-box-val">{elapsedTime}</div>
              </div>
              <div>
                <div className="pf-stat-box-label">Distância</div>
                <div className="pf-stat-box-val">{distanceKm} km</div>
              </div>
              <div>
                <div className="pf-stat-box-label">Preço fixo</div>
                <div className="pf-stat-box-val orange">R$ 17,00</div>
              </div>
            </div>

            <div className="pf-pay-indicator-row">
              <span>💳</span>
              <span>Pagamento: {paymentMethod}</span>
            </div>

            <button
              type="button"
              className="pf-finish-btn"
              onClick={handleFinishRide}
            >
              Finalizar corrida
            </button>
          </div>
        </>
      )}

      {/* ========================================================= */}
      {/* MODALS: Payment / Promo / Passengers / Chat               */}
      {/* ========================================================= */}
      {modalType === 'payment' && (
        <div className="pf-modal-backdrop" onClick={() => setModalType(null)}>
          <div className="pf-modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 14px' }}>Forma de Pagamento</h3>
            {['Dinheiro', 'Cartão de Crédito', 'PIX'].map((method) => (
              <button
                key={method}
                type="button"
                className="pf-chip"
                style={{ width: '100%', marginBottom: 8, justifyContent: 'space-between' }}
                onClick={() => {
                  setPaymentMethod(method);
                  setModalType(null);
                }}
              >
                <span>{method}</span>
                {paymentMethod === method && <span style={{ color: '#ff5a00' }}>✓</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {modalType === 'promo' && (
        <div className="pf-modal-backdrop" onClick={() => setModalType(null)}>
          <div className="pf-modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 14px' }}>Cupom ou Promoção</h3>
            <input
              type="text"
              placeholder="Digite seu cupom"
              className="pf-input-field"
              style={{ background: '#1c212a', border: '1px solid #333d4e', borderRadius: 10, padding: 12, marginBottom: 12 }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setPromoCode(e.currentTarget.value || 'Nenhuma');
                  setModalType(null);
                }
              }}
            />
            <button
              type="button"
              className="pf-btn-orange"
              onClick={() => {
                setPromoCode('FIXO17VIP');
                setModalType(null);
              }}
            >
              Aplicar cupom FIXO17VIP
            </button>
          </div>
        </div>
      )}

      {modalType === 'passengers' && (
        <div className="pf-modal-backdrop" onClick={() => setModalType(null)}>
          <div className="pf-modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 14px' }}>Quantidade de Passageiros</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {[1, 2, 3, 4].map((num) => (
                <button
                  key={num}
                  type="button"
                  className={`pf-chip ${passengerCount === num ? 'active' : ''}`}
                  style={{
                    justifyContent: 'center',
                    background: passengerCount === num ? '#ff5a00' : '#111418',
                    color: '#fff'
                  }}
                  onClick={() => {
                    setPassengerCount(num);
                    setModalType(null);
                  }}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {modalType === 'message' && (
        <div className="pf-modal-backdrop" onClick={() => setModalType(null)}>
          <div className="pf-modal-card" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h3 style={{ margin: 0 }}>Mensagens com Carlos</h3>
              <button
                type="button"
                style={{ background: 'none', border: 'none', color: '#8e98a5', fontSize: 18, cursor: 'pointer' }}
                onClick={() => setModalType(null)}
              >
                ✕
              </button>
            </div>
            <div style={{ height: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, padding: 8, background: '#0a0d11', borderRadius: 12, marginBottom: 12 }}>
              {chatMessages.map((m, i) => (
                <div
                  key={i}
                  style={{
                    alignSelf: m.from === 'me' ? 'flex-end' : 'flex-start',
                    background: m.from === 'me' ? '#ff5a00' : '#1c212a',
                    color: '#ffffff',
                    padding: '8px 12px',
                    borderRadius: 12,
                    fontSize: 13,
                    maxWidth: '80%'
                  }}
                >
                  {m.text}
                </div>
              ))}
            </div>
            <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                placeholder="Enviar mensagem…"
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                style={{ flex: 1, background: '#1c212a', border: '1px solid #333d4e', borderRadius: 999, padding: '10px 16px', color: '#fff', outline: 'none' }}
              />
              <button
                type="submit"
                style={{ background: '#ff5a00', border: 'none', borderRadius: '50%', width: 40, height: 40, color: '#fff', cursor: 'pointer' }}
              >
                ➤
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
