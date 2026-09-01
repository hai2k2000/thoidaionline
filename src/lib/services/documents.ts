import { fail, ok, ServiceResult, withError } from "./common";

export type DocumentDirection = "incoming" | "outgoing" | "contract" | "common";

export type OfficialDocument = {
  id?: string;
  doc_code?: string;
  direction: DocumentDirection;
  title: string;
  urgency?: "normal" | "important" | "urgent";
  confidentiality?: "normal" | "internal" | "secret";
  status?: "new" | "in_progress" | "done" | "archived";
  processing_deadline?: string | null;
  owner_user_id?: string | null;
  owner_department_id?: string | null;
  summary?: string | null;
  note?: string | null;
};

const parse = async <T>(response: Response, fallback: string): Promise<ServiceResult<T>> => {
  const body = await response.json().catch(() => null) as { error?: string; document?: T; documents?: T[]; users?: unknown[] } | null;
  if (!response.ok) return fail(body?.error || fallback);
  return ok(body as T);
};

export async function listDocuments(): Promise<ServiceResult<OfficialDocument[]>> {
  try {
    const response = await fetch("/api/documents", { cache: "no-store" });
    const result = await parse<{ documents?: OfficialDocument[] }>(response, "Không tải được công văn.");
    return result.ok ? ok(result.data.documents ?? []) : result;
  } catch (error) {
    return fail(withError(error, "Không tải được công văn."));
  }
}

export async function createDocument(input: OfficialDocument, actorId?: string): Promise<ServiceResult<OfficialDocument>> {
  if (!input.title?.trim() || !input.direction) {
    return fail("Thiếu title hoặc direction.");
  }

  try {
    const response = await fetch("/api/documents", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...input, actorId }) });
    const result = await parse<{ document?: OfficialDocument }>(response, "Không tạo được công văn.");
    return result.ok && result.data.document ? ok(result.data.document) : result.ok ? fail("Không tạo được công văn.") : result;
  } catch (error) {
    return fail(withError(error, "Không tạo được công văn."));
  }
}

export async function assignDocument(
  documentId: string,
  assigneeId: string,
  actorId?: string,
  dueDate?: string
): Promise<ServiceResult<true>> {
  if (!documentId || !assigneeId) return fail("Thiếu documentId hoặc assigneeId.");

  try {
    const response = await fetch("/api/documents", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "assign", document_id: documentId, assignee_id: assigneeId, due_date: dueDate ?? null, actorId }) });
    const result = await parse<{ assignment?: unknown }>(response, "Không giao xử lý được công văn.");
    return result.ok ? ok(true) : result;
  } catch (error) {
    return fail(withError(error, "Không giao xử lý được công văn."));
  }
}
