const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    '❌ SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set. ' +
    'Image uploads will fail until these environment variables are provided.'
  );
}

const supabase = createClient(supabaseUrl || '', supabaseKey || '');

module.exports = supabase;
