const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const supabase = require('../config/supabase');

const signToken = id =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES });

router.post('/signup', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ error: 'All fields required' });
    if (password.length < 6)
      return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const { data: exists } = await supabase
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase())
      .single();

    if (exists) return res.status(400).json({ error: 'Email already registered' });

    const hash = await bcrypt.hash(password, 10);
    const status = role === 'admin' ? 'pending' : 'active';

    const { data: user, error: userError } = await supabase
      .from('users')
      .insert([{
        name,
        email: email.toLowerCase(),
        password: hash,
        role: role || 'viewer',
        status
      }])
      .select()
      .single();

    if (userError) throw userError;

    await supabase.from('audit_logs').insert([{
      actor: email.toLowerCase(),
      action: 'SIGNUP',
      entity: 'user:' + email.toLowerCase()
    }]);

    res.status(201).json({
      message: status === 'pending'
        ? 'Signup successful. Admin approval pending.'
        : 'Signup successful. Please login.',
      user: { id: user.id, email: user.email, role: user.role, status: user.status }
    });
  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Enter email and password' });

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase())
      .single();

    if (error || !user) return res.status(401).json({ error: 'Invalid email or password' });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: 'Invalid email or password' });

    if (user.status === 'pending')
      return res.status(403).json({ error: 'Account pending admin approval' });
    if (user.status === 'suspended')
      return res.status(403).json({ error: 'Account suspended. Contact admin.' });

    await supabase
      .from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', user.id);

    const token = signToken(user.id);
    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        accessLimit: user.access_limit,
        strikes: user.strikes
      }
    });
  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
