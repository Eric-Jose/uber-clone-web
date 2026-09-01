// src/models/Rating.js
const mongoose = require('mongoose');

const ratingSchema = new mongoose.Schema({
  rideId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ride', required: true },
  ratedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  ratedUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  rating: { type: Number, min: 1, max: 5, required: true },
  comment: String,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Rating', ratingSchema);
