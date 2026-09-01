// src/routes/maps.js
const express = require('express');
const router = express.Router();
const axios = require('axios');

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

// Calcular rota entre dois pontos
router.post('/calculate-route', async (req, res) => {
  try {
    const { origin, destination } = req.body;

    const response = await axios.get(
      `https://maps.googleapis.com/maps/api/directions/json`,
      {
        params: {
          origin,
          destination,
          key: GOOGLE_MAPS_API_KEY,
          mode: 'driving'
        }
      }
    );

    if (response.data.routes.length === 0) {
      return res.status(404).json({ error: 'Rota não encontrada' });
    }

    const leg = response.data.routes[0].legs[0];
    const distance = leg.distance.value / 1000; // km
    const duration = leg.duration.value / 60; // minutos

    res.json({
      distance: distance.toFixed(2),
      duration: Math.ceil(duration),
      polyline: response.data.routes[0].overview_polyline.points,
      estimatedPrice: (distance * 5 + 10).toFixed(2)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Geocodificar endereço (converter texto em coordenadas)
router.post('/geocode', async (req, res) => {
  try {
    const { address } = req.body;

    const response = await axios.get(
      `https://maps.googleapis.com/maps/api/geocode/json`,
      {
        params: {
          address,
          key: GOOGLE_MAPS_API_KEY
        }
      }
    );

    if (response.data.results.length === 0) {
      return res.status(404).json({ error: 'Endereço não encontrado' });
    }

    const location = response.data.results[0].geometry.location;
    res.json({
      latitude: location.lat,
      longitude: location.lng,
      formattedAddress: response.data.results[0].formatted_address
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Encontrar drivers próximos
router.post('/nearby-drivers', async (req, res) => {
  try {
    const { latitude, longitude, radius } = req.body;

    // Aqui você faria uma busca no banco de dados
    // procurando motoristas dentro do raio especificado
    const drivers = [];

    res.json({ drivers });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
