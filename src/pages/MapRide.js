import React, { useEffect, useRef, useState } from 'react';
import '../styles/MapRide.css';
import WebSocketService from '../services/WebSocketService';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';
const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_KEY;

function MapRide({ onRideCreate, onBack }) {
  const mapRef = useRef(null);
  const driverMarkerRef = useRef(null);
  const [map, setMap] = useState(null);
  const [originInput, setOriginInput] = useState('');
  const [destinationInput, setDestinationInput] = useState('');
  const [routeInfo, setRouteInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [ride, setRide] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [directionsRenderer, setDirectionsRenderer] = useState(null);
  const [driverLocation, setDriverLocation] = useState(null);

  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY) return undefined;
    if (!window.google) {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
      script.async = true;
      script.onload = initMap;
      document.head.appendChild(script);
    } else initMap();
    return () => WebSocketService.disconnect();
  }, []);

  useEffect(() => {
    const onAccepted = (data) => {
      if (!ride?.id || data?.rideId !== ride.id) return;
      setRide(prev => ({ ...(prev || {}), ...data, status: 'ACCEPTED', driverId: data.driverId }));
    };
    const onLocation = (data) => {
      if (!ride?.id || (data?.rideId && data.rideId !== ride.id)) return;
      const lat = Number(data.latitude ?? data.lat);
      const lng = Number(data.longitude ?? data.lng);
      if (Number.isFinite(lat) && Number.isFinite(lng)) setDriverLocation({ lat, lng });
    };
    const onStarted = (data) => {
      if (data?.rideId === ride?.id) setRide(prev => ({ ...(prev || {}), status: 'IN_PROGRESS' }));
    };
    const onEnded = (data) => {
      if (data?.rideId === ride?.id) setRide(prev => ({ ...(prev || {}), status: 'COMPLETED' }));
    };
    const onCancelled = (data) => {
      if (data?.rideId === ride?.id) setRide(prev => ({ ...(prev || {}), status: 'CANCELLED' }));
    };
    WebSocketService.onRideAccepted(onAccepted);
    WebSocketService.onDriverLocationUpdate(onLocation);
    WebSocketService.onRideStarted(onStarted);
    WebSocketService.onRideEnded(onEnded);
    WebSocketService.ensureSocket().on('ride-cancelled', onCancelled);
    return () => {
      WebSocketService.off('ride-accepted', onAccepted);
      WebSocketService.off('update-driver-location', onLocation);
      WebSocketService.off('ride-started', onStarted);
      WebSocketService.off('ride-ended', onEnded);
      WebSocketService.off('ride-cancelled', onCancelled);
    };
  }, [ride?.id]);

  useEffect(() => {
    if (!map || !driverLocation) return;
    if (!driverMarkerRef.current) driverMarkerRef.current = new window.google.maps.Marker({ map, title: 'Motorista' });
    driverMarkerRef.current.setPosition(driverLocation);
  }, [map, driverLocation]);

  const initMap = () => {
    if (!mapRef.current || !window.google) return;
    const defaultLocation = { lat: -23.5505, lng: -46.6333 };
    const mapInstance = new window.google.maps.Map(mapRef.current, { zoom: 15, center: defaultLocation });
    setMap(mapInstance);
    setDirectionsRenderer(new window.google.maps.DirectionsRenderer({ map: mapInstance }));
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        const location = { lat: position.coords.latitude, lng: position.coords.longitude };
        setUserLocation(location);
        mapInstance.setCenter(location);
        new window.google.maps.Marker({ position: location, map: mapInstance, title: 'Sua localização' });
      }, () => {});
    }
  };

  const calculateRoute = async () => {
    if (!originInput || !destinationInput || !map) return alert('Preencha origem e destino.');
    setLoading(true);
    try {
      const result = await new window.google.maps.DirectionsService().route({ origin: originInput, destination: destinationInput, travelMode: window.google.maps.TravelMode.DRIVING });
      directionsRenderer?.setDirections(result);
      const leg = result.routes[0].legs[0];
      const distanceKm = leg.distance.value / 1000;
      setRouteInfo({ distance: distanceKm.toFixed(2), duration: Math.ceil(leg.duration.value / 60), price: (distanceKm * 5 + 10).toFixed(2), origin: originInput, destination: destinationInput });
    } catch (error) { console.error(error); alert('Não foi possível calcular a rota.'); }
    finally { setLoading(false); }
  };

  const handleCreateRide = async () => {
    if (!routeInfo || requesting) return;
    const token = localStorage.getItem('token');
    if (!token) return alert('Faça login novamente.');
    setRequesting(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/rides/request`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ origin: { address: routeInfo.origin, location: userLocation }, destination: { address: routeInfo.destination }, distance: Number(routeInfo.distance), price: Number(routeInfo.price) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erro ao solicitar corrida.');
      setRide(data.ride);
      WebSocketService.connect();
      WebSocketService.joinRideRoom(data.ride.id);
      WebSocketService.requestRide({ rideId: data.ride.id });
      onRideCreate?.(data.ride);
    } catch (error) { alert(error.message); }
    finally { setRequesting(false); }
  };

  const handleCancelRide = async () => {
    if (!ride?.id || cancelling || ['COMPLETED', 'CANCELLED'].includes(ride.status)) return;
    if (!window.confirm('Deseja cancelar esta corrida?')) return;
    const token = localStorage.getItem('token');
    if (!token) return alert('Faça login novamente.');
    setCancelling(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/rides/${ride.id}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ status: 'CANCELLED', cancellationReason: 'Cancelada pelo passageiro' }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Não foi possível cancelar a corrida.');
      setRide(data.ride);
      WebSocketService.ensureSocket().emit('ride-cancelled', { rideId: ride.id });
    } catch (error) { alert(error.message); }
    finally { setCancelling(false); }
  };

  const statusLabel = { SEARCHING: 'Procurando motorista', ACCEPTED: 'Motorista a caminho', IN_PROGRESS: 'Corrida em andamento', COMPLETED: 'Corrida finalizada', CANCELLED: 'Corrida cancelada' };

  return (
    <div className="map-ride-container">
      <div className="map-wrapper"><div ref={mapRef} className="map-canvas"></div></div>
      <div className="ride-panel">
        {onBack && <button onClick={onBack} className="btn-calculate">← Voltar</button>}
        <h2>🚗 Solicitar Corrida</h2>
        {!GOOGLE_MAPS_API_KEY && <div className="error-message">Configure REACT_APP_GOOGLE_MAPS_KEY na Vercel.</div>}
        <div className="input-group"><label>📍 Origem</label><input value={originInput} onChange={e => setOriginInput(e.target.value)} placeholder="Onde você está?" disabled={!!ride} /></div>
        <div className="input-group"><label>🎯 Destino</label><input value={destinationInput} onChange={e => setDestinationInput(e.target.value)} placeholder="Para onde você vai?" disabled={!!ride} /></div>
        {!ride && <button className="btn-calculate" onClick={calculateRoute} disabled={loading || !map}>{loading ? '🔄 Calculando...' : '🔍 Calcular Rota'}</button>}
        {routeInfo && !ride && <div className="route-info"><h3>📊 Detalhes</h3><p>📏 {routeInfo.distance} km</p><p>⏱️ {routeInfo.duration} min</p><p>💰 R$ {routeInfo.price}</p><button className="btn-request" onClick={handleCreateRide} disabled={requesting}>{requesting ? '⏳ Solicitando...' : '🚀 Solicitar Corrida'}</button></div>}
        {ride && <div className="route-info"><h3>🚕 Corrida</h3><p>ID: {ride.id}</p><p><strong>Status:</strong> {statusLabel[ride.status] || ride.status}</p>{ride.driverId ? <p>👨‍✈️ Motorista encontrado! A localização será atualizada em tempo real.</p> : <p>🔎 Procurando motorista...</p>}{driverLocation && <p>📍 Motorista: {driverLocation.lat.toFixed(5)}, {driverLocation.lng.toFixed(5)}</p>}{!['COMPLETED', 'CANCELLED'].includes(ride.status) && <button className="btn-calculate" onClick={handleCancelRide} disabled={cancelling}>{cancelling ? '⏳ Cancelando...' : '✕ Cancelar corrida'}</button>}{ride.status === 'COMPLETED' && <p>✅ Corrida finalizada.</p>}{ride.status === 'CANCELLED' && <p>⚠️ Corrida cancelada.</p>}</div>}
      </div>
    </div>
  );
}

export default MapRide;
