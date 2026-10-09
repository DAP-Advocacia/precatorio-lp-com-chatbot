import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

export function getSupabaseAdmin() {
  if (!supabaseUrl || !supabaseSecretKey) {
    throw new Error('SUPABASE_URL ou SUPABASE_SECRET_KEY não configurados no .env');
  }
  return createClient(supabaseUrl, supabaseSecretKey, {
    auth: { persistSession: false },
  });
}
