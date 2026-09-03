import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { BACKEND_URL } from '../config';
import WebSocketService from '../services/WebSocketService';

const ACTIVE = ['ACCEPTED', 'IN_PROGRESS'];

function Avatar({ photo, name }) {
  const initial = String(name || 'P').trim().charAt(0).toUpperCase() || 'P';
  return (
    <div className="driver-avatar">
      {photo ? <img src={photo} alt={name || 'Passageiro'} /> : initial}
    </div>
  );
}

export default function DriverDashboardPro() {
  const [user] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch (_) { return null; }
  });
  const [online, setOnline] = useState(false);
  const [requests, setRequests] = useState([]);
  const [ride, setRide] = useState(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const rideRef = useRef(null);
  const onlineRef = useRef(false);
  const watchRef = useRef(null);

  const token = localStorage.getItem('token');
  const uid = user?.uid;
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => { rideRef.current = ride; }, [ride]);
  useEffect(() => { onlineRef.current = online; }, [online]);

  const stopLocation = () => {
    if (watchRef.current !== null && navigator.geolocation) navigator.geolocation.clearWatch(watchRef.current);
    watchRef.current = null;
  };

  const sendLocation = (position) => {
    const lat = Number(position.coords.latitude);
    const lng = Number(position.coords.longitude);
    if (rideRef.current?.id) WebSocketService.sendLocation(rideRef.current.id, uid, lat, lng);
    else if (onlineRef.current) WebSocketService.sendPresenceLocation(lat, lng);
  };

  const startLocation = () => {
    if (!navigator.geolocation || watchRef.current !== null) return;
    watchRef.current = navigator.geolocation.watchPosition(sendLocation, () => {}, { enableHighAccuracy: true, maximumAge: 4000, timeout: 10000 });
  };

  useEffect(() => {
    if (!token || !uid) return undefined;
    WebSocketService.connect();

    const onRequest = (data) => {
      const item = { ...data, id: data?.id || data?.rideId };
      if (!item.id) return;
      setRequests((current) => current.some((r) => r.id === item.id) ? current : [item, ...current]);
    };
    const onAccepted = (data) => {
      const item = data?.ride || data;
      if (item?.id) setRide(item);
    };
    const onStarted = (data) => {
      const item = data?.ride || data;
      if (item?.id && item.id === rideRef.current?.id) setRide((current) => ({ ...current, ...item, status: 'IN_PROGRESS' }));
    };
    const onEnded = (data) => {
      const item = data?.ride || data;
      if (item?.id && item.id === rideRef.current?.id) {
        setRide((current) => ({ ...current, ...item, status: 'COMPLETED' }));
        stopLocation();
      }
    };
    const onCancelled = (data) => {
      if (data?.rideId && data.rideId === rideRef.current?.id) {
        setRide(null);
        stopLocation();
        setMessage('Corrida cancelada.');
      }
    };

    WebSocketService.onNewRideRequest(onRequest);
    WebSocketService.onRideAccepted(onAccepted);
    WebSocketService.onRideStarted(onStarted);
    WebSocketService.onRideEnded(onEnded);
    WebSocketService.onRideCancelled(onCancelled);

    return () => {
      WebSocketService.off('new-ride-request', onRequest);
      WebSocketService.off('ride-accepted', onAccepted);
      WebSocketService.off('ride-started', onStarted);
      WebSocketService.off('ride-ended', onEnded);
      WebSocketService.off('ride-cancelled', onCancelled);
      stopLocation();
      WebSocketService.disconnect();
    };
  }, [token, uid]);

  useEffect(() => {
    if (!token || !uid) return undefined;
    let cancelled = false;

    Promise.all([
      axios.get(`${BACKEND_URL}/api/drivers/me`, { headers }),
      axios.get(`${BACKEND_URL}/api/rides/history?limit=20`, { headers })
    ]).then(([driverResponse, ridesResponse]) => {
      if (cancelled) return;

      const driver = driverResponse.data?.driver;
      const dbOnline = driver?.status === 'approved' && driver?.isOnline === true;
      onlineRef.current = dbOnline;
      setOnline(dbOnline);

      const current = (ridesResponse.data?.rides || []).find(
        (item) => ACTIVE.includes(item.status) && String(item.driverId) === String(uid)
      );
      if (current) setRide(current);

      if (dbOnline) {
        WebSocketService.connect();
        startLocation();
      }
    }).catch(() => {});

    return () => { cancelled = true; };
  }, [token, uid]);

  const toggleOnline = async () => {
    if (busy || !uid) return;
    setBusy(true);
    setMessage('');
    try {
      if (!onlineRef.current) {
        if (!navigator.geolocation) throw new Error('Localização não disponível.');
        const position = await new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 12000 }));
        await axios.post(`${BACKEND_URL}/api/drivers/${uid}/status`, { isOnline: true, currentLocation: { lat: position.coords.latitude, lng: position.coords.longitude } }, { headers });
        WebSocketService.connect();
        WebSocketService.joinDriversRoom();
        WebSocketService.sendPresenceLocation(position.coords.latitude, position.coords.longitude);
        onlineRef.current = true;
        setOnline(true);
        startLocation();
        setMessage('Você está online e receberá corridas próximas.');
      } else {
        stopLocation();
        await axios.post(`${BACKEND_URL}/api/drivers/${uid}/status`, { isOnline: false }, { headers });
        onlineRef.current = false;
        setOnline(false);
        WebSocketService.disconnect();
        setRequests([]);
        setMessage('Você ficou offline.');
      }
    } catch (error) {
      setMessage(error.response?.data?.error || error.message || 'Não foi possível alterar o status.');
    } finally {
      setBusy(false);
    }
  };

  const acceptRide = async (request) => {
    if (busy || ride || !request?.id) return;
    setBusy(true);
    setMessage('');
    try {
      const { data } = await axios.post(`${BACKEND_URL}/api/rides/accept`, { rideId: request.id }, { headers });
      setRide(data.ride);
      setRequests((current) => current.filter((item) => item.id !== request.id));
      WebSocketService.connect();
      WebSocketService.joinRideRoom(request.id);
      WebSocketService.acceptRide(request.id, uid);
      startLocation();
      setMessage('Corrida aceita. Vá até o passageiro.');
    } catch (error) {
      setMessage(error.response?.data?.error || 'Esta corrida já foi aceita ou não está disponível.');
    } finally {
      setBusy(false);
    }
  };

  const updateStatus = async (status) => {
    if (!ride?.id || busy) return;
    setBusy(true);
    setMessage('');
    try {
      const { data } = await axios.patch(`${BACKEND_URL}/api/rides/${ride.id}/status`, { status }, { headers });
      setRide(data.ride);
      if (status === 'IN_PROGRESS') WebSocketService.startRide(ride.id, uid);
      if (status === 'COMPLETED') {
        WebSocketService.endRide(ride.id, uid);
        stopLocation();
        setMessage('Corrida concluída com sucesso.');
      }
    } catch (error) {
      setMessage(error.response?.data?.error || 'Não foi possível atualizar a corrida.');
    } finally {
      setBusy(false);
    }
  };

  const cancelRide = async () => {
    if (!ride?.id || busy) return;
    if (!window.confirm('Cancelar esta corrida?')) return;
    setBusy(true);
    try {
      await axios.patch(`${BACKEND_URL}/api/rides/${ride.id}/status`, { status: 'CANCELLED', cancellationReason: 'Cancelada pelo motorista' }, { headers });
      WebSocketService.cancelRide(ride.id);
      setRide(null);
      stopLocation();
      setMessage('Corrida cancelada.');
    } catch (error) {
      setMessage(error.response?.data?.error || 'Erro ao cancelar a corrida.');
    } finally {
      setBusy(false);
    }
  };

  if (!user || user.userType !== 'driver') return <div style={{ padding: 30 }}>Acesso restrito ao motorista.</div>;

  return (
    <div className="driver-pro">
      <style>{`.driver-pro{min-height:100vh;background:#f3f4f6;padding:18px;font-family:Arial}.driver-box{max-width:760px;margin:0 auto 15px;background:#fff;border-radius:18px;padding:18px;box-shadow:0 4px 18px rgba(0,0,0,.08)}.driver-row{display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap}.driver-btn{border:0;border-radius:12px;padding:12px 16px;font-weight:800;cursor:pointer}.driver-on{background:#16a34a;color:#fff}.driver-off,.driver-danger{background:#dc2626;color:#fff}.driver-dark{background:#111827;color:#fff}.driver-muted{color:#69717b;font-size:13px;line-height:1.45}.driver-avatar{width:52px;height:52px;border-radius:50%;background:#111;color:#fff;display:flex;align-items:center;justify-content:center;overflow:hidden;font-weight:800}.driver-avatar img{width:100%;height:100%;object-fit:cover}.driver-person{display:flex;gap:10px;align-items:center}.driver-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.driver-info{background:#f5f6f7;border-radius:12px;padding:11px}.driver-info b{display:block;color:#6b7280;font-size:12px;margin-bottom:4px}.driver-request{border:1px solid #e1e5e9;border-radius:15px;padding:14px;margin-top:10px}@media(max-width:640px){.driver-pro{padding:10px}.driver-grid{grid-template-columns:1fr}}`}</style>
      <div className="driver-box">
        <div className="driver-row">
          <div><h1 style={{ margin: 0 }}>🚗 Painel do motorista</h1><div className="driver-muted">{user.name || user.email}</div></div>
          <button className={`driver-btn ${online ? 'driver-off' : 'driver-on'}`} disabled={busy} onClick={toggleOnline}>{busy ? 'Aguarde…' : online ? 'Ficar offline' : 'Ficar online'}</button>
        </div>
        <p><b>Status:</b> {online ? '🟢 Online' : '⚪ Offline'}</p>
        {message && <div className="driver-info">{message}</div>}
      </div>

      {ride && <div className="driver-box">
        <div className="driver-row"><h2>📍 Corrida atual</h2><b>{ride.status}</b></div>
        <div className="driver-person"><Avatar photo={ride.passengerProfilePhoto} name={ride.passengerName} /><div><b>{ride.passengerName || 'Passageiro'}</b><div className="driver-muted">Foto do passageiro vinculada à corrida.</div></div></div>
        <div className="driver-grid" style={{ marginTop: 12 }}>
          <div className="driver-info"><b>Embarque</b>{ride.origin?.address || '—'}</div>
          <div className="driver-info"><b>Destino</b>{ride.destination?.address || '—'}</div>
          <div className="driver-info"><b>Valor</b>R$ {Number(ride.price || 0).toFixed(2)}</div>
          <div className="driver-info"><b>Distância</b>{ride.distance || '—'} km</div>
        </div>
        <div className="driver-row" style={{ marginTop: 12 }}>
          {ride.status === 'ACCEPTED' && <button className="driver-btn driver-dark" disabled={busy} onClick={() => updateStatus('IN_PROGRESS')}>▶️ Iniciar</button>}
          {ride.status === 'IN_PROGRESS' && <button className="driver-btn driver-on" disabled={busy} onClick={() => updateStatus('COMPLETED')}>✅ Finalizar</button>}
          {ACTIVE.includes(ride.status) && <button className="driver-btn driver-danger" disabled={busy} onClick={cancelRide}>Cancelar</button>}
        </div>
      </div>}

      <div className="driver-box">
        <h2>🔔 Solicitações</h2>
        {!online && <p className="driver-muted">Fique online para receber corridas.</p>}
        {online && requests.length === 0 && <p className="driver-muted">Aguardando a próxima corrida mais próxima…</p>}
        {online && requests.map((request) => (
          <div className="driver-request" key={request.id}>
            <div className="driver-person"><Avatar photo={request.passengerProfilePhoto} name={request.passengerName} /><div><b>{request.passengerName || 'Passageiro'}</b><div className="driver-muted">{request.estimatedDistanceKm != null ? `${request.estimatedDistanceKm} km até o embarque` : 'Perto de você'}</div></div></div>
            <p>📍 {request.origin?.address || 'Embarque informado'}</p>
            <p>🏁 {request.destination?.address || 'Destino informado'}</p>
            <p><b>R$ {Number(request.price || 0).toFixed(2)}</b> • {request.distance || '—'} km</p>
            <button className="driver-btn driver-dark" disabled={busy || !!ride} onClick={() => acceptRide(request)}>Aceitar corrida</button>
          </div>
        ))}
      </div>
    </div>
  );
}
