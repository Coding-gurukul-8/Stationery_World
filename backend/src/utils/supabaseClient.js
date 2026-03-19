const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    '❌ SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set. ' +
    'Image uploads will fail until these environment variables are provided.'
  );
}

// Only initialise the client when both variables are available.
// Passing an empty string to createClient causes the Supabase library to
// throw "supabaseKey is required." at import time, which crashes the server.
const supabase = (supabaseUrl && supabaseKey)
  ? createClient(supabaseUrl, supabaseKey)
  : null;

module.exports = supabase;
