import io from 'socket.io-client';
import { BACKEND_URL } from '../config';

class WebSocketService {
  constructor() {
    this.socket = null;
    this.activeRideId = null;
    this.driverRoomRequested = false;
    this.cancelRefreshBound = false;
    this.authToken = null;
  }

  connect() {
    const token = localStorage.getItem('token');
    if (!token) {
      this.disconnect();
      return null;
    }

    // Nunca reutilizar um socket autenticado com o JWT de outra sessão.
    if (this.socket && this.authToken && this.authToken !== token) {
      this.disconnect();
    }

    // Se o socket existe, mas perdeu a conexão, força a reconexão em vez de
    // simplesmente devolver uma instância desconectada.
    if (this.socket) {
      this.authToken = token;
      if (!this.socket.connected && !this.socket.active) this.socket.connect();
      return this.socket;
    }

    this.authToken = token;
    this.socket = io(BACKEND_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      timeout: 10000,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 15,
      closeOnBeforeunload: true
    });

    this.socket.on('connect', () => {
      // Toda reconexão cria um novo socket e, portanto, perde as salas antigas.
      // Reentra automaticamente na corrida e na sala de motoristas quando
      // essas salas foram solicitadas pela tela atual.
      if (this.activeRideId) this.socket.emit('join-ride-room', this.activeRideId);
      if (this.driverRoomRequested) this.socket.emit('join-drivers-room');
    });
    this.socket.on('connect_error', (error) => console.warn('Socket.IO:', error?.message || 'falha de conexão'));
    this.bindPassengerCancellationRefresh();
    return this.socket;
  }

  bindPassengerCancellationRefresh() {
    if (this.cancelRefreshBound || !this.socket) return;
    this.cancelRefreshBound = true;
    this.socket.on('ride-cancelled', (payload) => {
      const rideId = payload?.rideId || payload?.ride?.id;
      let user = null;
      try { user = JSON.parse(localStorage.getItem('user') || 'null'); } catch (_) {}
      if (!rideId || String(rideId) !== String(this.activeRideId) || user?.userType !== 'passenger') return;
      this.activeRideId = null;
      window.setTimeout(() => window.location.reload(), 50);
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    this.authToken = null;
    this.activeRideId = null;
    this.driverRoomRequested = false;
    this.cancelRefreshBound = false;
  }

  ensureSocket() { return this.socket || this.connect(); }

  onConnect(callback) { return this.ensureSocket()?.on('connect', callback); }
  offConnect(callback) { this.socket?.off('connect', callback); }
  joinRideRoom(rideId) {
    if (!rideId) return;
    this.activeRideId = rideId;
    this.ensureSocket()?.emit('join-ride-room', rideId);
  }
  leaveRideRoom(rideId) {
    if (rideId && this.activeRideId === rideId) this.activeRideId = null;
    if (rideId) this.ensureSocket()?.emit('leave-ride-room', rideId);
  }
  joinDriversRoom() {
    this.driverRoomRequested = true;
    const socket = this.ensureSocket();
    if (socket) socket.emit('join-drivers-room');
  }
  leaveDriversRoom() {
    this.driverRoomRequested = false;
  }
  joinDriverRoom() { this.joinDriversRoom(); }

  sendPresenceLocation(latitude, longitude) { this.ensureSocket()?.emit('driver-presence-location', { latitude, longitude, timestamp: new Date().toISOString() }); }
  sendLocation(rideId, driverId, latitude, longitude) { this.ensureSocket()?.emit('driver-location', { rideId, driverId, latitude, longitude, timestamp: new Date().toISOString() }); }
  sendPassengerLocation(rideId, latitude, longitude) { this.ensureSocket()?.emit('passenger-location', { rideId, latitude, longitude, timestamp: new Date().toISOString() }); }

  requestRide(rideData) { return Boolean(rideData?.rideId); }
  acceptRide(rideId, driverId) { return Boolean(rideId && driverId); }

  // Alterações de estado são feitas pela API HTTP. O Socket.IO apenas
  // distribui as notificações emitidas pelo backend após a alteração.
  startRide(rideId, driverId) { return Boolean(rideId && driverId); }
  endRide(rideId, driverId) { return Boolean(rideId && driverId); }
  cancelRide(rideId) { return Boolean(rideId); }

  onDriverLocationUpdate(callback) { return this.ensureSocket()?.on('update-driver-location', callback); }
  onPassengerLocationUpdate(callback) { return this.ensureSocket()?.on('passenger-location-update', callback); }
  onNewRideRequest(callback) { return this.ensureSocket()?.on('new-ride-request', callback); }
  onRideUnavailable(callback) { return this.ensureSocket()?.on('ride-unavailable', callback); }
  onRideAccepted(callback) { return this.ensureSocket()?.on('ride-accepted', callback); }
  onRideStarted(callback) {
    const socket = this.ensureSocket();
    if (!socket) return;
    socket.on('ride-started', callback);
    socket.on('ride_in_progress', callback);
    return socket;
  }
  onRideEnded(callback) {
    const socket = this.ensureSocket();
    if (!socket) return;
    socket.on('ride-ended', callback);
    socket.on('ride-completed', callback);
    return socket;
  }
  onRideCancelled(callback) { return this.ensureSocket()?.on('ride-cancelled', callback); }
  off(event, callback) {
    if (!this.socket) return;
    this.socket.off(event, callback);
    if (event === 'ride-started') this.socket.off('ride_in_progress', callback);
    if (event === 'ride-ended') this.socket.off('ride-completed', callback);
  }
}

const webSocketService = new WebSocketService();
export default webSocketService;
