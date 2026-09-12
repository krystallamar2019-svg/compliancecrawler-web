import { createClient } from '@supabase/supabase-js';
import { config } from '../config.js';

export const supabaseAdmin = createClient(
  config.SUPABASE_URL,
  config.SUPABASE_SERVER_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        'X-Client-Info': 'brandedalign-backend/0.1.0',
      },
    },
  },
);
