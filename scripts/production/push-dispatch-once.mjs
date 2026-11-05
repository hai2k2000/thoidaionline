import { createClient } from '@supabase/supabase-js';
import { createDispatcher } from '../../src/lib/push/dispatcher.mjs';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('Push dispatcher requires server database configuration.'); process.exitCode = 1; }
else {
  const client = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  try { console.log(JSON.stringify(await createDispatcher(client)())); }
  catch { console.error('Push dispatch failed; verify schema and server configuration.'); process.exitCode = 1; }
}
