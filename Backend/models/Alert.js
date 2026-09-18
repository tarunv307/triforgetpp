const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  level:     { type: String, enum: ['critical', 'warning', 'info'], required: true },
  title:     { type: String, required: true },
  detail:    String,
  read:      { type: Boolean, default: false },
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Alert', alertSchema);
