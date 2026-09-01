import React, { useState, useEffect, useRef } from 'react';
import '../styles/MapRide.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';
const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_KEY;

function MapRide({ onRideCreate }) {
  const mapRef = useRef(null);
  const [map, setMap] = useState(null);
  const [originInput, setOriginInput] = useState('');
  const [destinationInput, setDestinationInput] = useState('');
  const [routeInfo, setRouteInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [markers, setMarkers] = useState([]);
  const [directionsRenderer, setDirectionsRenderer] = useState(null);

  // Inicializar mapa
  useEffect(() => {
    if (!window.google) {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
      script.async = true;
      script.onload = initMap;
      document.head.appendChild(script);
    } else {
      initMap();
    }
  }, []);

  const initMap = () => {
    const mapElement = mapRef.current;
    if (!mapElement) return;

    // Localização padrão (São Paulo)
    const defaultLocation = { lat: -23.5505, lng: -46.6333 };

    const mapInstance = new window.google.maps.Map(mapElement, {
      zoom: 15,
      center: defaultLocation,
      styles: [
        { elementType: 'geometry', stylers: [{ color: '#f5f5f5' }] },
        { elementType: 'labels.text.stroke', stylers: [{ color: '#f5f5f5' }] },
        { elementType: 'labels.text.fill', stylers: [{ color: '#616161' }] }
      ]
    });

    setMap(mapInstance);
    setDirectionsRenderer(new window.google.maps.DirectionsRenderer());

    // Obter localização do usuário
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        const userLoc = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        setUserLocation(userLoc);
        mapInstance.setCenter(userLoc);

        // Marcador do usuário
        new window.google.maps.Marker({
          position: userLoc,
          map: mapInstance,
          title: '📍 Sua Localização',
          icon: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png'
        });
      });
    }
  };

  const calculateRoute = async () => {
    if (!originInput || !destinationInput || !map) {
      alert('Preencha origem e destino!');
      return;
    }

    setLoading(true);
    try {
      const directionsService = new window.google.maps.DirectionsService();
      const result = await directionsService.route({
        origin: originInput,
        destination: destinationInput,
        travelMode: window.google.maps.TravelMode.DRIVING
      });

      if (directionsRenderer) {
        directionsRenderer.setMap(map);
        directionsRenderer.setDirections(result);
      }

      const leg = result.routes[0].legs[0];
      const distance = leg.distance.value; // em metros
      const duration = leg.duration.value; // em segundos
      const distanceKm = (distance / 1000).toFixed(2);
      const durationMin = Math.ceil(duration / 60);
      const estimatedPrice = (parseFloat(distanceKm) * 5 + 10).toFixed(2); // Cálculo simples

      setRouteInfo({
        distance: distanceKm,
        duration: durationMin,
        price: estimatedPrice,
        origin: originInput,
        destination: destinationInput
      });
    } catch (error) {
      console.error('Erro ao calcular rota:', error);
      alert('Erro ao calcular rota. Tente novamente!');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRide = () => {
    if (!routeInfo) {
      alert('Calcule a rota primeiro!');
      return;
    }

    const rideData = {
      origin: routeInfo.origin,
      destination: routeInfo.destination,
      distance: routeInfo.distance,
      estimatedTime: routeInfo.duration,
      estimatedPrice: routeInfo.price,
      userLocation
    };

    onRideCreate(rideData);
  };

  return (
    <div className="map-ride-container">
      <div className="map-wrapper">
        <div ref={mapRef} className="map-canvas"></div>
      </div>

      <div className="ride-panel">
        <h2>🚗 Solicitar Corrida</h2>

        <div className="input-group">
          <label>📍 Origem</label>
          <input
            type="text"
            placeholder="Onde você está?"
            value={originInput}
            onChange={(e) => setOriginInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && calculateRoute()}
          />
        </div>

        <div className="input-group">
          <label>🎯 Destino</label>
          <input
            type="text"
            placeholder="Para onde você vai?"
            value={destinationInput}
            onChange={(e) => setDestinationInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && calculateRoute()}
          />
        </div>

        <button
          className="btn-calculate"
          onClick={calculateRoute}
          disabled={loading}
        >
          {loading ? '🔄 Calculando...' : '🔍 Calcular Rota'}
        </button>

        {routeInfo && (
          <div className="route-info">
            <h3>📊 Detalhes da Corrida</h3>
            <div className="info-row">
              <span>📏 Distância:</span>
              <strong>{routeInfo.distance} km</strong>
            </div>
            <div className="info-row">
              <span>⏱️ Tempo Estimado:</span>
              <strong>{routeInfo.duration} min</strong>
            </div>
            <div className="info-row">
              <span>💰 Preço Estimado:</span>
              <strong>R$ {routeInfo.price}</strong>
            </div>
            <button
              className="btn-request"
              onClick={handleCreateRide}
            >
              🚀 Solicitar Corrida
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default MapRide;
