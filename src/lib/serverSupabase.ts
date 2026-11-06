import "server-only";

import { createClient } from "@supabase/supabase-js";
import { kickPushDispatcher } from "@/lib/push/kick.mjs";
import { withPushActor } from "@/lib/push/actorFetch.mjs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Server Supabase configuration is incomplete.");
}

export const serverSupabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  global: { fetch: withPushActor((input: RequestInfo | URL, init?: RequestInit) => fetch(input, init), kickPushDispatcher) },
});
