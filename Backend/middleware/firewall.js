const supabase = require('../config/supabase');

const SQLI_PATTERNS = [
  /(\bunion\b.*\bselect\b)/i,
  /(\bor\b\s+1\s*=\s*1)/i,
  /(--\s|\/\*.*\*\/)/,
  /(\bdrop\b\s+\btable\b)/i,
  /(\bexec\b\s*\()/i
];

const XSS_PATTERNS = [
  /<script[^>]*>/i,
  /javascript\s*:/i,
  /on(error|load|click|mouseover|keydown)\s*=/i,
  /<iframe[^>]*>/i
];

const CMD_PATTERNS = [
  /(;|\||&|`|\$)\s*(ls|cat|rm|wget|curl|bash|sh|nc)/i,
  /(\.\.\/){2,}/,              // Directory traversal
  /(etc\/passwd|etc\/shadow)/i
];

// Simple in-memory cache to avoid querying DB for every request
let blocklistCache = new Set();
let lastCacheUpdate = 0;

async function updateCache() {
  const now = Date.now();
  // Update cache every 30 seconds max to maintain performance
  if (now - lastCacheUpdate < 30000) return;
  
  try {
    const { data, error } = await supabase.from('firewall_rules').select('ip_address');
    if (!error && data) {
      blocklistCache = new Set(data.map(r => r.ip_address));
      lastCacheUpdate = now;
    }
  } catch (err) {
    console.error('WAF Cache update error:', err);
  }
}

function getClientIp(req) {
  return req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
}

function scanPayload(value) {
  if (typeof value !== 'string') return null;
  
  for (const pattern of SQLI_PATTERNS) {
    if (pattern.test(value)) return { type: 'SQL Injection' };
  }
  
  for (const pattern of XSS_PATTERNS) {
    if (pattern.test(value)) return { type: 'Cross-Site Scripting (XSS)' };
  }
  
  for (const pattern of CMD_PATTERNS) {
    if (pattern.test(value)) return { type: 'Command Injection' };
  }
  
  return null;
}

async function logBlock(details) {
  try {
    await supabase.from('firewall_logs').insert([details]);

    // Auto-Banning Logic: 5 attacks in 10 minutes
    const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from('firewall_logs')
      .select('*', { count: 'exact', head: true })
      .eq('ip_address', details.ip_address)
      .gte('timestamp', tenMinsAgo);

    if (count >= 5) {
      // Add to blocklist if not already there
      if (!blocklistCache.has(details.ip_address)) {
        await supabase.from('firewall_rules').upsert({
          ip_address: details.ip_address,
          reason: `Auto-ban: ${count} attacks in 10 min`,
          created_by: 'system'
        }, { onConflict: 'ip_address' });
        
        blocklistCache.add(details.ip_address);
      }
    }
  } catch (err) {
    console.error('WAF Log error:', err);
  }
}

async function firewall(req, res, next) {
  // We don't block the healthcheck
  if (req.path === '/api/health') return next();

  await updateCache();
  
  const ip = getClientIp(req);
  const method = req.method;
  const path = req.originalUrl;
  const user_agent = req.headers['user-agent'] || 'Unknown';

  // 1. Check IP Blocklist
  if (blocklistCache.has(ip)) {
    await logBlock({ ip_address: ip, method, path, reason: 'IP Blocked by ACL', user_agent });
    return res.status(403).json({ error: 'Forbidden', reason: 'IP blocked by WAF' });
  }

  // 2. Deep packet inspection (URL, Query, Body)
  const candidates = [
    decodeURIComponent(req.originalUrl),
    ...Object.values(req.query).map(String)
  ];

  if (req.body && typeof req.body === 'object') {
    candidates.push(JSON.stringify(req.body));
  }

  for (const value of candidates) {
    const hit = scanPayload(value);
    if (hit) {
      await logBlock({ 
        ip_address: ip, 
        method, 
        path, 
        payload: value.substring(0, 200), // truncate long payloads
        reason: hit.type,
        user_agent
      });
      return res.status(403).json({ error: 'Forbidden', reason: `${hit.type} detected` });
    }
  }

  // 3. Clean -> Allow
  next();
}

firewall.logBlock = logBlock;
module.exports = firewall;
