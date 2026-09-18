const geoip = require('geoip-lite');
const supabase = require('../config/supabase');

function getClientIp(req) {
  return req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
}

async function geoBlock(req, res, next) {
  const ip = getClientIp(req);
  const geo = geoip.lookup(ip);
  
  // Default to allowing loopback/internal IPs where geo is null during dev
  if (!geo) return next();

  // ONLY allow India, US, UK
  const allowedCountries = ['IN', 'US', 'GB'];
  
  if (!allowedCountries.includes(geo.country)) {
    try {
      await supabase.from('firewall_logs').insert([{ 
        ip_address: ip, 
        method: req.method, 
        path: req.originalUrl, 
        reason: `Geo-blocked: ${geo.country}`, 
        user_agent: req.headers['user-agent'] || 'Unknown'
      }]);
    } catch(e) {
      console.error(e);
    }
    return res.status(403).json({ error: 'Access denied from your region' });
  }
  
  next();
}

module.exports = geoBlock;
