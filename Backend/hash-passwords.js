require('dotenv').config();
const supabase = require('./config/supabase');
const bcrypt = require('bcryptjs');

async function run() {
  const { data: users, error } = await supabase.from('users').select('id, email, password');
  if (error) {
    console.error('Error fetching users:', error);
    return;
  }

  for (const user of users) {
    // If it's already a bcrypt hash (starts with $2), skip it
    if (user.password.startsWith('$2')) {
      console.log(`User ${user.email} already has a hashed password.`);
      continue;
    }

    // Hash the plain text password
    const hashed = await bcrypt.hash(user.password, 10);
    
    // Update the DB
    const { error: updateError } = await supabase
      .from('users')
      .update({ password: hashed })
      .eq('id', user.id);

    if (updateError) {
      console.error(`Failed to update ${user.email}:`, updateError);
    } else {
      console.log(`Updated ${user.email} with bcrypt hash.`);
    }
  }
}

run();
