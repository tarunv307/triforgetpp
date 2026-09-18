const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { protect, requireRole } = require('../middleware/auth');
const supabase = require('../config/supabase');

router.get('/', protect, requireRole('admin'), async (req, res) => {
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });
      
    if (error) throw error;
    
    // Map access_limit for frontend compatibility
    const mappedUsers = users.map(u => ({ ...u, accessLimit: u.access_limit }));
    res.json({ users: mappedUsers });
  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/', protect, requireRole('admin'), async (req, res) => {
  try {
    const { name, email, password, role, accessLimit } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ error: 'Name, email and password required' });
    if (password.length < 6)
      return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const { data: exists } = await supabase
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase())
      .single();
      
    if (exists) return res.status(400).json({ error: 'Email already registered' });

    const hash = await bcrypt.hash(password, 10);
    const { data: user, error } = await supabase
      .from('users')
      .insert([{
        name,
        email: email.toLowerCase(),
        password: hash,
        role: role || 'viewer',
        status: 'active',
        access_limit: accessLimit || 3
      }])
      .select()
      .single();
      
    if (error) throw error;

    await supabase.from('audit_logs').insert([{
      actor: req.user.email,
      action: 'CREATE_USER',
      entity: 'user:' + email
    }]);

    res.status(201).json({ user: { ...user, accessLimit: user.access_limit } });
  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:email/status', protect, requireRole('admin'), async (req, res) => {
  try {
    const { status } = req.body;
    if (!['active', 'pending', 'suspended'].includes(status))
      return res.status(400).json({ error: 'Invalid status' });

    const { data: user, error } = await supabase
      .from('users')
      .update({ status })
      .eq('email', req.params.email)
      .select()
      .single();
      
    if (error || !user) return res.status(404).json({ error: 'User not found' });

    await supabase.from('audit_logs').insert([{
      actor: req.user.email,
      action: 'UPDATE_STATUS',
      entity: 'user:' + user.email
    }]);

    res.json({ user: { ...user, accessLimit: user.access_limit } });
  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:email/role', protect, requireRole('admin'), async (req, res) => {
  try {
    const { role } = req.body;
    if (!['admin', 'analyst', 'viewer'].includes(role))
      return res.status(400).json({ error: 'Invalid role' });

    const { data: user, error } = await supabase
      .from('users')
      .update({ role })
      .eq('email', req.params.email)
      .select()
      .single();
      
    if (error || !user) return res.status(404).json({ error: 'User not found' });

    await supabase.from('audit_logs').insert([{
      actor: req.user.email,
      action: 'UPDATE_ROLE',
      entity: 'user:' + user.email
    }]);

    res.json({ user: { ...user, accessLimit: user.access_limit } });
  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
