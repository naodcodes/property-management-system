const path = require('path');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');

dotenv.config({ path: path.resolve(__dirname, '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';
const ADMIN_USER_ID = '58f6b8e7-ddf0-4d41-9c0e-9cd16e5fb90c';

console.log(
  'Loaded SUPABASE_URL prefix:',
  SUPABASE_URL ? SUPABASE_URL.slice(0, 10) : 'undefined'
);

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL, SUPABASE_ANON_KEY, or SUPABASE_SERVICE_KEY in environment');
  process.exit(1);
}

async function main() {
  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { error: passwordResetError } = await supabaseAdmin.auth.admin.updateUserById(
    ADMIN_USER_ID,
    { password: 'Admin1234!' }
  );

  if (passwordResetError) {
    throw new Error(`Failed to reset user password: ${passwordResetError.message}`);
  }

  console.log('Password reset complete for test admin user.');

  const signInUrl = `${SUPABASE_URL}/auth/v1/token?grant_type=password`;

  const signInResponse = await fetch(signInUrl, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: 'admin@test.com',
      password: 'Admin1234!',
    }),
  });

  const signInBody = await signInResponse.json();

  console.log('=== Supabase Sign-In Response ===');
  console.log('Status:', signInResponse.status, signInResponse.statusText);
  console.log('Headers:', Object.fromEntries(signInResponse.headers.entries()));
  console.log('Body:', JSON.stringify(signInBody, null, 2));

  const accessToken = signInBody.access_token;
  if (!accessToken) {
    throw new Error('No access_token returned from Supabase sign-in');
  }

  const apiResponse = await fetch(`${API_BASE_URL}/api/properties`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  const apiBodyText = await apiResponse.text();
  let apiBody;
  try {
    apiBody = JSON.parse(apiBodyText);
  } catch {
    apiBody = apiBodyText;
  }

  console.log('\n=== GET /api/properties Response ===');
  console.log('Status:', apiResponse.status, apiResponse.statusText);
  console.log('Headers:', Object.fromEntries(apiResponse.headers.entries()));
  console.log('Body:', JSON.stringify(apiBody, null, 2));
}

main().catch((error) => {
  console.error('\nScript failed:', error);
  process.exit(1);
});
