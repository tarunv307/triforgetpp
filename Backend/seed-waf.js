require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const MOCK_RULES = [
  { ip_address: '185.220.101.5', reason: 'Tor Exit Node detected', created_by: 'system' },
  { ip_address: '45.142.212.61', reason: 'Known APT C2 Server', created_by: 'admin@bank.com' },
  { ip_address: '91.243.44.12', reason: 'Suspicious scanning activity', created_by: 'admin@bank.com' }
];

const MOCK_LOGS = [
  { 
    ip_address: '45.142.212.61', method: 'GET', path: '/api/users', 
    payload: '?search=\' OR 1=1--', reason: 'SQL Injection', user_agent: 'curl/7.68.0' 
  },
  { 
    ip_address: '91.243.44.12', method: 'POST', path: '/api/auth/login', 
    payload: '<script>alert(1)</script>', reason: 'Cross-Site Scripting (XSS)', user_agent: 'Mozilla/5.0' 
  },
  { 
    ip_address: '185.220.101.5', method: 'GET', path: '/api/risk', 
    payload: null, reason: 'IP Blocked by ACL', user_agent: 'Python-urllib/3.8' 
  }
];

async function seedWaf() {
  console.log('Seeding WAF data...');
  
  // Insert Rules
  for (const rule of MOCK_RULES) {
    await supabase.from('firewall_rules').upsert(rule, { onConflict: 'ip_address' });
  }
  console.log('✅ Added mock firewall rules');

  // Insert Logs
  for (const log of MOCK_LOGS) {
    await supabase.from('firewall_logs').insert(log);
  }
  console.log('✅ Added mock firewall logs');
  
  console.log('WAF Data Seeding Complete!');
}

seedWaf();
