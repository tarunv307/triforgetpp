const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true },
  email:       { type: String, required: true, unique: true, lowercase: true, index: true },
  password:    { type: String, required: true, minlength: 6, select: false },
  role:        { type: String, enum: ['admin', 'analyst', 'viewer'], default: 'viewer' },
  status:      { type: String, enum: ['active', 'pending', 'suspended'], default: 'active' },
  accessLimit: { type: Number, default: 3, min: 1, max: 20 },
  strikes:     { type: Number, default: 0 },
  lastLogin:   { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
