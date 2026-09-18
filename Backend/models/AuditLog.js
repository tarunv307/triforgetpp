const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  actor:     { type: String, required: true },
  action:    { type: String, required: true },
  entity:    String,
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('AuditLog', auditLogSchema);
