import { apiError, apiJson, asUuid, requireMutationActor } from "@/lib/serverApi";
import { DepartmentPlanExcelValidationError, readDepartmentPlanExcel } from "@/lib/departmentPlanExcel.mjs";
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
  startDate?: string | null;
  reportDate?: string | null;
  duplicateType?: string | null;
  duplicateOf?: number | null;
};

const normalizePlanTitle = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export async function POST(request: Request) {
  const guard = await requireMutationActor();
  if (!guard.ok) return guard.response;
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return apiError("invalid_request", 400);
  const departmentIdValue = form.get("department_id") ?? form.get("departmentId");
  const departmentId = typeof departmentIdValue === "string" ? String(departmentIdValue) : guard.actor.department_id;
  const currentPlanId = asUuid(form.get("current_plan_id") ?? form.get("currentPlanId"));
  if (!currentPlanId) return Response.json({ error: { code: "no_plan", message: "Kỳ này chưa có kế hoạch." } }, { status: 409 });
  if (!resolveDepartmentPlanScope({ id: guard.actor.id, departmentId: guard.actor.department_id, departmentCode: guard.actor.department_code, roleCode: guard.actor.role_code, roleLevel: guard.actor.role_level, isDepartmentManager: guard.actor.is_department_manager, permissions: guard.actor.permissions }, departmentId)) return apiError("forbidden", 403);
  const currentPlan = await departmentPlanRepository.getPlan(currentPlanId);
  if (currentPlan.error) return apiError("operation_failed", 500);
  const requestedPeriodType = form.get("periodType") === "monthly" ? "monthly" : "weekly";
  const requestedPeriodStart = typeof form.get("periodStart") === "string" ? String(form.get("periodStart")) : null;
  const requestedPeriodEnd = typeof form.get("periodEnd") === "string" ? String(form.get("periodEnd")) : null;
  if (!currentPlan.data || currentPlan.data.department_id !== departmentId || currentPlan.data.period_type !== requestedPeriodType || currentPlan.data.period_start !== requestedPeriodStart || currentPlan.data.period_end !== requestedPeriodEnd) return apiError("invalid_request", 400);
  // The selected Plan is the source of truth for the reporting window.
  const periodType = currentPlan.data.period_type;
  const periodStart = currentPlan.data.period_start;
  const periodEnd = currentPlan.data.period_end;
  if (currentPlan.data.status === "closed") return apiError("invalid_request", 400);
  try {
    const parsed = await readDepartmentPlanExcel(file, {
      periodType,
      periodStart,
      periodEnd,
      preserveDuplicates: true,
    });
    const explicitTaskIds = parsed.map((item: ImportedRow) => item.taskId).filter(Boolean) as string[];
    const [employees, tasks, explicitTasks, planItems] = await Promise.all([departmentPlanRepository.listActiveEmployees(departmentId!), departmentPlanRepository.listImportMatchTasks(departmentId!), departmentPlanRepository.listImportTasksByIds(departmentId!, explicitTaskIds), departmentPlanRepository.listPlanItems(currentPlanId)]);
    if (employees.error || tasks.error || explicitTasks.error || planItems.error) return apiError("operation_failed", 500);
    const existingTaskIds = new Set((planItems.data ?? []).map((item) => item.linked_task_id).filter((id): id is string => Boolean(id)));
    const existingTitles = new Set((planItems.data ?? []).map((item) => normalizePlanTitle(item.title)));
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
      const resolvedCollaborators = collaboratorMatches.filter((entry) => entry.matches.length === 1).map((entry) => entry.matches[0]);
      const hasAmbiguous = assigneeMatches.some((entry) => entry.matches.length > 1);
      const hasUnresolved = assigneeMatches.some((entry) => entry.matches.length === 0);
      const assigneeIds = [...new Set(resolvedAssignees.map((employee) => employee.id))];
      const collaboratorIds = [...new Set(resolvedCollaborators.map((employee) => employee.id))].filter((id) => !assigneeIds.includes(id));
      const words = new Set(normalize(item.title).split(" ").filter((word) => word.length > 2));
      const scored = (tasks.data ?? []).map((task) => ({ task, score: normalize(task.title).split(" ").filter((word) => words.has(word)).length / Math.max(words.size, 1) })).sort((a, b) => b.score - a.score);
      const explicitTask = item.taskId ? (explicitTasks.data ?? []).find((task) => task.id === item.taskId) : null;
      if (item.taskId && !explicitTask) throw new Error(`Task ID liên kết không tồn tại hoặc nằm ngoài phòng ban: ${item.taskId}`);
      const best = scored[0];
      const existingTask = explicitTask ? { id: explicitTask.id, title: explicitTask.title, assigneeId: explicitTask.assignee_id, confidence: "HIGH" as const } : best?.score >= 0.7 ? { id: best.task.id, title: best.task.title, assigneeId: best.task.assignee_id, confidence: "HIGH" as const } : best?.score >= 0.4 ? { id: best.task.id, title: best.task.title, assigneeId: best.task.assignee_id, confidence: "REVIEW" as const } : null;
      const matchedTaskId = item.taskId ?? existingTask?.id ?? null;
      const alreadyInPlan = Boolean((matchedTaskId && existingTaskIds.has(matchedTaskId)) || (!matchedTaskId && existingTitles.has(normalizePlanTitle(item.title))));
      const duplicateType = item.duplicateType ?? (alreadyInPlan ? (matchedTaskId ? "CURRENT_PLAN_TASK" : "CURRENT_PLAN_TITLE") : null);
      const duplicateOf = item.duplicateOf ?? null;
      const duplicateRequiresConfirmation = Boolean(duplicateType);
      const assignmentDifference = Boolean(existingTask && assigneeIds.length > 0 && existingTask.assigneeId && !assigneeIds.includes(existingTask.assigneeId));
      const mappingConfidence = item.assigneeNames.length === 0 ? undefined : hasAmbiguous ? "REVIEW" : hasUnresolved || assigneeIds.length === 0 ? "UNRESOLVED" : "HIGH";
      const missingDeadline = assigneeIds.length > 0 && !item.dueDate;
      return { ...item, assigneeName: item.assigneeNames.join("; ") || null, assigneeIds, collaboratorIds, assigneeMatches: assigneeMatches.map((entry) => ({ name: entry.name, matches: entry.matches.map((employee) => ({ id: employee.id, full_name: employee.full_name })) })), collaboratorMatches: collaboratorMatches.map((entry) => ({ name: entry.name, matches: entry.matches.map((employee) => ({ id: employee.id, full_name: employee.full_name })) })), mappingConfidence, assignmentDifference, mappingBlocking: (item.assigneeNames.length > 0 && (mappingConfidence === "REVIEW" || mappingConfidence === "UNRESOLVED")) || assignmentDifference || missingDeadline, existingTask, alreadyInPlan, duplicateType, duplicateOf, duplicateRequiresConfirmation, warning: assignmentDifference ? "Người thực hiện khác Task hiện tại — cần xem xét" : missingDeadline ? "Cần Hạn hoàn thành để giao việc" : duplicateType ? "Dòng trùng — cần chủ phòng xác nhận gộp" : alreadyInPlan ? "Công việc đã có trong kế hoạch kỳ này" : null };
    });
    return apiJson({ candidates, employeeOptions: (employees.data ?? []).map((employee) => ({ id: employee.id, full_name: employee.full_name })), persisted: false });
  } catch (error) {
    if (error instanceof DepartmentPlanExcelValidationError) {
      return Response.json({ ok: false, error: error.code, row: error.row, field: error.field, message: error.message }, { status: 400 });
    }
    console.error("Department Plan Excel import failed", error);
    return Response.json({ ok: false, error: "INVALID_IMPORT_FILE", message: "Không thể đọc file Excel. Vui lòng kiểm tra lại file mẫu." }, { status: 400 });
  }
}
