import io from 'socket.io-client';
import { BACKEND_URL } from '../config';

class WebSocketService {
  constructor() {
    this.socket = null;
    this.activeRideId = null;
    this.driverRoomRequested = false;
    this.driverRoomRetryTimer = null;
    this.driverRoomRetryCount = 0;
    this.cancelRefreshBound = false;
    this.authToken = null;
    this.lastDriverHttpSync = 0;
    this.lastPassengerHttpSync = 0;
    this.passengerWatchId = null;
    this.passengerWatchRideId = null;
    this.passengerLastLocation = null;
  }

  connect() {
    const token = localStorage.getItem('token');
    if (!token) {
      this.disconnect();
      return null;
    }

    if (this.socket && this.authToken && this.authToken !== token) this.disconnect();

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
      if (this.activeRideId) {
        this.socket.emit('join-ride-room', this.activeRideId);
        this.ensurePassengerLocationWatch(this.activeRideId);
      }
      if (this.driverRoomRequested) this.requestDriverRoom();
    });
    this.socket.on('connect_error', (error) => console.warn('Socket.IO:', error?.message || 'falha de conexão'));
    this.bindPassengerCancellationRefresh();
    return this.socket;
  }

  requestDriverRoom() {
    const socket = this.socket;
    if (!socket || !socket.connected || !this.driverRoomRequested) return;
    socket.emit('join-drivers-room', (result) => {
      if (result?.ok) {
        this.driverRoomRetryCount = 0;
        if (this.driverRoomRetryTimer) {
          clearTimeout(this.driverRoomRetryTimer);
          this.driverRoomRetryTimer = null;
        }
        return;
      }
      this.scheduleDriverRoomRetry();
    });
  }

  scheduleDriverRoomRetry() {
    if (!this.driverRoomRequested || this.driverRoomRetryTimer || this.driverRoomRetryCount >= 10) return;
    this.driverRoomRetryCount += 1;
    this.driverRoomRetryTimer = window.setTimeout(() => {
      this.driverRoomRetryTimer = null;
      if (this.driverRoomRequested) this.requestDriverRoom();
    }, Math.min(1000 * this.driverRoomRetryCount, 5000));
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
      this.stopPassengerLocationWatch();
      window.setTimeout(() => window.location.reload(), 50);
    });
  }

  disconnect() {
    if (this.driverRoomRetryTimer) clearTimeout(this.driverRoomRetryTimer);
    this.driverRoomRetryTimer = null;
    this.driverRoomRetryCount = 0;
    this.stopPassengerLocationWatch();
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
    this.ensurePassengerLocationWatch(rideId);
  }
  leaveRideRoom(rideId) {
    if (rideId && this.activeRideId === rideId) {
      this.activeRideId = null;
      this.stopPassengerLocationWatch();
    }
    if (rideId) this.ensureSocket()?.emit('leave-ride-room', rideId);
  }
  joinDriversRoom() {
    this.driverRoomRequested = true;
    this.driverRoomRetryCount = 0;
    if (this.driverRoomRetryTimer) clearTimeout(this.driverRoomRetryTimer);
    this.driverRoomRetryTimer = null;
    const socket = this.ensureSocket();
    if (socket?.connected) this.requestDriverRoom();
  }
  leaveDriversRoom() {
    this.driverRoomRequested = false;
    this.driverRoomRetryCount = 0;
    if (this.driverRoomRetryTimer) clearTimeout(this.driverRoomRetryTimer);
    this.driverRoomRetryTimer = null;
  }
  joinDriverRoom() { this.joinDriversRoom(); }

  ensurePassengerLocationWatch(rideId) {
    let user = null;
    try { user = JSON.parse(localStorage.getItem('user') || 'null'); } catch (_) {}
    if (user?.userType !== 'passenger' || !rideId || !navigator.geolocation) return;
    if (String(this.passengerWatchRideId || '') === String(rideId) && this.passengerWatchId !== null) return;
    this.stopPassengerLocationWatch();
    this.passengerWatchRideId = rideId;
    this.passengerLastLocation = null;
    this.passengerWatchId = navigator.geolocation.watchPosition(
      (position) => {
        const latitude = Number(position?.coords?.latitude);
        const longitude = Number(position?.coords?.longitude);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
        const location = { lat: latitude, lng: longitude };
        if (this.passengerLastLocation && Math.abs(this.passengerLastLocation.lat - latitude) < 0.00001 && Math.abs(this.passengerLastLocation.lng - longitude) < 0.00001) return;
        this.passengerLastLocation = location;
        this.sendPassengerLocation(rideId, latitude, longitude);
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 1500, timeout: 10000 }
    );
  }

  stopPassengerLocationWatch() {
    if (this.passengerWatchId !== null && navigator.geolocation) navigator.geolocation.clearWatch(this.passengerWatchId);
    this.passengerWatchId = null;
    this.passengerWatchRideId = null;
    this.passengerLastLocation = null;
  }

  syncDriverLocationHttp(driverId, latitude, longitude) {
    const token = localStorage.getItem('token');
    if (!token || !driverId || !Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude))) return;
    const now = Date.now();
    if (now - this.lastDriverHttpSync < 5000) return;
    this.lastDriverHttpSync = now;
    void fetch(`${BACKEND_URL}/api/drivers/${encodeURIComponent(driverId)}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ isOnline: true, currentLocation: { lat: Number(latitude), lng: Number(longitude) } }),
      cache: 'no-store',
    }).catch(() => {});
  }

  syncPassengerLocationHttp(rideId, latitude, longitude) {
    const token = localStorage.getItem('token');
    if (!token || !rideId || !Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude))) return;
    const now = Date.now();
    if (now - this.lastPassengerHttpSync < 5000) return;
    this.lastPassengerHttpSync = now;
    void fetch(`${BACKEND_URL}/api/rides/${encodeURIComponent(rideId)}/passenger-location`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ location: { lat: Number(latitude), lng: Number(longitude) } }),
      cache: 'no-store',
    }).catch(() => {});
  }

  sendPresenceLocation(latitude, longitude) {
    let user = null;
    try { user = JSON.parse(localStorage.getItem('user') || 'null'); } catch (_) {}
    const driverId = user?.uid || user?.id;
    this.syncDriverLocationHttp(driverId, latitude, longitude);
    this.ensureSocket()?.emit('driver-presence-location', { latitude, longitude, timestamp: new Date().toISOString() });
  }

  sendLocation(rideId, driverId, latitude, longitude) {
    this.syncDriverLocationHttp(driverId, latitude, longitude);
    this.ensureSocket()?.emit('driver-location', { rideId, driverId, latitude, longitude, timestamp: new Date().toISOString() });
  }

  sendPassengerLocation(rideId, latitude, longitude) {
    this.syncPassengerLocationHttp(rideId, latitude, longitude);
    this.ensureSocket()?.emit('passenger-location', { rideId, latitude, longitude, timestamp: new Date().toISOString() });
  }

  requestRide(rideData) { return Boolean(rideData?.rideId); }
  acceptRide(rideId, driverId) { return Boolean(rideId && driverId); }
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
