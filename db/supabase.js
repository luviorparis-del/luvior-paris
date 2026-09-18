const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://jvsudlhnnykpidyavxuq.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp2c3VkbGhubnlrcGlkeWF2eHVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk3MjE2MjgsImV4cCI6MjEwNTI5NzYyOH0.4URWWpEe-jQ34MkvrqCW0p3PlmAGRimCYAo1_ohejdc';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function getServiceClient() {
  if (!SUPABASE_SERVICE_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

function getClientForUser(accessToken) {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } }
  });
}

module.exports = { supabase, getServiceClient, getClientForUser, SUPABASE_URL, SUPABASE_ANON_KEY };
