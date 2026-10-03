import { apiError, apiJson, requireMutationActor } from "@/lib/serverApi";
import { parseDepartmentPlanDocx } from "@/lib/departmentPlanDocx";
import { resolveDepartmentPlanScope } from "@/lib/departmentPlanAuthorization";
import { departmentPlanRepository } from "@/lib/departmentPlanRepository";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const guard = await requireMutationActor();
  if (!guard.ok) return guard.response;
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return apiError("invalid_request", 400);
  const departmentId = typeof form.get("departmentId") === "string" ? String(form.get("departmentId")) : guard.actor.department_id;
  if (!resolveDepartmentPlanScope({ id: guard.actor.id, departmentId: guard.actor.department_id, departmentCode: guard.actor.department_code, roleCode: guard.actor.role_code, roleLevel: guard.actor.role_level, isDepartmentManager: guard.actor.is_department_manager, permissions: guard.actor.permissions }, departmentId)) return apiError("forbidden", 403);
  try {
    const parsed = await parseDepartmentPlanDocx(file);
    const [employees, tasks] = await Promise.all([departmentPlanRepository.listActiveEmployees(departmentId!), departmentPlanRepository.listImportMatchTasks(departmentId!)]);
    if (employees.error || tasks.error) return apiError("operation_failed", 500);
    const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\b(anh|chi|ong|ba|co)\b/g, " ").replace(/[^a-z0-9]+/g, " ").trim();
    const generic = /lanh dao|bo phan|cac phong|phong lien quan/i;
    const candidates = parsed.map((item) => {
      const rawName = item.assigneeName ?? "";
      const normalizedName = normalize(rawName);
      const matches = generic.test(normalizedName) ? [] : (employees.data ?? []).filter((employee) => normalize(employee.full_name) === normalizedName || (normalizedName && normalize(employee.full_name).includes(normalizedName)));
      const words = new Set(normalize(item.title).split(" ").filter((word) => word.length > 2));
      const scored = (tasks.data ?? []).map((task) => ({ task, score: normalize(task.title).split(" ").filter((word) => words.has(word)).length / Math.max(words.size, 1) })).sort((a, b) => b.score - a.score);
      const best = scored[0];
      return { ...item, assigneeId: matches.length === 1 ? matches[0].id : null, mappingConfidence: matches.length === 1 ? "HIGH" : matches.length > 1 ? "REVIEW" : "UNRESOLVED", existingTask: best?.score >= 0.7 ? { id: best.task.id, title: best.task.title, confidence: "HIGH" } : best?.score >= 0.4 ? { id: best.task.id, title: best.task.title, confidence: "REVIEW" } : null };
    });
    return apiJson({ candidates, persisted: false });
  } catch {
    return apiError("invalid_request", 400);
  }
}
