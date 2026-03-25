import { logAudit } from "./audit";
import { db, fail, ok, ServiceResult, withError } from "./common";

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

const nextDocCode = async (direction: DocumentDirection): Promise<string> => {
  const year = new Date().getFullYear();
  const headMap: Record<DocumentDirection, string> = {
    incoming: "CV-DEN",
    outgoing: "CV-DI",
    contract: "HD",
    common: "TL-CHUNG",
  };
  const head = headMap[direction];
  const prefix = `${head}-${year}-`;
  const { data } = await db.from("official_documents").select("doc_code").ilike("doc_code", `${prefix}%`).order("doc_code", { ascending: false }).limit(1).maybeSingle();
  const current = data?.doc_code ?? `${prefix}0000`;
  const matched = current.match(/(\d+)$/);
  const n = Number(matched?.[1] ?? "0") + 1;
  return `${prefix}${String(n).padStart(4, "0")}`;
};

export async function listDocuments(): Promise<ServiceResult<OfficialDocument[]>> {
  try {
    const { data, error } = await db
      .from("official_documents")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) return fail(error.message);
    return ok((data ?? []) as OfficialDocument[]);
  } catch (error) {
    return fail(withError(error, "Không tải được công văn."));
  }
}

export async function createDocument(input: OfficialDocument, actorId?: string): Promise<ServiceResult<OfficialDocument>> {
  if (!input.title?.trim() || !input.direction) {
    return fail("Thiếu title hoặc direction.");
  }

  try {
    const code = input.doc_code?.trim().toUpperCase() || (await nextDocCode(input.direction));
    const { data, error } = await db
      .from("official_documents")
      .insert({
        ...input,
        doc_code: code,
        title: input.title.trim(),
        urgency: input.urgency ?? "normal",
        confidentiality: input.confidentiality ?? "normal",
        status: input.status ?? "new",
        created_by: actorId ?? null,
      })
      .select("*")
      .single();

    if (error) return fail(error.message);

    await logAudit({ actorId, module: "documents", entityType: "official_documents", entityId: data.id, action: "create", newData: data });
    return ok(data as OfficialDocument);
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
    const { error } = await db.from("document_assignments").insert({
      document_id: documentId,
      assignee_id: assigneeId,
      assigned_by: actorId ?? null,
      due_date: dueDate ?? null,
      status: "todo",
    });

    if (error) return fail(error.message);

    await db.from("official_documents").update({ status: "in_progress", updated_at: new Date().toISOString() }).eq("id", documentId);

    await logAudit({
      actorId,
      module: "documents",
      entityType: "document_assignments",
      entityId: documentId,
      action: "assign",
      newData: { documentId, assigneeId, dueDate },
    });

    return ok(true);
  } catch (error) {
    return fail(withError(error, "Không giao xử lý được công văn."));
  }
}
