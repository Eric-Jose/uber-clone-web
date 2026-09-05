import { io } from 'socket.io-client';
import { BACKEND_URL, getToken } from './mobileApi';

let socket = null;
let connectedToken = null;

export async function connectSocket() {
  const token = await getToken();
  if (!token) return null;
  if (socket && connectedToken === token) {
    if (!socket.connected) socket.connect();
    return socket;
  }
  if (socket) socket.disconnect();
  connectedToken = token;
  socket = io(BACKEND_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 10000
  });
  return socket;
}

export function disconnectSocket() {
  if (socket) socket.disconnect();
  socket = null;
  connectedToken = null;
}

export async function joinRide(rideId) {
  const current = socket || await connectSocket();
  if (!current || !rideId) return false;
  if (current.connected) current.emit('join-ride-room', { rideId: String(rideId) });
  else current.once('connect', () => current.emit('join-ride-room', { rideId: String(rideId) }));
  return true;
}

export function on(event, handler) {
  if (socket) socket.on(event, handler);
  return () => socket?.off(event, handler);
}
