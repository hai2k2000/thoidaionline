import { apiError, apiJson, requireMutationActor } from "@/lib/serverApi";
import { readDepartmentPlanExcel } from "@/lib/departmentPlanExcel.mjs";
import { resolveDepartmentPlanScope } from "@/lib/departmentPlanAuthorization";
import { departmentPlanRepository } from "@/lib/departmentPlanRepository";

export const dynamic = "force-dynamic";

type ImportedRow = {
  title: string;
  description: string | null;
  assigneeNames: string[];
  collaboratorNames: string[];
  taskId: string | null;
  periodRelation: string;
  workSource: string | null;
  status: string | null;
  dueDate: string | null;
  milestone: string | null;
};

export async function POST(request: Request) {
  const guard = await requireMutationActor();
  if (!guard.ok) return guard.response;
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return apiError("invalid_request", 400);
  const departmentId = typeof form.get("departmentId") === "string" ? String(form.get("departmentId")) : guard.actor.department_id;
  if (!resolveDepartmentPlanScope({ id: guard.actor.id, departmentId: guard.actor.department_id, departmentCode: guard.actor.department_code, roleCode: guard.actor.role_code, roleLevel: guard.actor.role_level, isDepartmentManager: guard.actor.is_department_manager, permissions: guard.actor.permissions }, departmentId)) return apiError("forbidden", 403);
  try {
    const parsed = await readDepartmentPlanExcel(file, {
      periodType: form.get("periodType") === "monthly" ? "monthly" : "weekly",
      periodStart: typeof form.get("periodStart") === "string" ? String(form.get("periodStart")) : null,
      periodEnd: typeof form.get("periodEnd") === "string" ? String(form.get("periodEnd")) : null,
    });
    const explicitTaskIds = parsed.map((item: ImportedRow) => item.taskId).filter(Boolean) as string[];
    const [employees, tasks, explicitTasks] = await Promise.all([departmentPlanRepository.listActiveEmployees(departmentId!), departmentPlanRepository.listImportMatchTasks(departmentId!), departmentPlanRepository.listImportTasksByIds(departmentId!, explicitTaskIds)]);
    if (employees.error || tasks.error || explicitTasks.error) return apiError("operation_failed", 500);
    const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\b(anh|chi|ong|ba|co)\b/g, " ").replace(/[^a-z0-9]+/g, " ").trim();
    const generic = /lanh dao|bo phan|cac phong|phong lien quan/i;
    const resolveNames = (names: string[]) => names.map((name) => {
      const normalizedName = normalize(name);
      const matches = generic.test(normalizedName) ? [] : (employees.data ?? []).filter((employee) => normalize(employee.full_name) === normalizedName || (normalizedName && normalize(employee.full_name).includes(normalizedName)));
      return { name, matches };
    });
    const candidates = parsed.map((item: ImportedRow) => {
      const assigneeMatches = resolveNames(item.assigneeNames);
      const collaboratorMatches = resolveNames(item.collaboratorNames);
      const resolvedAssignees = assigneeMatches.filter((entry) => entry.matches.length === 1).map((entry) => entry.matches[0]);
      const peopleMatches = [...assigneeMatches, ...collaboratorMatches];
      const hasAmbiguous = peopleMatches.some((entry) => entry.matches.length > 1);
      const hasUnresolved = peopleMatches.some((entry) => entry.matches.length === 0);
      const assigneeId = assigneeMatches.length === 1 && assigneeMatches[0].matches.length === 1 ? assigneeMatches[0].matches[0].id : null;
      const words = new Set(normalize(item.title).split(" ").filter((word) => word.length > 2));
      const scored = (tasks.data ?? []).map((task) => ({ task, score: normalize(task.title).split(" ").filter((word) => words.has(word)).length / Math.max(words.size, 1) })).sort((a, b) => b.score - a.score);
      const explicitTask = item.taskId ? (explicitTasks.data ?? []).find((task) => task.id === item.taskId) : null;
      if (item.taskId && !explicitTask) throw new Error(`Task ID liên kết không tồn tại hoặc nằm ngoài phòng ban: ${item.taskId}`);
      const best = scored[0];
      return { ...item, assigneeId, assigneeName: item.assigneeNames.join("; ") || null, assigneeIds: resolvedAssignees.map((employee) => employee.id), assigneeMatches: assigneeMatches.map((entry) => ({ name: entry.name, matches: entry.matches.map((employee) => ({ id: employee.id, full_name: employee.full_name })) })), collaboratorMatches: collaboratorMatches.map((entry) => ({ name: entry.name, matches: entry.matches.map((employee) => ({ id: employee.id, full_name: employee.full_name })) })), mappingConfidence: hasAmbiguous ? "REVIEW" : hasUnresolved ? "UNRESOLVED" : "HIGH", existingTask: explicitTask ? { id: explicitTask.id, title: explicitTask.title, confidence: "HIGH" } : best?.score >= 0.7 ? { id: best.task.id, title: best.task.title, confidence: "HIGH" } : best?.score >= 0.4 ? { id: best.task.id, title: best.task.title, confidence: "REVIEW" } : null };
    });
    return apiJson({ candidates, persisted: false });
  } catch (error) {
    return Response.json({ error: { code: "invalid_request", message: error instanceof Error ? error.message : "File Excel không hợp lệ." } }, { status: 400 });
  }
}
