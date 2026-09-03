import io from 'socket.io-client';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

class WebSocketService {
  constructor() { this.socket = null; }

  connect() {
    if (this.socket?.connected) return this.socket;
    const token = localStorage.getItem('token');
    if (!token) return null;
    this.socket = io(BACKEND_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 10
    });
    return this.socket;
  }

  disconnect() {
    if (this.socket) { this.socket.disconnect(); this.socket = null; }
  }

  ensureSocket() { return this.socket || this.connect(); }

  onConnect(callback) { return this.ensureSocket()?.on('connect', callback); }
  offConnect(callback) { this.socket?.off('connect', callback); }

  joinRideRoom(rideId) { if (rideId) this.ensureSocket()?.emit('join-ride-room', rideId); }
  leaveRideRoom(rideId) { if (rideId) this.ensureSocket()?.emit('leave-ride-room', rideId); }
  joinDriversRoom() { this.ensureSocket()?.emit('join-drivers-room'); }
  joinDriverRoom() { this.ensureSocket()?.emit('join-drivers-room'); }

  sendPresenceLocation(latitude, longitude) {
    this.ensureSocket()?.emit('driver-presence-location', { latitude, longitude, timestamp: new Date().toISOString() });
  }

  sendLocation(rideId, driverId, latitude, longitude) {
    this.ensureSocket()?.emit('driver-location', { rideId, driverId, latitude, longitude, timestamp: new Date().toISOString() });
  }

  requestRide(rideData) {
    const socket = this.ensureSocket();
    if (!socket) return;
    const emitRequest = () => socket.emit('request-ride', rideData);
    if (socket.connected) emitRequest();
    else socket.once('connect', emitRequest);
  }

  acceptRide(rideId, driverId) { this.ensureSocket()?.emit('accept-ride', { rideId, driverId }); }
  startRide(rideId, driverId) { this.ensureSocket()?.emit('start-ride', { rideId, driverId }); }
  endRide(rideId, driverId) { this.ensureSocket()?.emit('end-ride', { rideId, driverId }); }
  cancelRide(rideId) { if (rideId) this.ensureSocket()?.emit('ride-cancelled', { rideId }); }

  onDriverLocationUpdate(callback) { return this.ensureSocket()?.on('update-driver-location', callback); }
  onNewRideRequest(callback) { return this.ensureSocket()?.on('new-ride-request', callback); }
  onRideAccepted(callback) { return this.ensureSocket()?.on('ride-accepted', callback); }
  onRideStarted(callback) { return this.ensureSocket()?.on('ride-started', callback); }
  onRideEnded(callback) { return this.ensureSocket()?.on('ride-ended', callback); }
  onRideCancelled(callback) { return this.ensureSocket()?.on('ride-cancelled', callback); }
  off(event, callback) { this.socket?.off(event, callback); }
}

export default new WebSocketService();
