const supabase = require('../config/supabase');

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
const MAX_SIZE = 5 * 1024 * 1024;  // 5MB

function getClientIp(req) {
  return req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
}

async function fileScan(req, res, next) {
  if (req.file) {
    if (!ALLOWED_TYPES.includes(req.file.mimetype)) {
      const ip = getClientIp(req);
      try {
        await supabase.from('firewall_logs').insert([{
          ip_address: ip, method: req.method, path: req.originalUrl,
          reason: `Malicious file type: ${req.file.mimetype}`, user_agent: req.headers['user-agent'] || 'Unknown'
        }]);
      } catch(e) {}
      return res.status(403).json({ error: 'File type not allowed' });
    }
    if (req.file.size > MAX_SIZE) {
      return res.status(413).json({ error: 'File too large' });
    }
  }
  next();
}

module.exports = fileScan;
