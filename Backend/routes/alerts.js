const router = require('express').Router();
const { protect, requireRole } = require('../middleware/auth');
const supabase = require('../config/supabase');

router.get('/', protect, requireRole('admin'), async (req, res) => {
  try {
    const { data: alerts, error } = await supabase
      .from('alerts')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(100);
      
    if (error) throw error;
    res.json({ alerts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/read-all', protect, requireRole('admin'), async (req, res) => {
  try {
    const { error } = await supabase
      .from('alerts')
      .update({ read: true })
      .eq('read', false);
      
    if (error) throw error;
    res.json({ message: 'All alerts marked read' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/', protect, requireRole('admin'), async (req, res) => {
  try {
    // Delete all rows trick in Supabase where id is not null
    const { error } = await supabase
      .from('alerts')
      .delete()
      .not('id', 'is', null);
      
    if (error) throw error;
    res.json({ message: 'Alerts cleared' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
