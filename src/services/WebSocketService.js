import io from 'socket.io-client';
import { BACKEND_URL } from '../config';

class WebSocketService {
  constructor() {
    this.socket = null;
    this.driverPollingTimer = null;
    this.driverPollingBusy = false;
    this.seenRideIds = new Set();
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
      this.socket.on('connect', () => this.joinDriversRoom());
    }

    this.startDriverPolling();
    return this.socket;
  }

  disconnect() {
    this.stopDriverPolling();
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  ensureSocket() { return this.socket || this.connect(); }

  startDriverPolling() {
    try {
      const user = JSON.parse(localStorage.getItem('user') || 'null');
      if (user?.userType !== 'driver') return;
    } catch (_) {
      return;
    }

    if (this.driverPollingTimer) return;
    this.pollPendingRides();
    this.driverPollingTimer = window.setInterval(() => this.pollPendingRides(), 3000);
  }

  stopDriverPolling() {
    if (this.driverPollingTimer) {
      window.clearInterval(this.driverPollingTimer);
      this.driverPollingTimer = null;
    }
    this.driverPollingBusy = false;
    this.seenRideIds.clear();
  }

  async pollPendingRides() {
    if (this.driverPollingBusy) return;
    const token = localStorage.getItem('token');
    if (!token) return;
    this.driverPollingBusy = true;

    try {
      const response = await fetch(`${BACKEND_URL}/api/rides/pending`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store'
      });
      if (!response.ok) return;
      const data = await response.json();
      const rides = Array.isArray(data?.rides) ? data.rides : [];
      const currentRideIds = new Set();
      const listeners = this.socket?.listeners('new-ride-request') || [];
      const unavailableListeners = this.socket?.listeners('ride-unavailable') || [];

      for (const ride of rides) {
        const rideId = ride?.id || ride?.rideId;
        if (!rideId) continue;
        currentRideIds.add(rideId);
        if (this.seenRideIds.has(rideId)) continue;
        this.seenRideIds.add(rideId);
        listeners.forEach(listener => {
          try {
            listener({ ...ride, rideId, id: rideId, source: 'polling' });
          } catch (_) {}
        });
      }

      for (const rideId of Array.from(this.seenRideIds)) {
        if (currentRideIds.has(rideId)) continue;
        this.seenRideIds.delete(rideId);
        unavailableListeners.forEach(listener => {
          try { listener({ rideId, id: rideId, source: 'polling' }); } catch (_) {}
        });
      }
    } catch (_) {
      // O polling é somente fallback; Socket.IO continua funcionando.
    } finally {
      this.driverPollingBusy = false;
    }
  }

  onConnect(callback) { return this.ensureSocket()?.on('connect', callback); }
  offConnect(callback) { this.socket?.off('connect', callback); }

  joinRideRoom(rideId) { if (rideId) this.ensureSocket()?.emit('join-ride-room', rideId); }
  leaveRideRoom(rideId) { if (rideId) this.ensureSocket()?.emit('leave-ride-room', rideId); }

  joinDriversRoom() {
    const socket = this.ensureSocket();
    if (!socket) return;
    const user = (() => { try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch (_) { return null; } })();
    if (user?.userType === 'driver' && user?.driverApprovalStatus === 'approved' && user?.isOnline === true) {
      socket.emit('join-drivers-room');
    }
  }

  joinDriverRoom() { this.joinDriversRoom(); }

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
  onRideUnavailable(callback) { return this.ensureSocket()?.on('ride-unavailable', callback); }
  onRideAccepted(callback) { return this.ensureSocket()?.on('ride-accepted', callback); }
  onRideStarted(callback) {
    const socket = this.ensureSocket();
    if (!socket) return;
    socket.on('ride-started', callback);
    socket.on('ride-in_progress', callback);
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
    if (event === 'ride-started') this.socket.off('ride-in_progress', callback);
    if (event === 'ride-ended') this.socket.off('ride-completed', callback);
  }
}

export default new WebSocketService();