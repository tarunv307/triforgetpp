const router = require('express').Router();
const { protect, requireRole } = require('../middleware/auth');
const supabase = require('../config/supabase');

// Get WAF Logs
router.get('/logs', async (req, res) => {
  try {
    const { data: logs, error } = await supabase
      .from('firewall_logs')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(100);
      
    if (error) throw error;
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get ACL Rules
router.get('/rules', async (req, res) => {
  try {
    const { data: rules, error } = await supabase
      .from('firewall_rules')
      .select('*')
      .order('created_at', { ascending: false });
      
    if (error) throw error;
    res.json(rules);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add IP to Blocklist
router.post('/rules', async (req, res) => {
  try {
    const { ip_address, reason } = req.body;
    if (!ip_address) return res.status(400).json({ error: 'IP Address required' });

    const { data: rule, error } = await supabase
      .from('firewall_rules')
      .insert([{ 
        ip_address, 
        reason: reason || 'Manual block', 
        created_by: 'admin@bank.com' 
      }])
      .select()
      .single();
      
    if (error) throw error;
    res.status(201).json(rule);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Remove IP from Blocklist
router.delete('/rules/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('firewall_rules')
      .delete()
      .eq('id', req.params.id);
      
    if (error) throw error;
    res.json({ message: 'IP unblocked' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
