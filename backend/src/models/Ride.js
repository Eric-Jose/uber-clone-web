const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema({
  lat: Number,
  lng: Number
}, { _id: false });

const rideSchema = new mongoose.Schema({
  passengerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  passengerName: String,
  driverName: String,
  passengerProfilePhoto: String,
  driverProfilePhoto: String,
  origin: { address: String, location: locationSchema },
  destination: { address: String, location: locationSchema },
  distance: { type: Number, default: 0 },
  price: { type: Number, default: 0 },
  status: { type: String, enum: ['SEARCHING','ACCEPTED','IN_PROGRESS','COMPLETED','CANCELLED'], default: 'SEARCHING' },
  cancellationReason: String,
  driverLocation: locationSchema,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  completedAt: Date
});

module.exports = mongoose.model('Ride', rideSchema);
