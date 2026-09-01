// src/models/Banner.js
const mongoose = require('mongoose');

const bannerSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  imageUrl: String,
  active: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  views: { type: Number, default: 0 },
  clicks: { type: Number, default: 0 },
  startDate: Date,
  endDate: Date,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Banner', bannerSchema);
