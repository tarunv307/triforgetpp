require('dotenv').config();
const bcrypt = require('bcryptjs');
const supabase = require('./config/supabase');

const usersToSeed = [
  { email: 'admin@bank.com', password: 'admin123', role: 'admin', name: 'Priya Sharma', status: 'active', access_limit: 5, strikes: 0 },
  { email: 'arjun@bank.com', password: 'analyst123', role: 'analyst', name: 'Arjun Kumar', status: 'active', access_limit: 3, strikes: 0 },
  { email: 'kavya@bank.com', password: 'viewer123', role: 'viewer', name: 'Kavya Nair', status: 'active', access_limit: 3, strikes: 0 },
  { email: 'priya@bank.com', password: 'priya123', role: 'viewer', name: 'Priya Sharma', status: 'active', access_limit: 3, strikes: 0 }
];

async function seedUsers() {
  console.log('🌱 Seeding default users...');
  
  for (const u of usersToSeed) {
    try {
      // Check if user already exists
      const { data: existing } = await supabase
        .from('users')
        .select('email')
        .eq('email', u.email)
        .single();
        
      if (existing) {
        console.log(`User ${u.email} already exists. Skipping.`);
        continue;
      }

      // Hash password
      const hash = await bcrypt.hash(u.password, 10);
      
      // Insert user
      const { error } = await supabase
        .from('users')
        .insert([{
          email: u.email,
          name: u.name,
          password: hash,
          role: u.role,
          status: u.status,
          access_limit: u.access_limit,
          strikes: u.strikes
        }]);

      if (error) {
        console.error(`❌ Error inserting ${u.email}:`, error.message);
      } else {
        console.log(`✅ Inserted ${u.email}`);
      }
    } catch (e) {
      console.error(`❌ Unexpected error for ${u.email}:`, e.message);
    }
  }
  
  console.log('✅ Seeding complete!');
  process.exit(0);
}

seedUsers();
