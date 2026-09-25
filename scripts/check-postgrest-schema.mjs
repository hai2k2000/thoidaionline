const base = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const key = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
if (!base || !key) {
  console.error("PostgREST schema check requires SUPABASE_URL and anon key");
  process.exit(2);
}
const headers = { apikey: key, authorization: `Bearer ${key}`, accept: "application/json" };
const checks = [
  ["tasks fields", "/rest/v1/tasks?select=approval_required,assignment_source&limit=0"],
  ["journalism fields", "/rest/v1/journalism_task_details?select=task_id,planned_publication_at&limit=0"],
  ["work schedule", "/rest/v1/work_schedules?select=id,workflow_revision&limit=0"],
];
const requiredRpcs = ["api_review_personal_work_schedule", "api_merge_attendance_log"];
for (const [name, path] of checks) {
  const response = await fetch(`${base}${path}`, { headers });
  if (!response.ok) {
    console.error(`${name}: HTTP ${response.status}`);
    process.exit(1);
  }
  console.log(`PASS ${name}`);
}
for (const rpc of requiredRpcs) {
  const response = await fetch(`${base}/rest/v1/rpc/${rpc}`, { method: "POST", headers, body: "{}" });
  if (response.status === 404) {
    console.error(`${rpc}: RPC not visible in PostgREST schema`);
    process.exit(1);
  }
  console.log(`PASS ${rpc} visible`);
}
console.log("postgrest-schema: PASS");
