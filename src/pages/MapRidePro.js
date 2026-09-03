import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import WebSocketService from '../services/WebSocketService';
import { BACKEND_URL as B } from '../config';

const NOMINATIM = 'https://nominatim.openstreetmap.org';
const PHOTON = 'https://photon.komoot.io/api/';
const OSRM = 'https://router.project-osrm.org/route/v1/driving';
const ACTIVE = ['SEARCHING', 'ACCEPTED', 'IN_PROGRESS'];
const ACTIVE_POLL_MS = 4000;
const REVERSE_GEOCODE_MS = 20000;

const css = `
.rp{min-height:100vh;font-family:Arial,sans-serif;position:relative;background:#eef1f4}.rm{position:absolute;inset:0}.panel{position:absolute;z-index:1001;top:18px;left:18px;right:18px;max-width:560px;margin:auto}.card{background:#fff;border-radius:18px;box-shadow:0 7px 25px #0003;padding:16px}.row{display:flex;justify-content:space-between;gap:10px;align-items:center}.input{width:100%;box-sizing:border-box;padding:14px;border:1px solid #ddd;border-radius:14px;font-size:16px}.suggest{margin-top:8px;max-height:260px;overflow:auto;border:1px solid #eee;border-radius:12px}.suggest button{display:block;width:100%;padding:12px;border:0;border-bottom:1px solid #eee;background:#fff;text-align:left;cursor:pointer}.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.info{background:#f5f6f7;border-radius:12px;padding:11px}.info b{display:block;color:#6b7280;font-size:12px;margin-bottom:4px}.btn{border:0;border-radius:13px;padding:13px 15px;font-weight:800;cursor:pointer}.primary{background:#111;color:#fff}.light{background:#eef0f2}.danger{background:#d92d20;color:#fff}.err{margin-top:9px;background:#fff0f0;color:#9b1c1c;padding:10px;border-radius:10px}.muted{color:#68707a;font-size:13px;line-height:1.4}.status{display:flex;gap:10px;align-items:center}.avatar{width:54px;height:54px;border-radius:50%;background:#111;color:#fff;display:flex;align-items:center;justify-content:center;overflow:hidden;font-weight:800}.avatar img{width:100%;height:100%;object-fit:cover}.bar{height:7px;background:#eceff2;border-radius:9px;overflow:hidden}.bar i{display:block;height:100%;background:#111}.actions{display:flex;gap:10px;margin-top:12px}.actions>*{flex:1}@media(max-width:640px){.panel{top:10px;left:10px;right:10px}.grid{grid-template-columns:1fr}.card{padding:14px}}
`;

function Avatar({ photo, name }) {
  return <div className="avatar">{photo ? <img src={photo} alt={name || 'Perfil'} /> : String(name || 'U')[0].toUpperCase()}</div>;
}

function apiError(response, data, fallback) {
  if (data?.error) return String(data.error);
  if (response?.status === 0) return 'Não foi possível conectar ao servidor. Verifique o backend do UberClone.';
  return fallback;
}

