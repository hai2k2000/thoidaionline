export function validateReopenReason(reason) {
  const value = typeof reason === "string" ? reason.trim() : "";
  return value.length >= 5 && value.length <= 500 ? { ok: true, value } : { ok: false, message: "Lý do mở lại phải có từ 5 đến 500 ký tự." };
}

export function buildReopenRequest(reportId, reason) {
  const normalized = validateReopenReason(reason);
  return normalized.ok && typeof reportId === "string" && reportId ? { reportId, reason: normalized.value } : null;
}

export function projectVersionSnapshot(version) {
  const snapshot = version?.snapshot_payload && typeof version.snapshot_payload === "object" ? version.snapshot_payload : {};
  const rows = (value) => Array.isArray(value) ? value.map((row) => ({
    ...(typeof row?.title === "string" ? { title: row.title } : {}),
    ...((typeof row?.resultText === "string" ? row.resultText : typeof row?.commentary === "string" ? row.commentary : "") ? { text: typeof row.resultText === "string" ? row.resultText : row.commentary } : {}),
  })) : [];
  return { currentRows: rows(snapshot.currentRows), nextRows: rows(snapshot.nextRows), difficulties: typeof snapshot.difficulties === "string" ? snapshot.difficulties : "" };
}
