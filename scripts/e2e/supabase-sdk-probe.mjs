import { createClient } from "@supabase/supabase-js";

const directUrl = process.env.E2E_POSTGREST_URL;
const gatewayUrl = process.env.E2E_SUPABASE_URL;
const key = process.env.E2E_SERVICE_ROLE_KEY;
if (!directUrl || !gatewayUrl || !key) throw new Error("sandbox probe configuration missing");
const direct = createClient(directUrl, key, { auth: { persistSession: false, autoRefreshToken: false } });
const gateway = createClient(gatewayUrl, key, { auth: { persistSession: false, autoRefreshToken: false } });
const directResult = await direct.from("staff_users").select("username,active").eq("username", "e2e-admin").maybeSingle();
const gatewayResult = await gateway.from("staff_users").select("username,active").eq("username", "e2e-admin").maybeSingle();
const query = "staff_users?username=eq.e2e-admin&select=username,active";
const directHttp = await fetch(`${directUrl}/rest/v1/${query}`, { headers: { apikey: key, authorization: `Bearer ${key}` } });
const gatewayHttp = await fetch(`${gatewayUrl}/rest/v1/${query}`, { headers: { apikey: key, authorization: `Bearer ${key}` } });
console.log(JSON.stringify({
  directError: directResult.error?.code ?? null,
  directErrorStatus: directResult.error?.status ?? null,
  directRow: Boolean(directResult.data),
  gatewayError: gatewayResult.error?.code ?? null,
  gatewayErrorStatus: gatewayResult.error?.status ?? null,
  gatewayRow: Boolean(gatewayResult.data),
  directHttpStatus: directHttp.status,
  gatewayHttpStatus: gatewayHttp.status,
}));
if (!directResult.error || directResult.data || directHttp.status < 400) throw new Error("direct root endpoint unexpectedly accepted Supabase SDK REST query");
if (gatewayResult.error || !gatewayResult.data || !gatewayHttp.ok) throw new Error("sandbox gateway did not satisfy Supabase SDK REST query");
