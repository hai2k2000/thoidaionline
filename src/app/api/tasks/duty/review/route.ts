import { randomUUID } from "node:crypto";
import { apiError, apiJson, asUuid, requireMutationActor, requireReadActor } from "@/lib/serverApi";
import { serverSupabase } from "@/lib/serverSupabase";

const storage = serverSupabase.storage.from("task-private");
const results = new Set(["completed", "issues", "not_completed"]);
const allowed = new Map([["application/pdf","pdf"],["image/png","png"],["image/jpeg","jpg"],["application/vnd.openxmlformats-officedocument.wordprocessingml.document","docx"],["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","xlsx"]]);

export async function POST(request: Request) {
  const guard = await requireMutationActor(); if (!guard.ok) return guard.response;
  if (guard.actor.role_code !== "admin") return apiError("forbidden", 403);
  const form = await request.formData().catch(() => null); if (!form) return apiError("invalid_request", 400);
  const taskId = asUuid(form.get("taskId")); const result = form.get("result"); const onTime = form.get("onTime");
  const notes = typeof form.get("issueNotes") === "string" ? String(form.get("issueNotes")).trim() : "";
  if (!taskId || typeof result !== "string" || !results.has(result) || !["true","false"].includes(String(onTime)) || notes.length > 2000) return apiError("invalid_request", 400);
  const task = await serverSupabase.from("tasks").select("id").eq("id", taskId).eq("task_category", "duty").maybeSingle();
  if (task.error || !task.data) return apiError("not_found", 404);
  const previous = await serverSupabase.from("duty_task_reviews").select("evidence_path").eq("task_id", taskId).maybeSingle();
  const file = form.get("evidence"); let evidence: { evidence_path?:string; evidence_name?:string; evidence_mime?:string; evidence_size?:number } = {};
  if (file instanceof File && file.size > 0) {
    const extension = allowed.get(file.type); if (!extension || file.size > 10485760) return apiError("invalid_request", 400);
    const path = `duty-evidence/${taskId}/${randomUUID()}.${extension}`;
    const uploaded = await storage.upload(path, Buffer.from(await file.arrayBuffer()), { contentType:file.type, cacheControl:"3600", upsert:false });
    if (uploaded.error) return apiError("operation_failed", 500);
    evidence = { evidence_path:path, evidence_name:file.name.slice(0,500), evidence_mime:file.type, evidence_size:file.size };
  }
  const payload = { task_id:taskId, result, on_time:onTime === "true", issue_notes:notes || null, reviewed_by:guard.actor.id, reviewed_at:new Date().toISOString(), updated_at:new Date().toISOString(), ...evidence };
  const saved = await serverSupabase.from("duty_task_reviews").upsert(payload, { onConflict:"task_id" });
  if (saved.error) { if (evidence.evidence_path) await storage.remove([evidence.evidence_path]); return apiError("operation_failed", 500); }
  if (evidence.evidence_path && previous.data?.evidence_path && previous.data.evidence_path !== evidence.evidence_path) await storage.remove([previous.data.evidence_path]);
  return apiJson({ ok:true });
}

export async function GET(request: Request) {
  const guard = await requireReadActor(); if (!guard.ok) return guard.response;
  if (guard.actor.role_code !== "admin") return apiError("forbidden", 403);
  const taskId = asUuid(new URL(request.url).searchParams.get("taskId")); if (!taskId) return apiError("invalid_request", 400);
  const row = await serverSupabase.from("duty_task_reviews").select("evidence_path").eq("task_id", taskId).maybeSingle();
  if (row.error || !row.data?.evidence_path) return apiError("not_found", 404);
  const signed = await storage.createSignedUrl(row.data.evidence_path, 60);
  return signed.error || !signed.data?.signedUrl ? apiError("operation_failed", 500) : Response.redirect(signed.data.signedUrl, 302);
}
