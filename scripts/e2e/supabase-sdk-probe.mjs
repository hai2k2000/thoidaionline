import { createClient } from "@supabase/supabase-js";

const directUrl = process.env.E2E_POSTGREST_URL;
const gatewayUrl = process.env.E2E_SUPABASE_URL;
const key = process.env.E2E_SERVICE_ROLE_KEY;
if (!directUrl || !gatewayUrl || !key) throw new Error("sandbox probe configuration missing");
const direct = createClient(directUrl, key, { auth: { persistSession: false, autoRefreshToken: false } });
const gateway = createClient(gatewayUrl, key, { auth: { persistSession: false, autoRefreshToken: false } });
const directResult = await direct.from("staff_users").select("username,active").eq("username", "e2e-admin").maybeSingle();
const gatewayResult = await gateway.from("staff_users").select("username,active").eq("username", "e2e-admin").maybeSingle();
const authQuery = await gateway.from("staff_users").select("id,username,password,password_hash,active,session_version,must_change_password").or("username.eq.e2e-admin,email.ilike.e2e-admin,phone.eq.e2e-admin").limit(1).maybeSingle();
const sessionQuery = await gateway.from("staff_users").select("id,full_name,email,phone,username,department_id,job_title_id,active,session_version,must_change_password,avatar_path,preferences,departments!staff_users_department_id_fkey(code),roles(code,name,level,active,role_permissions(can_manage_users,can_manage_permissions,can_create_task,can_edit_all_tasks,can_comment,can_assign_task,can_view_department_tasks,can_evaluate_step1,can_evaluate_step2,can_manage_rubrics)),job_titles(code)").eq("id", "30000000-0000-4000-8000-000000000001").eq("active", true).single();
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
  authQueryError: authQuery.error?.code ?? null,
  authQueryRow: Boolean(authQuery.data),
  authQueryHash: typeof authQuery.data?.password_hash === "string",
  sessionQueryError: sessionQuery.error?.code ?? null,
  sessionQueryStatus: sessionQuery.error?.status ?? null,
  sessionQueryRow: Boolean(sessionQuery.data),
  directHttpStatus: directHttp.status,
  gatewayHttpStatus: gatewayHttp.status,
}));
if (!directResult.error || directResult.data || directHttp.status < 400) throw new Error("direct root endpoint unexpectedly accepted Supabase SDK REST query");
if (gatewayResult.error || !gatewayResult.data || gatewayResult.data.active !== true || authQuery.error || !authQuery.data || !authQuery.data.active || !authQuery.data.password_hash || !gatewayHttp.ok) throw new Error("sandbox gateway did not satisfy Supabase SDK REST query");
