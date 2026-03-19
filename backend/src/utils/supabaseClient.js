const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    '❌ SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set. ' +
    'Image uploads will fail until these environment variables are provided.'
  );
}

// ✅ FIXED: Initialize with service role options to bypass RLS
// The service role key should bypass Row-Level Security (RLS) policies
const supabase = (supabaseUrl && supabaseKey)
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false
      },
      // ✅ CRITICAL: Use service role options to bypass RLS
      db: {
        schema: 'public',
      },
      global: {
        headers: {
          'x-my-custom-header': 'stationery-world-backend',
        },
      },
    })
  : null;

module.exports = supabase;
