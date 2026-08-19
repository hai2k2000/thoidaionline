import process from "node:process";
import { createClient } from "@supabase/supabase-js";

process.loadEnvFile("/opt/thoidai-work/.env.local");
process.loadEnvFile("/opt/thoidai-work/.env.production");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Supabase service configuration is missing.");
const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: actor, error: actorError } = await client
  .from("staff_users").select("id").eq("active", true).order("id").limit(1).single();
if (actorError || !actor?.id) throw new Error("No active evaluation actor is available.");
const { error } = await client.rpc("api_ensure_current_performance_cycle", { p_actor: actor.id });
if (error) throw new Error(`Monthly evaluation ensure failed: ${error.message}`);
