import React from 'react';
import io from 'socket.io-client';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

class WebSocketService {
  constructor() {
    this.socket = null;
  }

  connect() {
    this.socket = io(BACKEND_URL, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5
    });

    this.socket.on('connect', () => {
      console.log('✅ Conectado ao servidor');
    });

    this.socket.on('disconnect', () => {
      console.log('❌ Desconectado do servidor');
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
    }
  }

  // Enviar localização
  sendLocation(userId, lat, lng) {
    this.socket.emit('driver-location', {
      userId,
      lat,
      lng,
      timestamp: new Date().toISOString()
    });
  }

  // Solicitar corrida
  requestRide(rideData) {
    this.socket.emit('request-ride', rideData);
  }

  // Aceitar corrida
  acceptRide(rideId, driverId) {
    this.socket.emit('accept-ride', { rideId, driverId });
  }

  // Iniciar corrida
  startRide(rideId) {
    this.socket.emit('start-ride', { rideId });
  }

  // Finalizar corrida
  endRide(rideId) {
    this.socket.emit('end-ride', { rideId });
  }

  // Escutar atualizações de localização
  onDriverLocationUpdate(callback) {
    this.socket.on('update-driver-location', callback);
  }

  // Escutar novas solicitações
  onNewRideRequest(callback) {
    this.socket.on('new-ride-request', callback);
  }

  // Escutar aceitação de corrida
  onRideAccepted(callback) {
    this.socket.on('ride-accepted', callback);
  }

  // Escutar corrida iniciada
  onRideStarted(callback) {
    this.socket.on('ride-started', callback);
  }

  // Escutar corrida finalizada
  onRideEnded(callback) {
    this.socket.on('ride-ended', callback);
  }
}

export default new WebSocketService();
