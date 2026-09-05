import io from 'socket.io-client';
import { BACKEND_URL } from '../config';

class WebSocketService {
  constructor() {
    this.socket = null;
    this.activeRideId = null;
  }

  connect() {
    if (this.socket?.connected) return this.socket;
    const token = localStorage.getItem('token');
    if (!token) return null;
    if (!this.socket) {
      this.socket = io(BACKEND_URL, {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 10
      });
      this.socket.on('connect', () => {
        if (this.activeRideId) this.socket.emit('join-ride-room', this.activeRideId);
      });
      this.socket.on('connect_error', (error) => console.warn('Socket.IO:', error?.message || 'falha de conexão'));
    }
    return this.socket;
  }

  disconnect() {
    if (this.socket) { this.socket.disconnect(); this.socket = null; }
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
  joinDriversRoom() { const socket = this.ensureSocket(); if (socket) socket.emit('join-drivers-room'); }
  joinDriverRoom() { this.joinDriversRoom(); }

  sendPresenceLocation(latitude, longitude) { this.ensureSocket()?.emit('driver-presence-location', { latitude, longitude, timestamp: new Date().toISOString() }); }
  sendLocation(rideId, driverId, latitude, longitude) { this.ensureSocket()?.emit('driver-location', { rideId, driverId, latitude, longitude, timestamp: new Date().toISOString() }); }
  sendPassengerLocation(rideId, latitude, longitude) { this.ensureSocket()?.emit('passenger-location', { rideId, latitude, longitude, timestamp: new Date().toISOString() }); }

  requestRide(rideData) {
    return Boolean(rideData?.rideId);
  }

  acceptRide(rideId, driverId) {
    return Boolean(rideId && driverId);
  }

  startRide(rideId, driverId) { this.ensureSocket()?.emit('start-ride', { rideId, driverId }); }
  endRide(rideId, driverId) { this.ensureSocket()?.emit('end-ride', { rideId, driverId }); }
  cancelRide(rideId) { if (rideId) this.ensureSocket()?.emit('ride-cancelled', { rideId }); }

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
