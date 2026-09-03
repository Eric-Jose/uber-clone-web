// src/models/Driver.js
const mongoose = require('mongoose');

const driverSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  fullName: { type: String, required: true },
  cpf: { type: String, required: true, unique: true },
  driverLicense: { type: String, required: true },
  vehicleModel: { type: String, required: true },
  vehicleColor: { type: String, required: true },
  vehicleYear: { type: Number, required: true },
  licensePlate: { type: String, required: true },
  bankName: { type: String, required: true },
  bankAccount: { type: String, required: true },
  bankRoutingNumber: { type: String, required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  isOnline: { type: Boolean, default: false },
  currentLocation: {
    lat: Number,
    lng: Number,
    updatedAt: Date
  },
  approvalReason: String,
  rejectionReason: String,
  approvedAt: Date,
  rejectedAt: Date,
  documents: [{
    fileName: String,
    fileUrl: String,
    uploadedAt: Date
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Driver', driverSchema);
