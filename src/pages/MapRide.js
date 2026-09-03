import React, { useEffect, useRef, useState } from 'react';
import '../styles/MapRide.css';
import WebSocketService from '../services/WebSocketService';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';
const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_KEY;

function MapRide({ onRideCreate, onBack }) {
  const mapRef = useRef(null);
  const destinationInputRef = useRef(null);
  const destinationPlaceRef = useRef(null);
  const placesLibraryRef = useRef(null);
  const sessionTokenRef = useRef(null);
  const driverMarkerRef = useRef(null);
  const userMarkerRef = useRef(null);
  const directionsRendererRef = useRef(null);
  const [map, setMap] = useState(null);
  const [originInput, setOriginInput] = useState('');
  const [destinationInput, setDestinationInput] = useState('');
  const [destinationSuggestions, setDestinationSuggestions] = useState([]);
  const [routeInfo, setRouteInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [ride, setRide] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [directionsRenderer, setDirectionsRenderer] = useState(null);
  const [driverLocation, setDriverLocation] = useState(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [ratingLoading, setRatingLoading] = useState(false);
  const [rated, setRated] = useState(false);
  const [ratingMessage, setRatingMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    const loadGoogleMaps = async () => {
      if (!GOOGLE_MAPS_API_KEY) return;
      try {
        if (!window.google?.maps) {
          await new Promise((resolve, reject) => {
            const existing = document.querySelector('script[data-mapride-google-maps]');
            if (existing) {
              existing.addEventListener('load', resolve, { once: true });
              existing.addEventListener('error', reject, { once: true });
              return;
            }
            const script = document.createElement('script');
            script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&v=weekly&loading=async`;
            script.async = true;
            script.defer = true;
            script.dataset.maprideGoogleMaps = 'true';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
          });
        }
        if (!cancelled && window.google?.maps) initMap();
      } catch (error) {
        console.error('Erro ao carregar Google Maps:', error);
      }
    };
    loadGoogleMaps();
    return () => {
      cancelled = true;
      WebSocketService.disconnect();
    };
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
    WebSocketService.onRideCancelled(onCancelled);
    return () => {
      WebSocketService.off('ride-accepted', onAccepted);
      WebSocketService.off('update-driver-location', onLocation);
      WebSocketService.off('ride-started', onStarted);
      WebSocketService.off('ride-ended', onEnded);
      WebSocketService.off('ride-cancelled', onCancelled);
    };
  }, [ride?.id]);

  useEffect(() => {
    if (!map || !driverLocation || !window.google) return;
    if (!driverMarkerRef.current) {
      driverMarkerRef.current = new window.google.maps.Marker({
        map,
        title: 'Motorista',
        zIndex: 20,
        icon: { path: window.google.maps.SymbolPath.CIRCLE, scale: 11, fillColor: '#111111', fillOpacity: 1, strokeColor: '#ffffff', strokeWeight: 3 }
      });
    }
    driverMarkerRef.current.setPosition(driverLocation);
  }, [map, driverLocation]);

  const initMap = () => {
    if (!mapRef.current || !window.google?.maps || mapRef.current.dataset.initialized === 'true') return;
    mapRef.current.dataset.initialized = 'true';
    const defaultLocation = { lat: -23.5505, lng: -46.6333 };
    const mapInstance = new window.google.maps.Map(mapRef.current, {
      zoom: 16,
      center: defaultLocation,
      disableDefaultUI: true,
      clickableIcons: false,
      gestureHandling: 'greedy',
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      styles: [
        { featureType: 'poi', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
        { featureType: 'transit', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] }
      ]
    });
    setMap(mapInstance);
    const renderer = new window.google.maps.DirectionsRenderer({
      map: mapInstance,
      suppressMarkers: true,
      preserveViewport: false,
      polylineOptions: { strokeColor: '#111111', strokeOpacity: 0.9, strokeWeight: 6 }
    });
    directionsRendererRef.current = renderer;
    setDirectionsRenderer(renderer);

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        const location = { lat: position.coords.latitude, lng: position.coords.longitude };
        setUserLocation(location);
        mapInstance.setCenter(location);
        if (userMarkerRef.current) userMarkerRef.current.setMap(null);
        userMarkerRef.current = new window.google.maps.Marker({
          position: location,
          map: mapInstance,
          title: 'Sua localização',
          zIndex: 10,
          icon: { path: window.google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: '#1a73e8', fillOpacity: 1, strokeColor: '#ffffff', strokeWeight: 3 }
        });
        new window.google.maps.Geocoder().geocode({ location }, (results, status) => {
          if (status === 'OK' && results?.[0]) setOriginInput(results[0].formatted_address);
        });
      }, (error) => console.warn('Não foi possível obter a localização atual:', error), { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 });
    }
  };

  useEffect(() => {
    let cancelled = false;
    const loadPlaces = async () => {
      if (!map || !window.google?.maps?.importLibrary) return;
      try {
        const places = await window.google.maps.importLibrary('places');
        if (!cancelled) placesLibraryRef.current = places;
      } catch (error) {
        console.error('Erro ao carregar Places:', error);
      }
    };
    loadPlaces();
    return () => { cancelled = true; };
  }, [map]);

  const centerOnUser = () => {
    if (!map || !userLocation) return;
    map.panTo(userLocation);
    map.setZoom(17);
  };

  const calculateRoute = async (placeOverride = null) => {
    if (!window.google?.maps || !map) return alert('O mapa ainda está carregando. Aguarde um instante.');
    const destinationPlace = placeOverride || destinationPlaceRef.current;
    const destination = destinationPlace?.geometry?.location || destinationPlace?.location || destinationInput.trim();
    const origin = userLocation || originInput.trim();
    if (!origin) return alert('Não foi possível localizar sua posição. Ative a localização do celular e tente novamente.');
    if (!destination) return alert('Informe o destino para calcular a rota.');
    setLoading(true);
    try {
      const service = new window.google.maps.DirectionsService();
      const result = await service.route({ origin, destination, travelMode: window.google.maps.TravelMode.DRIVING, provideRouteAlternatives: false });
      if (!result?.routes?.length || !result.routes[0]?.legs?.length) throw new Error('ROUTE_NOT_FOUND');
      const renderer = directionsRendererRef.current || directionsRenderer;
      if (!renderer) throw new Error('MAP_RENDERER_NOT_READY');
      renderer.setMap(map);
      renderer.setDirections(result);
      const leg = result.routes[0].legs[0];
      const distanceKm = Number(leg.distance?.value || 0) / 1000;
      const durationMin = Math.ceil(Number(leg.duration?.value || 0) / 60);
      const destinationLocation = leg.end_location ? { lat: leg.end_location.lat(), lng: leg.end_location.lng() } : null;
      setRouteInfo({
        distance: distanceKm.toFixed(2),
        duration: durationMin,
        price: (distanceKm * 5 + 10).toFixed(2),
        origin: leg.start_address || originInput || 'Minha localização',
        destination: leg.end_address || destinationInput,
        originLocation: userLocation || null,
        destinationLocation
      });
      setDestinationSuggestions([]);
      map.fitBounds(result.routes[0].bounds, { top: 80, right: 40, bottom: 300, left: 40 });
    } catch (error) {
      console.error('Erro ao calcular rota:', error);
      alert(error?.message === 'ROUTE_NOT_FOUND' ? 'Não encontramos uma rota de carro para esse destino. Escolha um endereço sugerido.' : 'Não foi possível localizar a rota. Confira o destino e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const searchDestinations = async (value) => {
    setDestinationInput(value);
    destinationPlaceRef.current = null;
    setRouteInfo(null);
    if (!value.trim() || value.trim().length < 2) {
      setDestinationSuggestions([]);
      return;
    }
    try {
      const places = placesLibraryRef.current || await window.google.maps.importLibrary('places');
      placesLibraryRef.current = places;
      const { AutocompleteSuggestion, AutocompleteSessionToken } = places;
      if (!sessionTokenRef.current) sessionTokenRef.current = new AutocompleteSessionToken();
      const request = {
        input: value.trim(),
        includedRegionCodes: ['br'],
        language: 'pt-BR',
        sessionToken: sessionTokenRef.current
      };
      const response = await AutocompleteSuggestion.fetchAutocompleteSuggestions(request);
      setDestinationSuggestions(response?.suggestions || []);
    } catch (error) {
      console.error('Erro nas sugestões de destino:', error);
      setDestinationSuggestions([]);
    }
  };

  const selectDestination = async (suggestion) => {
    try {
      const prediction = suggestion?.placePrediction;
      if (!prediction) return;
      const place = prediction.toPlace();
      await place.fetchFields({ fields: ['displayName', 'formattedAddress', 'location', 'viewport'] });
      const normalizedPlace = {
        name: place.displayName || '',
        formatted_address: place.formattedAddress || place.displayName || '',
        place_id: place.id,
        location: place.location,
        geometry: { location: place.location, viewport: place.viewport }
      };
      destinationPlaceRef.current = normalizedPlace;
      setDestinationInput(normalizedPlace.formatted_address);
      setDestinationSuggestions([]);
      sessionTokenRef.current = null;
      if (normalizedPlace.geometry.viewport) map.fitBounds(normalizedPlace.geometry.viewport, { top: 100, right: 40, bottom: 300, left: 40 });
      else if (normalizedPlace.location) map.panTo(normalizedPlace.location);
      await calculateRoute(normalizedPlace);
    } catch (error) {
      console.error('Erro ao selecionar destino:', error);
      alert('Não foi possível selecionar esse endereço. Tente outra sugestão.');
    }
  };

  const handleCreateRide = async () => {
    if (!routeInfo || requesting) return;
    const token = localStorage.getItem('token');
    if (!token) return alert('Faça login novamente.');
    setRequesting(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/rides/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          origin: { address: routeInfo.origin, location: routeInfo.originLocation || userLocation },
          destination: { address: routeInfo.destination, location: routeInfo.destinationLocation },
          distance: Number(routeInfo.distance),
          price: Number(routeInfo.price)
        })
      });
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
      const response = await fetch(`${BACKEND_URL}/api/rides/${ride.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: 'CANCELLED', cancellationReason: 'Cancelada pelo passageiro' })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Não foi possível cancelar a corrida.');
      setRide(data.ride);
      WebSocketService.cancelRide(ride.id);
    } catch (error) { alert(error.message); }
    finally { setCancelling(false); }
  };

  const submitRating = async () => {
    if (!ride?.id || ratingLoading || rated) return;
    if (!rating) return setRatingMessage('Escolha uma nota de 1 a 5 estrelas.');
    const token = localStorage.getItem('token');
    if (!token) return setRatingMessage('Faça login novamente.');
    setRatingLoading(true);
    setRatingMessage('');
    try {
      const response = await fetch(`${BACKEND_URL}/api/ratings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ rideId: ride.id, rating, comment })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Não foi possível enviar a avaliação.');
      setRated(true);
      setRatingMessage('Obrigado pela avaliação! ⭐');
    } catch (error) { setRatingMessage(error.message); }
    finally { setRatingLoading(false); }
  };

  const statusLabel = { SEARCHING: 'Procurando motorista', ACCEPTED: 'Motorista a caminho', IN_PROGRESS: 'Corrida em andamento', COMPLETED: 'Corrida finalizada', CANCELLED: 'Corrida cancelada' };
  const isActiveRide = ride && !['COMPLETED', 'CANCELLED'].includes(ride.status);

  return (
    <div className="map-ride-container">
      <div className="map-wrapper">
        <div ref={mapRef} className="map-canvas" />
        <div className="map-topbar">
          {onBack && <button className="map-icon-button" onClick={onBack} aria-label="Voltar">←</button>}
          <div className="map-security-badge"><span>●</span> MapRide</div>
          <button className="map-icon-button" onClick={centerOnUser} disabled={!userLocation} aria-label="Minha localização">⌖</button>
        </div>
        {!GOOGLE_MAPS_API_KEY && <div className="map-error">Configure REACT_APP_GOOGLE_MAPS_KEY na Vercel.</div>}
      </div>

      <div className={`ride-panel ${ride ? 'has-ride' : ''}`}>
        {!ride ? (
          <>
            <div className="sheet-handle" />
            <div className="sheet-header">
              <div><span className="eyebrow">MapRide</span><h2>Para onde vamos?</h2></div>
              <button className="profile-mini" onClick={onBack} aria-label="Perfil">●</button>
            </div>
            <div className="location-box">
              <div className="location-line"><span className="dot current" /><input value={originInput} onChange={e => setOriginInput(e.target.value)} placeholder="Localização atual" /></div>
              <div className="location-connector" />
              <div className="destination-search-wrap">
                <div className="location-line">
                  <span className="dot destination" />
                  <input
                    ref={destinationInputRef}
                    value={destinationInput}
                    onChange={e => searchDestinations(e.target.value)}
                    onFocus={() => { if (destinationInput.trim().length >= 2) searchDestinations(destinationInput); }}
                    placeholder="Digite seu destino"
                    autoComplete="off"
                    aria-label="Digite seu destino"
                  />
                </div>
                {destinationSuggestions.length > 0 && (
                  <div className="destination-suggestions" role="listbox">
                    {destinationSuggestions.map((suggestion, index) => {
                      const prediction = suggestion.placePrediction;
                      const title = prediction?.mainText?.toString?.() || prediction?.text?.toString?.() || 'Destino';
                      const description = prediction?.secondaryText?.toString?.() || '';
                      return (
                        <button key={`${prediction?.placeId || index}`} type="button" className="destination-suggestion" onMouseDown={e => e.preventDefault()} onClick={() => selectDestination(suggestion)}>
                          <span className="suggestion-icon">⌖</span>
                          <span className="suggestion-text"><strong>{title}</strong>{description && <small>{description}</small>}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {routeInfo && <div className="trip-preview"><div><strong>R$ {routeInfo.price}</strong><span>estimado</span></div><div><strong>{routeInfo.duration} min</strong><span>{routeInfo.distance} km</span></div></div>}
            {!routeInfo ? (
              <button className="btn-request primary-action" onClick={() => calculateRoute()} disabled={loading || !map || !destinationInput}>{loading ? 'Calculando rota...' : 'Ver preço e rota'}</button>
            ) : (
              <button className="btn-request primary-action" onClick={handleCreateRide} disabled={requesting}>{requesting ? 'Solicitando motorista...' : `Solicitar corrida • R$ ${routeInfo.price}`}</button>
            )}
            <p className="safe-note">🔒 Sua localização é usada somente para encontrar e acompanhar sua corrida.</p>
          </>
        ) : (
          <>
            <div className="sheet-handle" />
            <div className="ride-status-head"><div className="status-pulse"><span /></div><div><span className="eyebrow">Sua corrida</span><h2>{statusLabel[ride.status] || ride.status}</h2></div></div>
            {ride.driverId && <div className="driver-card"><div className="driver-avatar">🚗</div><div className="driver-details"><strong>Motorista encontrado</strong><span>O motorista está a caminho</span></div><div className="driver-live">AO VIVO</div></div>}
            <div className="ride-route-card"><div><span className="route-dot blue" /><span>{routeInfo?.origin || originInput || 'Sua localização'}</span></div><div className="route-line" /><div><span className="route-dot black" /><span>{routeInfo?.destination || destinationInput}</span></div></div>
            {driverLocation && <div className="driver-distance">📍 Motorista atualizado no mapa em tempo real</div>}
            {isActiveRide && <button className="cancel-link" onClick={handleCancelRide} disabled={cancelling}>{cancelling ? 'Cancelando...' : 'Cancelar corrida'}</button>}
            {ride.status === 'COMPLETED' && !rated && <div className="rating-card"><h3>Avalie seu motorista</h3><div className="stars">{[1, 2, 3, 4, 5].map(star => <button key={star} type="button" onClick={() => setRating(star)} className={star <= rating ? 'selected' : ''}>★</button>)}</div><textarea value={comment} onChange={e => setComment(e.target.value)} maxLength={500} rows={2} placeholder="Comentário opcional" /><button className="btn-request primary-action" onClick={submitRating} disabled={ratingLoading}>{ratingLoading ? 'Enviando...' : 'Enviar avaliação'}</button>{ratingMessage && <p>{ratingMessage}</p>}</div>}
            {ride.status === 'COMPLETED' && rated && <div className="success-message">✓ Avaliação enviada. Obrigado!</div>}
            {ride.status === 'CANCELLED' && <div className="success-message">Corrida cancelada.</div>}
          </>
        )}
      </div>
    </div>
  );
}

export default MapRide;
