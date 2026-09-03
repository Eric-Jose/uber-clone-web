import React, { useEffect, useRef, useState } from 'react';
import WebSocketService from '../services/WebSocketService';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';
const GOOGLE_KEY = process.env.REACT_APP_GOOGLE_MAPS_KEY;

const box = { background: '#fff', borderRadius: 16, boxShadow: '0 4px 18px rgba(0,0,0,.16)' };

export default function MapRideFixed({ onRideCreate, onBack }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const autocompleteRef = useRef(null);
  const destinationPlaceRef = useRef(null);
  const userMarkerRef = useRef(null);
  const driverMarkerRef = useRef(null);
  const rendererRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState('');
  const [origin, setOrigin] = useState(null);
  const [originText, setOriginText] = useState('Minha localização');
  const [destination, setDestination] = useState('');
  const [route, setRoute] = useState(null);
  const [ride, setRide] = useState(null);
  const [driverLocation, setDriverLocation] = useState(null);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [ratingMessage, setRatingMessage] = useState('');
  const [rated, setRated] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (!GOOGLE_KEY) {
        setMapError('Chave REACT_APP_GOOGLE_MAPS_KEY não encontrada na implantação.');
        return;
      }
      try {
        if (!window.google?.maps) {
          await new Promise((resolve, reject) => {
            const existing = document.querySelector('script[data-uber-google-maps]');
            if (existing) {
              existing.addEventListener('load', resolve, { once: true });
              existing.addEventListener('error', reject, { once: true });
              return;
            }
            const script = document.createElement('script');
            script.dataset.uberGoogleMaps = 'true';
            script.src = 'https://maps.googleapis.com/maps/api/js?key=' + encodeURIComponent(GOOGLE_KEY) + '&libraries=places&v=weekly';
            script.async = true;
            script.defer = true;
            script.onload = resolve;
            script.onerror = () => reject(new Error('GOOGLE_SCRIPT_LOAD_FAILED'));
            document.head.appendChild(script);
          });
        }
        if (!alive) return;
        if (!window.google?.maps) throw new Error('GOOGLE_NOT_AVAILABLE');
        const map = new window.google.maps.Map(mapRef.current, {
          center: { lat: -23.55052, lng: -46.63331 },
          zoom: 15,
          disableDefaultUI: true,
          clickableIcons: false,
          gestureHandling: 'greedy',
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false
        });
        mapInstanceRef.current = map;
        rendererRef.current = new window.google.maps.DirectionsRenderer({
          map,
          suppressMarkers: true,
          preserveViewport: false,
          polylineOptions: { strokeColor: '#111', strokeOpacity: .9, strokeWeight: 6 }
        });
        setMapReady(true);
        setMapError('');

        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition((p) => {
            if (!alive) return;
            const loc = { lat: p.coords.latitude, lng: p.coords.longitude };
            setOrigin(loc);
            map.setCenter(loc);
            map.setZoom(16);
            if (userMarkerRef.current) userMarkerRef.current.setMap(null);
            userMarkerRef.current = new window.google.maps.Marker({
              map, position: loc, title: 'Sua localização', zIndex: 10,
              icon: { path: window.google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: '#1a73e8', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 3 }
            });
            new window.google.maps.Geocoder().geocode({ location: loc }, (results, status) => {
              if (status === 'OK' && results?.[0] && alive) setOriginText(results[0].formatted_address);
            });
          }, () => {}, { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 });
        }

        const places = await window.google.maps.importLibrary('places');
        if (!alive) return;
        const Autocomplete = places.Autocomplete;
        if (!Autocomplete) throw new Error('PLACES_AUTOCOMPLETE_UNAVAILABLE');
        const input = document.getElementById('uber-destination-input');
        if (!input) return;
        const ac = new Autocomplete(input, { fields: ['formatted_address', 'geometry', 'name', 'place_id'], componentRestrictions: { country: 'br' } });
        autocompleteRef.current = ac;
        ac.addListener('place_changed', () => {
          const place = ac.getPlace();
          if (!place?.geometry?.location) {
            setMapError('Escolha um endereço da lista de sugestões.');
            return;
          }
          destinationPlaceRef.current = place;
          const text = place.formatted_address || place.name || '';
          setDestination(text);
          setMapError('');
          calculateRoute(place);
        });
      } catch (e) {
        console.error('Google Maps:', e);
        if (alive) setMapError(e.message === 'GOOGLE_SCRIPT_LOAD_FAILED' ? 'Não foi possível carregar o Google Maps. Verifique a chave, faturamento e as restrições do Google Cloud.' : 'Não foi possível inicializar o Google Maps.');
      }
    };
    load();
    return () => {
      alive = false;
      if (autocompleteRef.current) window.google?.maps?.event?.clearInstanceListeners(autocompleteRef.current);
      WebSocketService.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!mapInstanceRef.current || !driverLocation || !window.google?.maps) return;
    if (!driverMarkerRef.current) {
      driverMarkerRef.current = new window.google.maps.Marker({
        map: mapInstanceRef.current, title: 'Motorista', zIndex: 20,
        icon: { path: window.google.maps.SymbolPath.CIRCLE, scale: 11, fillColor: '#111', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 3 }
      });
    }
    driverMarkerRef.current.setPosition(driverLocation);
  }, [driverLocation]);

  useEffect(() => {
    const accepted = (data) => { if (ride?.id && data?.rideId === ride.id) setRide(r => ({ ...(r || {}), ...data, status: 'ACCEPTED' })); };
    const location = (data) => {
      if (ride?.id && data?.rideId && data.rideId !== ride.id) return;
      const lat = Number(data?.latitude ?? data?.lat), lng = Number(data?.longitude ?? data?.lng);
      if (Number.isFinite(lat) && Number.isFinite(lng)) setDriverLocation({ lat, lng });
    };
    const started = (data) => { if (data?.rideId === ride?.id) setRide(r => ({ ...(r || {}), status: 'IN_PROGRESS' })); };
    const ended = (data) => { if (data?.rideId === ride?.id) setRide(r => ({ ...(r || {}), status: 'COMPLETED' })); };
    const cancelled = (data) => { if (data?.rideId === ride?.id) setRide(r => ({ ...(r || {}), status: 'CANCELLED' })); };
    WebSocketService.onRideAccepted(accepted); WebSocketService.onDriverLocationUpdate(location); WebSocketService.onRideStarted(started); WebSocketService.onRideEnded(ended); WebSocketService.onRideCancelled(cancelled);
    return () => { WebSocketService.off('ride-accepted', accepted); WebSocketService.off('update-driver-location', location); WebSocketService.off('ride-started', started); WebSocketService.off('ride-ended', ended); WebSocketService.off('ride-cancelled', cancelled); };
  }, [ride?.id]);

  const calculateRoute = async (place) => {
    const map = mapInstanceRef.current;
    if (!map || !window.google?.maps || !origin) return;
    const destinationLocation = place?.geometry?.location || destinationPlaceRef.current?.geometry?.location;
    if (!destinationLocation) return;
    setLoadingRoute(true);
    try {
      const result = await new window.google.maps.DirectionsService().route({ origin, destination: destinationLocation, travelMode: window.google.maps.TravelMode.DRIVING, provideRouteAlternatives: false });
      const leg = result?.routes?.[0]?.legs?.[0];
      if (!leg) throw new Error('ROUTE_NOT_FOUND');
      rendererRef.current.setDirections(result);
      const km = Number(leg.distance?.value || 0) / 1000;
      const minutes = Math.max(1, Math.ceil(Number(leg.duration?.value || 0) / 60));
      setRoute({ distance: km.toFixed(2), duration: minutes, price: (km * 5 + 10).toFixed(2), origin: leg.start_address || originText, destination: leg.end_address || destination, originLocation: origin, destinationLocation: { lat: leg.end_location.lat(), lng: leg.end_location.lng() } });
      map.fitBounds(result.routes[0].bounds, { top: 80, right: 30, bottom: 260, left: 30 });
    } catch (e) {
      console.error('Rota:', e);
      setRoute(null);
      setMapError('Não foi possível calcular a rota para este destino.');
    } finally { setLoadingRoute(false); }
  };

  const requestRide = async () => {
    if (!route || requesting) return;
    const token = localStorage.getItem('token');
    if (!token) return alert('Faça login novamente.');
    setRequesting(true);
    try {
      const res = await fetch(BACKEND_URL + '/api/rides/request', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ origin: { address: route.origin, location: route.originLocation }, destination: { address: route.destination, location: route.destinationLocation }, distance: Number(route.distance), price: Number(route.price) }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao solicitar corrida.');
      setRide(data.ride); WebSocketService.connect(); WebSocketService.joinRideRoom(data.ride.id); WebSocketService.requestRide({ rideId: data.ride.id }); onRideCreate?.(data.ride);
    } catch (e) { alert(e.message); } finally { setRequesting(false); }
  };

  const cancelRide = async () => {
    if (!ride?.id || cancelling || ['COMPLETED', 'CANCELLED'].includes(ride.status)) return;
    if (!window.confirm('Deseja cancelar esta corrida?')) return;
    const token = localStorage.getItem('token'); if (!token) return alert('Faça login novamente.');
    setCancelling(true);
    try {
      const res = await fetch(BACKEND_URL + '/api/rides/' + ride.id + '/status', { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ status: 'CANCELLED', cancellationReason: 'Cancelada pelo passageiro' }) });
      const data = await res.json(); if (!res.ok) throw new Error(data.error || 'Não foi possível cancelar.');
      setRide(data.ride); WebSocketService.cancelRide(ride.id);
    } catch (e) { alert(e.message); } finally { setCancelling(false); }
  };

  const submitRating = async () => {
    if (!ride?.id || rated || !rating) return;
    const token = localStorage.getItem('token'); if (!token) return setRatingMessage('Faça login novamente.');
    try {
      const res = await fetch(BACKEND_URL + '/api/ratings', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ rideId: ride.id, rating, comment }) });
      const data = await res.json(); if (!res.ok) throw new Error(data.error || 'Não foi possível avaliar.');
      setRated(true); setRatingMessage('Obrigado pela avaliação! ⭐');
    } catch (e) { setRatingMessage(e.message); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#eee', overflow: 'hidden', fontFamily: 'Arial, sans-serif' }}>
      <div ref={mapRef} style={{ position: 'absolute', inset: 0 }} />
      {!mapReady && !mapError && <div style={{ ...box, position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', padding: 20, zIndex: 20 }}>Carregando mapa...</div>}
      {mapError && <div style={{ ...box, position: 'absolute', top: 70, left: 16, right: 16, padding: 14, zIndex: 30, color: '#b00020', fontSize: 14 }}><b>Google Maps:</b> {mapError}</div>}
      <div style={{ position: 'absolute', top: 16, left: 16, right: 16, zIndex: 10, display: 'flex', gap: 10, alignItems: 'center' }}>
        {onBack && <button onClick={onBack} style={{ ...box, width: 48, height: 48, border: 0, fontSize: 24, cursor: 'pointer' }}>←</button>}
        <div style={{ ...box, flex: 1, padding: '8px 14px' }}>
          <div style={{ fontSize: 11, color: '#777', marginBottom: 3 }}>LOCAL DE PARTIDA</div>
          <div style={{ fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>● {originText}</div>
          <div style={{ borderTop: '1px solid #eee', margin: '8px 0' }} />
          <div style={{ fontSize: 11, color: '#777', marginBottom: 3 }}>PARA ONDE?</div>
          <input id="uber-destination-input" value={destination} onChange={e => { setDestination(e.target.value); destinationPlaceRef.current = null; setRoute(null); }} placeholder="Digite seu destino" autoComplete="off" style={{ width: '100%', border: 0, outline: 0, fontSize: 16, padding: '4px 0', boxSizing: 'border-box' }} />
        </div>
      </div>
      <button onClick={() => origin && mapInstanceRef.current?.panTo(origin)} style={{ ...box, position: 'absolute', right: 16, bottom: route ? 230 : 28, zIndex: 10, width: 48, height: 48, border: 0, fontSize: 22, cursor: 'pointer' }}>⌖</button>
      {loadingRoute && <div style={{ ...box, position: 'absolute', left: 16, right: 16, bottom: 24, zIndex: 20, padding: 18, textAlign: 'center' }}>Calculando rota...</div>}
      {route && !ride && !loadingRoute && <div style={{ ...box, position: 'absolute', left: 12, right: 12, bottom: 12, zIndex: 20, padding: 18 }}><div style={{ fontSize: 13, color: '#666' }}>{route.distance} km • {route.duration} min</div><div style={{ fontSize: 28, fontWeight: 700, margin: '4px 0 12px' }}>R$ {route.price}</div><button onClick={requestRide} disabled={requesting} style={{ width: '100%', height: 50, border: 0, borderRadius: 12, background: '#111', color: '#fff', fontSize: 16, fontWeight: 700 }}>{requesting ? 'Solicitando...' : 'Solicitar corrida'}</button></div>}
      {ride && <div style={{ ...box, position: 'absolute', left: 12, right: 12, bottom: 12, zIndex: 20, padding: 18 }}><div style={{ fontWeight: 700, fontSize: 18 }}>{ride.status === 'SEARCHING' ? 'Procurando motorista...' : ride.status === 'ACCEPTED' ? 'Motorista a caminho' : ride.status === 'IN_PROGRESS' ? 'Corrida em andamento' : ride.status === 'COMPLETED' ? 'Corrida finalizada' : 'Corrida cancelada'}</div>{['SEARCHING','ACCEPTED','IN_PROGRESS'].includes(ride.status) && <button onClick={cancelRide} disabled={cancelling} style={{ width: '100%', marginTop: 12, height: 44, border: '1px solid #ddd', borderRadius: 10, background: '#fff', fontWeight: 600 }}>{cancelling ? 'Cancelando...' : 'Cancelar corrida'}</button>}{ride.status === 'COMPLETED' && !rated && <div style={{ marginTop: 12 }}><div style={{ marginBottom: 8 }}>Avalie o motorista</div><div style={{ fontSize: 28 }}>{[1,2,3,4,5].map(n => <button key={n} onClick={() => setRating(n)} style={{ border: 0, background: 'transparent', fontSize: 25, cursor: 'pointer', opacity: n <= rating ? 1 : .35 }}>★</button>)}</div><input value={comment} onChange={e => setComment(e.target.value)} placeholder="Comentário (opcional)" style={{ width: '100%', padding: 10, boxSizing: 'border-box', border: '1px solid #ddd', borderRadius: 8 }} /><button onClick={submitRating} style={{ marginTop: 8, width: '100%', height: 44, border: 0, borderRadius: 10, background: '#111', color: '#fff' }}>Enviar avaliação</button></div>}{ratingMessage && <div style={{ marginTop: 10 }}>{ratingMessage}</div>}</div>}
    </div>
  );
}
