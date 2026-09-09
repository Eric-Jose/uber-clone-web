import io from 'socket.io-client';
import { BACKEND_URL } from '../config';

// Vercel does not provide a persistent Socket.IO server for this app. Keep
// Socket.IO as an optional enhancement, but make HTTP/Firebase-backed API
// polling the reliable production transport for ride state and notifications.
const POLL_MS = 2000;

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
    this.pollTimer = null;
    this.pollInFlight = false;
    this.lastActiveRide = null;
    this.lastDriverNotifications = new Map();
    this.listeners = new Map();
  }

  _emit(event, payload) {
    const callbacks = this.listeners.get(event);
    if (callbacks) callbacks.forEach((callback) => { try { callback(payload); } catch (error) { console.error(`Realtime listener ${event}:`, error); } });
  }

  _on(event, callback) {
    if (typeof callback !== 'function') return null;
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(callback);
    return { off: () => this.off(event, callback) };
  }

  _startPolling() {
    if (this.pollTimer || typeof window === 'undefined') return;
    this.pollTimer = window.setInterval(() => this.syncRealtimeState(), POLL_MS);
    void this.syncRealtimeState();
  }

  _stopPolling() {
    if (this.pollTimer) window.clearInterval(this.pollTimer);
    this.pollTimer = null;
    this.lastActiveRide = null;
    this.lastDriverNotifications.clear();
  }

  async syncRealtimeState() {
    if (this.pollInFlight) return;
    const token = localStorage.getItem('token');
    if (!token) return;
    this.pollInFlight = true;
    try {
      const user = JSON.parse(localStorage.getItem('user') || 'null');
      if (user?.userType === 'driver' && this.driverRoomRequested) await this._syncDriverNotifications(token);
      if (this.activeRideId) await this._syncActiveRide(token, this.activeRideId);
    } catch (_) {
      // Realtime polling is best-effort; API calls remain authoritative.
    } finally { this.pollInFlight = false; }
  }

  async _syncDriverNotifications(token) {
    const response = await fetch(`${BACKEND_URL}/api/rides/notifications`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
    if (!response.ok) return;
    const data = await response.json().catch(() => ({}));
    const current = new Map((Array.isArray(data?.notifications) ? data.notifications : []).map((ride) => [String(ride.rideId || ride.id), ride]));
    current.forEach((ride, rideId) => {
      if (!this.lastDriverNotifications.has(rideId) && ride.status === 'SEARCHING') this._emit('new-ride-request', ride);
    });
    this.lastDriverNotifications.forEach((ride, rideId) => {
      if (!current.has(rideId)) this._emit('ride-unavailable', { rideId, source: 'vercel-http-sync' });
    });
    this.lastDriverNotifications = current;
  }

  async _syncActiveRide(token, rideId) {
    const response = await fetch(`${BACKEND_URL}/api/rides/active`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
    if (!response.ok) return;
    const data = await response.json().catch(() => ({}));
    const ride = data?.ride || null;
    if (!ride || String(ride.id) !== String(rideId)) {
      if (this.lastActiveRide && String(this.lastActiveRide.id) === String(rideId)) {
        const previous = this.lastActiveRide;
        if (previous.status === 'SEARCHING') this._emit('ride-unavailable', { rideId, source: 'vercel-http-sync' });
        else if (previous.status === 'ACCEPTED') this._emit('ride-ended', { rideId, ride: previous, source: 'vercel-http-sync' });
      }
      this.activeRideId = null;
      this.stopPassengerLocationWatch();
      this.lastActiveRide = null;
      return;
    }
    const previous = this.lastActiveRide;
    this.lastActiveRide = ride;
    if (!previous) return;
    if (previous.status !== ride.status) {
      if (ride.status === 'ACCEPTED') this._emit('ride-accepted', { rideId, driverId: ride.driverId, ride, source: 'vercel-http-sync' });
      if (ride.status === 'IN_PROGRESS') this._emit('ride-started', { rideId, ride, source: 'vercel-http-sync' });
      if (ride.status === 'COMPLETED') this._emit('ride-ended', { rideId, ride, source: 'vercel-http-sync' });
      if (ride.status === 'CANCELLED') this._emit('ride-cancelled', { rideId, ride, source: 'vercel-http-sync' });
    }
    const previousDriver = previous.driverLocation || null;
    const currentDriver = ride.driverLocation || null;
    if (currentDriver && JSON.stringify(previousDriver) !== JSON.stringify(currentDriver)) this._emit('update-driver-location', { rideId, driverId: ride.driverId, location: currentDriver, latitude: currentDriver.lat, longitude: currentDriver.lng, source: 'vercel-http-sync' });
    const previousPassenger = previous.passengerLocation || null;
    const currentPassenger = ride.passengerLocation || null;
    if (currentPassenger && JSON.stringify(previousPassenger) !== JSON.stringify(currentPassenger)) this._emit('passenger-location-update', { rideId, passengerId: ride.userId, location: currentPassenger, source: 'vercel-http-sync' });
  }

  connect() {
    const token = localStorage.getItem('token');
    if (!token) { this.disconnect(); return null; }
    if (this.socket && this.authToken && this.authToken !== token) this.disconnect();
    this.authToken = token;
    this._startPolling();
    if (this.socket) { if (!this.socket.connected && !this.socket.active) this.socket.connect(); return this.socket; }
    // Optional Socket.IO: useful only when a persistent compatible server is
    // present. Failure never disables the HTTP realtime path above.
    this.socket = io(BACKEND_URL || window.location.origin, { auth: { token }, transports: ['websocket', 'polling'], timeout: 5000, reconnection: true, reconnectionDelay: 1000, reconnectionDelayMax: 5000, reconnectionAttempts: 3, closeOnBeforeunload: true });
    this.socket.on('connect', () => { this._emit('connect'); if (this.activeRideId) this.socket.emit('join-ride-room', this.activeRideId); if (this.driverRoomRequested) this.requestDriverRoom(); });
    this.socket.on('connect_error', (error) => console.warn('Socket.IO opcional indisponível; usando sincronização HTTP:', error?.message || 'falha'));
    ['new-ride-request','ride-unavailable','ride-accepted','ride-started','ride_in_progress','ride-ended','ride-completed','ride-cancelled','update-driver-location','passenger-location-update','ride-status'].forEach((event) => this.socket.on(event, (payload) => this._emit(event, payload)));
    return this.socket;
  }

  requestDriverRoom() {
    const socket = this.socket;
    if (!socket || !socket.connected || !this.driverRoomRequested) return;
    socket.emit('join-drivers-room', (result) => {
      if (result?.ok) { this.driverRoomRetryCount = 0; if (this.driverRoomRetryTimer) clearTimeout(this.driverRoomRetryTimer); this.driverRoomRetryTimer = null; return; }
      this.scheduleDriverRoomRetry();
    });
  }
  scheduleDriverRoomRetry() {
    if (!this.driverRoomRequested || this.driverRoomRetryTimer || this.driverRoomRetryCount >= 3) return;
    this.driverRoomRetryCount += 1;
    this.driverRoomRetryTimer = window.setTimeout(() => { this.driverRoomRetryTimer = null; if (this.driverRoomRequested) this.requestDriverRoom(); }, Math.min(1000 * this.driverRoomRetryCount, 3000));
  }
  bindPassengerCancellationRefresh() { if (this.cancelRefreshBound) return; this.cancelRefreshBound = true; this._on('ride-cancelled', (payload) => { const rideId = payload?.rideId || payload?.ride?.id; let user = null; try { user = JSON.parse(localStorage.getItem('user') || 'null'); } catch (_) {} if (!rideId || String(rideId) !== String(this.activeRideId) || user?.userType !== 'passenger') return; this.activeRideId = null; this.stopPassengerLocationWatch(); window.setTimeout(() => window.location.reload(), 50); }); }

  disconnect() {
    if (this.driverRoomRetryTimer) clearTimeout(this.driverRoomRetryTimer);
    this.driverRoomRetryTimer = null; this.driverRoomRetryCount = 0;
    this._stopPolling(); this.stopPassengerLocationWatch();
    if (this.socket) { this.socket.removeAllListeners(); this.socket.disconnect(); this.socket = null; }
    this.authToken = null; this.activeRideId = null; this.driverRoomRequested = false; this.cancelRefreshBound = false;
  }
  ensureSocket() { return this.socket || this.connect(); }
  onConnect(callback) { return this._on('connect', callback); }
  offConnect(callback) { return this.off('connect', callback); }
  joinRideRoom(rideId) { if (!rideId) return; this.activeRideId = rideId; this.ensureSocket()?.emit('join-ride-room', rideId); this.ensurePassengerLocationWatch(rideId); this._startPolling(); }
  leaveRideRoom(rideId) { if (rideId && String(this.activeRideId) === String(rideId)) { this.activeRideId = null; this.stopPassengerLocationWatch(); this.lastActiveRide = null; } if (rideId) this.ensureSocket()?.emit('leave-ride-room', rideId); }
  joinDriversRoom() { this.driverRoomRequested = true; this.driverRoomRetryCount = 0; this._startPolling(); const socket = this.ensureSocket(); if (socket?.connected) this.requestDriverRoom(); }
  leaveDriversRoom() { this.driverRoomRequested = false; this.driverRoomRetryCount = 0; if (this.driverRoomRetryTimer) clearTimeout(this.driverRoomRetryTimer); this.driverRoomRetryTimer = null; this.lastDriverNotifications.clear(); }
  joinDriverRoom() { this.joinDriversRoom(); }

  ensurePassengerLocationWatch(rideId) {
    let user = null; try { user = JSON.parse(localStorage.getItem('user') || 'null'); } catch (_) {}
    if (user?.userType !== 'passenger' || !rideId || !navigator.geolocation) return;
    if (String(this.passengerWatchRideId || '') === String(rideId) && this.passengerWatchId !== null) return;
    this.stopPassengerLocationWatch(); this.passengerWatchRideId = rideId; this.passengerLastLocation = null;
    this.passengerWatchId = navigator.geolocation.watchPosition((position) => { const latitude = Number(position?.coords?.latitude), longitude = Number(position?.coords?.longitude); if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return; if (this.passengerLastLocation && Math.abs(this.passengerLastLocation.lat - latitude) < 0.00001 && Math.abs(this.passengerLastLocation.lng - longitude) < 0.00001) return; this.passengerLastLocation = { lat: latitude, lng: longitude }; this.sendPassengerLocation(rideId, latitude, longitude); }, () => {}, { enableHighAccuracy: true, maximumAge: 1500, timeout: 10000 });
  }
  stopPassengerLocationWatch() { if (this.passengerWatchId !== null && navigator.geolocation) navigator.geolocation.clearWatch(this.passengerWatchId); this.passengerWatchId = null; this.passengerWatchRideId = null; this.passengerLastLocation = null; }
  syncDriverLocationHttp(driverId, latitude, longitude) { const token = localStorage.getItem('token'); if (!token || !driverId || !Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude))) return; const now = Date.now(); if (now - this.lastDriverHttpSync < 5000) return; this.lastDriverHttpSync = now; void fetch(`${BACKEND_URL}/api/drivers/${encodeURIComponent(driverId)}/status`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ isOnline: true, currentLocation: { lat: Number(latitude), lng: Number(longitude) } }), cache: 'no-store' }).catch(() => {}); }
  syncPassengerLocationHttp(rideId, latitude, longitude) { const token = localStorage.getItem('token'); if (!token || !rideId || !Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude))) return; const now = Date.now(); if (now - this.lastPassengerHttpSync < 5000) return; this.lastPassengerHttpSync = now; void fetch(`${BACKEND_URL}/api/rides/${encodeURIComponent(rideId)}/passenger-location`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ location: { lat: Number(latitude), lng: Number(longitude) } }), cache: 'no-store' }).catch(() => {}); }
  sendPresenceLocation(latitude, longitude) { let user = null; try { user = JSON.parse(localStorage.getItem('user') || 'null'); } catch (_) {} const driverId = user?.uid || user?.id; this.syncDriverLocationHttp(driverId, latitude, longitude); this.ensureSocket()?.emit('driver-presence-location', { latitude, longitude, timestamp: new Date().toISOString() }); }
  sendLocation(rideId, driverId, latitude, longitude) { this.syncDriverLocationHttp(driverId, latitude, longitude); this.ensureSocket()?.emit('driver-location', { rideId, driverId, latitude, longitude, timestamp: new Date().toISOString() }); }
  sendPassengerLocation(rideId, latitude, longitude) { this.syncPassengerLocationHttp(rideId, latitude, longitude); this.ensureSocket()?.emit('passenger-location', { rideId, latitude, longitude, timestamp: new Date().toISOString() }); }

  async requestRide(rideData) { const token = localStorage.getItem('token'); if (!token || !rideData?.origin || !rideData?.destination) return null; const response = await fetch(`${BACKEND_URL}/api/rides/request`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ origin: rideData.origin, destination: rideData.destination }), cache: 'no-store' }); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data?.error || 'Não foi possível solicitar a corrida.'); const ride = data?.ride || data; this.activeRideId = ride?.id || this.activeRideId; this.lastActiveRide = ride || null; this._startPolling(); return ride; }
  async acceptRide(rideId) { const token = localStorage.getItem('token'); if (!token || !rideId) return null; const response = await fetch(`${BACKEND_URL}/api/rides/accept`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ rideId }), cache: 'no-store' }); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data?.error || 'Não foi possível aceitar a corrida.'); this.lastDriverNotifications.delete(String(rideId)); const ride = data?.ride || data; this.activeRideId = ride?.id || rideId; this.lastActiveRide = ride || null; this._startPolling(); return ride; }
  async startRide(rideId) { return this.updateRideStatus(rideId, 'IN_PROGRESS', 'Não foi possível iniciar a corrida.'); }
  async endRide(rideId) { return this.updateRideStatus(rideId, 'COMPLETED', 'Não foi possível finalizar a corrida.'); }
  async cancelRide(rideId, reason = 'Cancelada pelo usuário') { return this.updateRideStatus(rideId, 'CANCELLED', 'Não foi possível cancelar a corrida.', reason); }
  async updateRideStatus(rideId, status, fallback, cancellationReason) { const token = localStorage.getItem('token'); if (!token || !rideId) return null; const response = await fetch(`${BACKEND_URL}/api/rides/${encodeURIComponent(rideId)}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ status, ...(status === 'CANCELLED' ? { cancellationReason } : {}) }), cache: 'no-store' }); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data?.error || fallback); const ride = data?.ride || data; if (status === 'CANCELLED' || status === 'COMPLETED') { this.activeRideId = null; this.lastActiveRide = null; this.stopPassengerLocationWatch(); } else { this.activeRideId = ride?.id || rideId; this.lastActiveRide = ride || null; } this._startPolling(); return ride; }

  onDriverLocationUpdate(callback) { const h = this._on('update-driver-location', callback); this._startPolling(); return h; }
  onPassengerLocationUpdate(callback) { const h = this._on('passenger-location-update', callback); this._startPolling(); return h; }
  onNewRideRequest(callback) { const h = this._on('new-ride-request', callback); this.driverRoomRequested = true; this._startPolling(); return h; }
  onRideUnavailable(callback) { const h = this._on('ride-unavailable', callback); this._startPolling(); return h; }
  onRideAccepted(callback) { const h = this._on('ride-accepted', callback); this._startPolling(); return h; }
  onRideStarted(callback) { const h = this._on('ride-started', callback); this._startPolling(); return h; }
  onRideEnded(callback) { const h = this._on('ride-ended', callback); this._startPolling(); return h; }
  onRideCancelled(callback) { const h = this._on('ride-cancelled', callback); this._startPolling(); return h; }
  off(event, callback) { const set = this.listeners.get(event); if (!set) return; if (callback) set.delete(callback); else set.clear(); }
}

const webSocketService = new WebSocketService();
export default webSocketService;
