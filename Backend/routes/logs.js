const router = require('express').Router();
const { protect } = require('../middleware/auth');
const supabase = require('../config/supabase');

router.get('/', protect, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    
    let query = supabase
      .from('access_logs')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (req.user.role !== 'admin') {
      query = query.eq('user_email', req.user.email);
    }

    const { data: logs, error } = await query;
    if (error) throw error;
    
    // Map user_email to user for frontend compatibility
    const mappedLogs = logs.map(l => ({ ...l, user: l.user_email }));

    res.json({ logs: mappedLogs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/audit', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin')
      return res.status(403).json({ error: 'Admin only' });
      
    const { data: logs, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(200);
      
    if (error) throw error;
    res.json({ logs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
