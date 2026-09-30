import { apiError, apiJson, requireMutationActor } from "@/lib/serverApi";
import { dutyTaskRepository } from "@/lib/dutyTaskRepository";
import { readDutyRosterWorkbook } from "@/lib/dutyRosterExcel.mjs";
import { groupDutyImportRows, resolveDutyImportRows, summarizeDutyImport, validateDutyImportRows } from "@/lib/dutyRosterImport.mjs";

export const runtime = "nodejs";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;

function invalid(message: string) {
  return apiJson({ error: { code: "invalid_request", message } }, 400);
}

async function parseForm(request: Request) {
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) throw new Error("Vui lòng chọn file Excel.");
  if (file.size < 1 || file.size > MAX_FILE_BYTES) throw new Error("File Excel phải có dung lượng từ 1 byte đến 5 MB.");
  if (!file.name.toLowerCase().endsWith(".xlsx")) throw new Error("Chỉ hỗ trợ file Excel .xlsx.");
  const parsed = await readDutyRosterWorkbook(Buffer.from(await file.arrayBuffer()));
  if (!monthPattern.test(parsed.month) || !validateDutyImportRows(parsed.month, parsed.rows)) throw new Error("Bố cục file Excel không hợp lệ.");
  return { form, parsed };
}

export async function POST(request: Request) {
  const guard = await requireMutationActor();
  if (!guard.ok) return guard.response;
  if (guard.actor.role_code !== "admin") return apiError("forbidden", 403);
  try {
    const { form, parsed } = await parseForm(request);
    const options = await dutyTaskRepository.options();
    if (!options.ok) return apiError("service_unavailable", 503);
    const resolved = resolveDutyImportRows(parsed.rows, options.people);
    const mode = form?.get("mode") === "confirm" ? "confirm" : "preview";
    const departmentId = typeof form?.get("departmentId") === "string" ? String(form.get("departmentId")) : "";
    const reviewerId = typeof form?.get("reviewerId") === "string" ? String(form.get("reviewerId")) : "";
    const errors = resolved.errors.map((item) => ({ ...item.row, reason: item.reason }));
    const existing = await dutyTaskRepository.month(parsed.month);
    if (!existing.ok) return apiError("service_unavailable", 503);
    const summary = summarizeDutyImport(resolved.resolved.map((row) => ({ date: row.date, position: row.position, assigneeId: row.assigneeId })), existing.rows, { departmentId, reviewerId });
    if (mode === "preview") {
      return apiJson({ month: parsed.month, total: parsed.rows.length, valid: resolved.resolved.length, rejected: errors.length, errors, summary });
    }
    if (errors.length) return invalid("Không thể nhập vì còn nhân sự chưa đối chiếu được.");
    if (summary.locked) return invalid("Lịch hiện tại có ca đã bắt đầu hoặc đã duyệt, không thể thay thế tự động.");
    if (!departmentId || !reviewerId) return invalid("Thiếu phòng ban hoặc người duyệt lịch trực.");
    const saved = await dutyTaskRepository.save(guard.actor.id, { month: parsed.month, departmentId, reviewerId, days: groupDutyImportRows(resolved.resolved) });
    return saved.ok ? apiJson({ month: parsed.month, imported: resolved.resolved.length, summary: saved.summary }) : apiError("operation_failed", 500);
  } catch (error) {
    return invalid(error instanceof Error ? error.message : "Không đọc được file Excel.");
  }
}
