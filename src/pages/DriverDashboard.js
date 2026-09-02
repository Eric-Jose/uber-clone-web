import React, { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import WebSocketService from '../services/WebSocketService';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

const styles = {
  page: { minHeight: '100vh', background: '#f5f5f5', padding: 20, fontFamily: 'Arial, sans-serif' },
  card: { maxWidth: 720, margin: '0 auto 16px', background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 2px 10px rgba(0,0,0,.08)' },
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  button: { border: 0, borderRadius: 10, padding: '12px 18px', cursor: 'pointer', fontWeight: 700 },
  success: { background: '#16a34a', color: '#fff' },
  danger: { background: '#dc2626', color: '#fff' },
  primary: { background: '#111827', color: '#fff' },
  muted: { color: '#666', fontSize: 14 },
  request: { border: '1px solid #ddd', borderRadius: 12, padding: 15, marginTop: 12 }
};

function DriverDashboard() {
  const [user] = useState(() => { try { return JSON.parse(localStorage.getItem('user')) || null; } catch { return null; } });
  const [online, setOnline] = useState(false);
  const [requests, setRequests] = useState([]);
  const [activeRide, setActiveRide] = useState(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const watchId = useRef(null);
  const activeRideRef = useRef(null);

  const token = localStorage.getItem('token');
  const uid = user?.uid;
  const authConfig = { headers: { Authorization: `Bearer ${token}` } };

  useEffect(() => {
    activeRideRef.current = activeRide;
  }, [activeRide]);

  const updateDriverStatus = useCallback(async (isOnline, position) => {
    if (!uid || !token) return;
    const currentLocation = position ? { lat: position.coords.latitude, lng: position.coords.longitude } : undefined;
    await axios.post(`${BACKEND_URL}/api/drivers/${uid}/status`, { isOnline, currentLocation }, authConfig);
  }, [uid, token]);

  const sendPosition = useCallback((position) => {
    const ride = activeRideRef.current;
    if (!ride?.id || !uid) return;
    WebSocketService.sendLocation(ride.id, uid, position.coords.latitude, position.coords.longitude);
  }, [uid]);

  const startWatchingLocation = useCallback(() => {
    if (!navigator.geolocation || watchId.current !== null) return;
    watchId.current = navigator.geolocation.watchPosition(sendPosition, () => {}, { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 });
  }, [sendPosition]);

  const stopWatchingLocation = useCallback(() => {
    if (watchId.current !== null && navigator.geolocation) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
  }, []);

  useEffect(() => {
    if (!token || !uid) return undefined;
    WebSocketService.connect();
    const onRequest = (ride) => {
      if (ride?.id || ride?.rideId) {
        const normalized = { ...ride, id: ride.id || ride.rideId };
        setRequests(prev => prev.some(r => r.id === normalized.id) ? prev : [normalized, ...prev]);
      }
    };
    const onAccepted = (ride) => {
      if (ride?.id || ride?.rideId) setActiveRide(prev => ({ ...(prev || {}), ...ride, id: ride.id || ride.rideId }));
    };
    const onStarted = (ride) => {
      if (ride?.id || ride?.rideId) setActiveRide(prev => ({ ...(prev || {}), ...ride, id: ride.id || ride.rideId, status: 'IN_PROGRESS' }));
    };
    const onEnded = () => setActiveRide(null);
    WebSocketService.onNewRideRequest(onRequest);
    WebSocketService.onRideAccepted(onAccepted);
    WebSocketService.onRideStarted(onStarted);
    WebSocketService.onRideEnded(onEnded);
    return () => {
      WebSocketService.off('new-ride-request', onRequest);
      WebSocketService.off('ride-accepted', onAccepted);
      WebSocketService.off('ride-started', onStarted);
      WebSocketService.off('ride-ended', onEnded);
      stopWatchingLocation();
      WebSocketService.disconnect();
    };
  }, [token, uid, stopWatchingLocation]);

  const toggleOnline = async () => {
    if (loading) return;
    setLoading(true); setMessage('');
    try {
      if (!online) {
        if (!navigator.geolocation) throw new Error('Seu navegador não oferece localização.');
        const position = await new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 }));
        await updateDriverStatus(true, position);
        WebSocketService.connect();
        WebSocketService.joinDriversRoom();
        startWatchingLocation();
        setOnline(true); setMessage('Você está online e recebendo corridas.');
      } else {
        stopWatchingLocation();
        await updateDriverStatus(false);
        WebSocketService.disconnect();
        setOnline(false); setRequests([]); setMessage('Você ficou offline.');
      }
    } catch (error) {
      setMessage(error.response?.data?.error || error.message || 'Não foi possível alterar seu status.');
    } finally { setLoading(false); }
  };

  const acceptRide = async (ride) => {
    if (activeRideRef.current) return;
    setLoading(true); setMessage('');
    try {
      const response = await axios.post(`${BACKEND_URL}/api/rides/accept`, { rideId: ride.id }, authConfig);
      const accepted = response.data.ride || response.data;
      setActiveRide(accepted);
      setRequests(prev => prev.filter(item => item.id !== ride.id));
      WebSocketService.joinRideRoom(ride.id);
      WebSocketService.emit('accept-ride', { rideId: ride.id });
      setMessage('Corrida aceita. Vá até o passageiro.');
      startWatchingLocation();
    } catch (error) { setMessage(error.response?.data?.error || 'Não foi possível aceitar esta corrida.'); }
    finally { setLoading(false); }
  };

  const changeRideStatus = async (status) => {
    if (!activeRide?.id) return;
    setLoading(true); setMessage('');
    try {
      const response = await axios.patch(`${BACKEND_URL}/api/rides/${activeRide.id}/status`, { status }, authConfig);
      const updated = response.data.ride || response.data;
      setActiveRide(prev => ({ ...(prev || {}), ...updated, status }));
      if (status === 'IN_PROGRESS') WebSocketService.startRide(activeRide.id, uid);
      if (status === 'COMPLETED') { WebSocketService.endRide(activeRide.id, uid); setActiveRide(null); }
    } catch (error) { setMessage(error.response?.data?.error || 'Não foi possível atualizar a corrida.'); }
    finally { setLoading(false); }
  };

  if (!user || user.userType !== 'driver') {
    return <div style={styles.page}><div style={styles.card}><h2>Acesso restrito</h2><p>Entre com uma conta de motorista para acessar o painel.</p></div></div>;
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.row}>
          <div><h1 style={{ margin: 0 }}>🚗 Painel do Motorista</h1><p style={styles.muted}>{user.name || user.email}</p></div>
          <button onClick={toggleOnline} disabled={loading} style={{ ...styles.button, ...(online ? styles.danger : styles.success) }}>{loading ? 'Aguarde...' : online ? 'Ficar offline' : 'Ficar online'}</button>
        </div>
        <p><strong>Status:</strong> {online ? '🟢 Online' : '⚪ Offline'}</p>
        {message && <p style={{ padding: 10, background: '#f0f0f0', borderRadius: 8 }}>{message}</p>}
      </div>

      {activeRide && <div style={styles.card}>
        <h2>📍 Corrida atual</h2>
        <p><strong>Origem:</strong> {activeRide.origin?.address || activeRide.origin?.name || 'Localização do passageiro'}</p>
        <p><strong>Destino:</strong> {activeRide.destination?.address || activeRide.destination?.name || 'Destino informado'}</p>
        <p><strong>Distância:</strong> {activeRide.distance ? `${activeRide.distance} km` : '—'} &nbsp; <strong>Valor:</strong> {activeRide.price != null ? `R$ ${Number(activeRide.price).toFixed(2)}` : '—'}</p>
        <p><strong>Status:</strong> {activeRide.status}</p>
        <div style={styles.row}>
          {activeRide.status === 'ACCEPTED' && <button disabled={loading} onClick={() => changeRideStatus('IN_PROGRESS')} style={{ ...styles.button, ...styles.primary }}>▶️ Iniciar corrida</button>}
          {activeRide.status === 'IN_PROGRESS' && <button disabled={loading} onClick={() => changeRideStatus('COMPLETED')} style={{ ...styles.button, ...styles.success }}>✅ Finalizar corrida</button>}
        </div>
      </div>}

      <div style={styles.card}>
        <h2>🔔 Solicitações de corrida</h2>
        {!online && <p style={styles.muted}>Fique online para receber novas corridas.</p>}
        {online && requests.length === 0 && !activeRide && <p style={styles.muted}>Aguardando novas corridas...</p>}
        {requests.map(ride => <div key={ride.id} style={styles.request}>
          <p><strong>📍 Embarque:</strong> {ride.origin?.address || 'Localização informada'}</p>
          <p><strong>🏁 Destino:</strong> {ride.destination?.address || 'Destino informado'}</p>
          <p><strong>💰 Valor:</strong> {ride.price != null ? `R$ ${Number(ride.price).toFixed(2)}` : '—'} &nbsp; <strong>📏</strong> {ride.distance ? `${ride.distance} km` : '—'}</p>
          <button disabled={loading || !!activeRide} onClick={() => acceptRide(ride)} style={{ ...styles.button, ...styles.primary }}>Aceitar corrida</button>
        </div>)}
      </div>
    </div>
  );
}

export default DriverDashboard;
