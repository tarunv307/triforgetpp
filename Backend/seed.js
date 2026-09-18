require('dotenv').config();
const bcrypt = require('bcryptjs');
const supabase = require('./config/supabase');

(async () => {
  try {
    console.log('Connecting to Supabase...');

    // Check if admin already exists
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', 'admin@bank.com')
      .single();

    if (existing) {
      console.log('Admin user already exists: admin@bank.com');
      process.exit(0);
    }

    const hash = await bcrypt.hash('admin123', 10);
    const { error } = await supabase
      .from('users')
      .insert([{
        name: 'Priya Sharma',
        email: 'admin@bank.com',
        password: hash,
        role: 'admin',
        status: 'active',
        access_limit: 5
      }]);

    if (error) throw error;

    console.log('✓ Admin created: admin@bank.com / admin123');
    process.exit(0);
  } catch (err) {
    console.error('Seed error:', err.message);
    process.exit(1);
  }
})();
