// src/models/Message.js
const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  rideId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ride', required: true },
  sender: { type: String, enum: ['user', 'driver'], required: true },
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true },
  read: { type: Boolean, default: false },
  readAt: Date,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Message', messageSchema);