function normalizeLocation(location) {
  if (!location) return null;
  const lat = Number(location.lat ?? location.latitude);
  const lng = Number(location.lng ?? location.longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

export default function MapRidePro({ onRideCreate, onBack }) {
  const mapEl = useRef(null);
  const map = useRef(null);
  const userMarker = useRef(null);
  const driverMarker = useRef(null);
  const routeLayer = useRef(null);
  const reverseTimer = useRef(null);
  const lastReverseAt = useRef(0);
  const searchTimer = useRef(null);
  const searchSeq = useRef(0);
  const pollTimer = useRef(null);

  const [origin, setOrigin] = useState(null);
  const [originText, setOriginText] = useState('Obtendo localização…');
  const [destination, setDestination] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [trip, setTrip] = useState(null);
  const [ride, setRide] = useState(null);
  const [driverLoc, setDriverLoc] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [restoring, setRestoring] = useState(true);

  const syncActiveRide = async () => {
    const token = localStorage.getItem('token');
    if (!token) return null;
    try {
      const response = await fetch(`${B}/api/rides/active`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store'
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) return null;
      const active = data.ride || (ACTIVE.includes(data.status) ? data : null);
      if (active?.id && ACTIVE.includes(active.status)) {
        setRide(active);
        setDriverLoc(normalizeLocation(active.driverLocation));
        return active;
      }
    } catch (_) {}
    return null;
  };

  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    const instance = L.map(mapEl.current, { zoomControl: false }).setView([-24.5345, -55.7221], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(instance);
    L.control.zoom({ position: 'bottomright' }).addTo(instance);
    map.current = instance;
    setTimeout(() => instance.invalidateSize(), 150);

    return () => {
      clearTimeout(reverseTimer.current);
      clearTimeout(searchTimer.current);
      clearTimeout(pollTimer.current);
      WebSocketService.disconnect();
      instance.remove();
      style.remove();
    };
  }, []);

  useEffect(() => {
    let alive = true;
    const restore = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setRestoring(false);
        return;
      }
      const active = await syncActiveRide();
      if (!alive) return;
      if (!active) {
        try {
          const response = await fetch(`${B}/api/rides/history?limit=20`, {
            headers: { Authorization: `Bearer ${token}` },
            cache: 'no-store'
          });
          const data = await response.json().catch(() => ({}));
          const recovered = (data.rides || []).find(item => ACTIVE.includes(item.status));
          if (alive && recovered) {
            setRide(recovered);
            setDriverLoc(normalizeLocation(recovered.driverLocation));
          }
        } catch (_) {}
      }
      if (alive) setRestoring(false);
    };
    restore();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!ride?.id || !ACTIVE.includes(ride.status)) {
      clearTimeout(pollTimer.current);
      return undefined;
    }

    let cancelled = false;
    const poll = async () => {
      if (cancelled) return;
      const active = await syncActiveRide();
      if (!cancelled && active) {
        setRide(active);
        setDriverLoc(normalizeLocation(active.driverLocation));
      }
      pollTimer.current = window.setTimeout(poll, ACTIVE_POLL_MS);
    };

    pollTimer.current = window.setTimeout(poll, ACTIVE_POLL_MS);
    return () => {
      cancelled = true;
      clearTimeout(pollTimer.current);
    };
  }, [ride?.id, ride?.status]);

  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Este navegador não oferece localização.');
      return undefined;
    }

    let alive = true;
    const reverseGeocode = async (lat, lng) => {
      const now = Date.now();
      if (now - lastReverseAt.current < REVERSE_GEOCODE_MS) return;
      lastReverseAt.current = now;
      try {
        const query = new URLSearchParams({
          format: 'jsonv2', lat: String(lat), lon: String(lng), zoom: '18',
          addressdetails: '1', 'accept-language': 'pt-BR'
        });
        const response = await fetch(`${NOMINATIM}/reverse?${query}`);
        const data = await response.json();
        const address = data.address || {};
        const city = address.city || address.town || address.village || address.municipality || '';
        if (!alive) return;
        setOriginText(city ? `${city}${address.state ? ` - ${address.state}` : ''}` : (data.display_name || 'Minha localização atual'));
      } catch (_) {
        if (alive) setOriginText('Minha localização atual');
      }
    };

    const onPosition = position => {
      const current = normalizeLocation(position.coords);
      if (!current || !alive || !map.current) return;
      setOrigin(current);
      if (!userMarker.current) {
        userMarker.current = L.circleMarker([current.lat, current.lng], {
          radius: 8, color: '#fff', weight: 3, fillColor: '#1a73e8', fillOpacity: 1
        }).addTo(map.current);
      } else {
        userMarker.current.setLatLng([current.lat, current.lng]);
      }
      if (!ride) map.current.setView([current.lat, current.lng], 17);
      clearTimeout(reverseTimer.current);
      reverseTimer.current = window.setTimeout(() => reverseGeocode(current.lat, current.lng), 250);
    };

    const onError = () => {
      if (alive) setError('Permita a localização precisa para usar sua posição como embarque.');
    };

    navigator.geolocation.getCurrentPosition(onPosition, onError, {
      enableHighAccuracy: true, timeout: 20000, maximumAge: 5000
    });
    const watchId = navigator.geolocation.watchPosition(onPosition, onError, {
      enableHighAccuracy: true, timeout: 20000, maximumAge: 3000
    });

    return () => {
      alive = false;
      navigator.geolocation.clearWatch(watchId);
      clearTimeout(reverseTimer.current);
    };
  }, [ride?.id]);

  useEffect(() => {
    const location = normalizeLocation(driverLoc);
    if (!location || !map.current) return;
    if (!driverMarker.current) {
      driverMarker.current = L.circleMarker([location.lat, location.lng], {
        radius: 10, color: '#fff', weight: 3, fillColor: '#111', fillOpacity: 1
      }).addTo(map.current);
    } else {
      driverMarker.current.setLatLng([location.lat, location.lng]);
    }
  }, [driverLoc]);

  useEffect(() => {
    const accepted = payload => {
      const next = payload?.ride || payload;
      if (!next?.id || (ride?.id && next.id !== ride.id)) return;
      setRide(current => ({ ...current, ...next }));
      if (next.driverLocation) setDriverLoc(normalizeLocation(next.driverLocation));
    };
    const location = payload => {
      if (ride?.id && payload?.rideId && payload.rideId !== ride.id) return;
      const next = normalizeLocation(payload);
      if (next) setDriverLoc(next);
    };
    const changed = payload => {
      if (payload?.rideId !== ride?.id) return;
      const next = payload.ride || {};
      setRide(current => ({ ...current, ...next }));
      if (next.driverLocation) setDriverLoc(normalizeLocation(next.driverLocation));
    };
    const connected = () => {
      if (ride?.id) WebSocketService.joinRideRoom(ride.id);
    };

    WebSocketService.onRideAccepted(accepted);
    WebSocketService.onDriverLocationUpdate(location);
    WebSocketService.onRideStarted(changed);
    WebSocketService.onRideEnded(changed);
    WebSocketService.onRideCancelled(changed);
    WebSocketService.onConnect(connected);

    if (ride?.id) {
      WebSocketService.connect();
      WebSocketService.joinRideRoom(ride.id);
    }

    return () => {
      WebSocketService.off('ride-accepted', accepted);
      WebSocketService.off('update-driver-location', location);
      WebSocketService.off('ride-started', changed);
      WebSocketService.off('ride-ended', changed);
      WebSocketService.off('ride-cancelled', changed);
      WebSocketService.offConnect(connected);
    };
  }, [ride?.id]);

  const search = value => {
    setDestination(value);
    setTrip(null);
    setError('');
    clearTimeout(searchTimer.current);
    if (value.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    const sequence = ++searchSeq.current;
    setSearching(true);
    searchTimer.current = window.setTimeout(async () => {
      try {
        const query = new URLSearchParams({
          format: 'jsonv2', q: value.trim(), limit: '6', countrycodes: 'br',
          addressdetails: '1', 'accept-language': 'pt-BR'
        });
        let results = [];
        try {
          const response = await fetch(`${NOMINATIM}/search?${query}`);
          results = await response.json();
        } catch (_) {}

        if (!Array.isArray(results) || !results.length) {
          const photonQuery = new URLSearchParams({
            q: value.trim(), limit: '6', lang: 'pt',
            lat: String(origin?.lat || -23.55), lon: String(origin?.lng || -46.63), zoom: '18'
          });
          const response = await fetch(`${PHOTON}?${photonQuery}`);
          const data = await response.json();
          results = (data.features || []).map((feature, index) => {
            const [lng, lat] = feature.geometry?.coordinates || [];
            const props = feature.properties || {};
            return {
              place_id: `photon-${index}-${lat}-${lng}`,
              lat: String(lat),
              lon: String(lng),
              display_name: [props.name, props.street, props.housenumber, props.city || props.town, props.state].filter(Boolean).join(', ') || 'Endereço encontrado'
            };
          });
        }
        if (sequence === searchSeq.current) setSuggestions(Array.isArray(results) ? results : []);
      } catch (_) {
        if (sequence === searchSeq.current) setError('Não foi possível pesquisar o endereço agora.');
      } finally {
        if (sequence === searchSeq.current) setSearching(false);
      }
    }, 350);
  };

  const calculateTrip = async suggestion => {
    if (!origin) {
      setError('Aguardando sua localização.');
      return;
    }
    const lat = Number(suggestion.lat);
    const lng = Number(suggestion.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    setBusy(true);
    setError('');
    setSuggestions([]);

    try {
      let route = null;
      try {
        const response = await fetch(`${OSRM}/${origin.lng},${origin.lat};${lng},${lat}?overview=full&geometries=geojson&steps=false`);
        const data = await response.json();
        route = data.routes?.[0] || null;
      } catch (_) {}

      if (!route) {
        const distanceKm = Math.max(
          0.01,
          Math.sqrt(
            ((lat - origin.lat) * 111) ** 2 +
            ((lng - origin.lng) * 111 * Math.cos(origin.lat * Math.PI / 180)) ** 2
          )
        );
        route = {
          distance: distanceKm * 1000,
          duration: Math.max(60, distanceKm / 35 * 3600),
          geometry: { type: 'LineString', coordinates: [[origin.lng, origin.lat], [lng, lat]] }
        };
      }

      if (routeLayer.current) routeLayer.current.remove();
      routeLayer.current = L.geoJSON(route.geometry, {
        style: {
          color: '#111', weight: 6, opacity: 0.9,
          dashArray: route.geometry?.type === 'LineString' ? '8 8' : undefined
        }
      }).addTo(map.current);
      map.current.fitBounds(routeLayer.current.getBounds(), { padding: [50, 260] });

      const km = route.distance / 1000;
      const minutes = Math.max(1, Math.ceil(route.duration / 60));
      const destinationText = suggestion.display_name || 'Destino';
      setDestination(destinationText);
      setTrip({
        distance: km,
        duration: minutes,
        price: km * 5 + 10,
        origin: originText,
        destination: destinationText,
        originLocation: origin,
        destinationLocation: { lat, lng }
      });
    } catch (_) {
      setError('Não foi possível calcular a rota. Escolha um endereço sugerido.');
    } finally {
      setBusy(false);
    }
  };

  const requestRide = async () => {
    if (!trip || busy) return;
    const token = localStorage.getItem('token');
    if (!token) {
      setError('Sua sessão expirou. Entre novamente.');
      return;
    }

    setBusy(true);
    setError('');
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(`${B}/api/rides/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          origin: { address: trip.origin, location: trip.originLocation },
          destination: { address: trip.destination, location: trip.destinationLocation },
          distance: Number(trip.distance.toFixed(2)),
          price: Number(trip.price.toFixed(2))
        }),
        signal: controller.signal
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw Error(apiError(response, data, 'Não foi possível solicitar a corrida.'));
      if (!data.ride?.id) throw Error('O servidor não retornou a corrida criada.');

      setRide(data.ride);
      setDriverLoc(normalizeLocation(data.ride.driverLocation));
      WebSocketService.connect();
      WebSocketService.joinRideRoom(data.ride.id);
      onRideCreate?.(data.ride);
    } catch (requestError) {
      setError(requestError.name === 'AbortError' ? 'O servidor demorou para responder. Tente novamente.' : (requestError.message || 'Erro ao criar corrida.'));
    } finally {
      window.clearTimeout(timeout);
      setBusy(false);
    }
  };

  const cancelRide = async () => {
    if (!ride?.id || busy || !window.confirm('Deseja cancelar esta corrida?')) return;
    const token = localStorage.getItem('token');
    setBusy(true);
    try {
      const response = await fetch(`${B}/api/rides/${ride.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: 'CANCELLED', cancellationReason: 'Cancelada pelo passageiro' })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw Error(apiError(response, data, 'Erro ao cancelar.'));
      setRide(data.ride || { ...ride, status: 'CANCELLED' });
      setDriverLoc(null);
      WebSocketService.cancelRide(ride.id);
    } catch (cancelError) {
      setError(cancelError.message || 'Erro ao cancelar.');
    } finally {
      setBusy(false);
    }
  };

  const labels = {
    SEARCHING: 'Procurando motorista',
    ACCEPTED: 'Motorista a caminho',
    IN_PROGRESS: 'Corrida em andamento',
    COMPLETED: 'Corrida concluída',
    CANCELLED: 'Corrida cancelada'
  };
  const progress = ride?.status === 'SEARCHING' ? 28 : ride?.status === 'ACCEPTED' ? 60 : ride?.status === 'IN_PROGRESS' ? 82 : 100;

  return (
    <div className="rp">
      <div className="rm" ref={mapEl} />
      <div className="panel">
        <div className="card">
          <div className="row">
            <div>
              <h2 style={{ margin: 0 }}>Para onde vamos?</h2>
              <div className="muted">Origem: {originText}</div>
            </div>
            <button className="btn light" onClick={onBack}>Perfil</button>
          </div>

          {restoring && <p className="muted">Verificando corrida ativa…</p>}

          {!ride && (
            <>
              <div style={{ marginTop: 12 }}>
                <input
                  className="input"
                  value={destination}
                  onChange={event => search(event.target.value)}
                  placeholder="Digite rua, número, cidade ou bairro"
                />
              </div>
              {searching && <p className="muted">Buscando endereços…</p>}
              {suggestions.length > 0 && (
                <div className="suggest">
                  {suggestions.map(suggestion => (
                    <button key={`${suggestion.place_id}-${suggestion.lat}`} onClick={() => calculateTrip(suggestion)}>
                      <b>{String(suggestion.display_name || 'Endereço').split(',').slice(0, 2).join(',')}</b>
                      <span className="muted">{suggestion.display_name}</span>
                    </button>
                  ))}
                </div>
              )}

              {trip && (
                <div className="card" style={{ marginTop: 12 }}>
                  <div className="grid">
                    <div className="info"><b>Distância</b>{trip.distance.toFixed(1)} km</div>
                    <div className="info"><b>Tempo</b>{trip.duration} min</div>
                    <div className="info"><b>Preço</b>R$ {trip.price.toFixed(2)}</div>
                    <div className="info"><b>Destino</b>{destination}</div>
                  </div>
                  <div className="actions">
                    <button className="btn primary" disabled={busy} onClick={requestRide}>
                      {busy ? 'Solicitando…' : 'Solicitar corrida'}
                    </button>
                  </div>
                </div>
              )}
              {error && <div className="err">{error}</div>}
            </>
          )}

          {ride && (
            <div style={{ marginTop: 12 }}>
              <div className="bar"><i style={{ width: `${progress}%` }} /></div>
              <div style={{ marginTop: 9, fontWeight: 800 }}>{labels[ride.status] || 'Status da corrida'}</div>
              <div className="muted">{ride.origin?.address || originText} → {ride.destination?.address || 'Destino'}</div>

              {ride.driverId ? (
                <div className="status" style={{ marginTop: 12 }}>
                  <Avatar photo={ride.driverProfilePhoto} name={ride.driverName} />
                  <div>
                    <b>{ride.driverName || 'Motorista'}</b>
                    <div className="muted">
                      Motorista encontrado{ride.price != null ? ` • R$ ${Number(ride.price).toFixed(2)}` : ''}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="muted">Estamos oferecendo sua corrida ao motorista mais próximo. Assim que aceitar, os dados aparecerão aqui.</p>
              )}

              {ACTIVE.includes(ride.status) && (
                <div className="actions">
                  <button className="btn danger" disabled={busy} onClick={cancelRide}>Cancelar corrida</button>
                </div>
              )}
              {error && <div className="err">{error}</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
