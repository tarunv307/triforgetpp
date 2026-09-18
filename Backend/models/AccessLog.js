const mongoose = require('mongoose');

const accessLogSchema = new mongoose.Schema({
  user:        { type: String, required: true, index: true },
  device:      String,
  location:    String,
  resource:    String,
  fails:       { type: Number, default: 0 },
  score:       { type: Number, required: true },
  decision:    { type: String, enum: ['ALLOW', 'CHALLENGE', 'RESTRICT', 'DENY'], required: true },
  reasons:     [String],
  otpVerified: { type: Boolean, default: false },
  timestamp:   { type: Date, default: Date.now, index: true }
});

module.exports = mongoose.model('AccessLog', accessLogSchema);
