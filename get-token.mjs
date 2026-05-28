import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);
console.log('TEST_EMAIL:', process.env.TEST_EMAIL);
console.log('SUPABASE_URL:', process.env.SUPABASE_URL);

const { data, error } = await supabase.auth.signInWithPassword({
  email: process.env.TEST_EMAIL,
  password: process.env.TEST_PASSWORD,
});

if (error) {
  console.error('Login error:', error.message);
  process.exit(1);
}

console.log(data.session.access_token);
