export function isSafeExternalUrl(value, allowHttp = false) {
  if (typeof value !== "string" || !(allowHttp ? /^https?:\/\//i : /^https:\/\//i).test(value)) return false;
  try {
    const url = new URL(value);
    return Boolean(url.hostname) && (url.protocol === "https:" || allowHttp && url.protocol === "http:");
  } catch {
    return false;
  }
}

export function validateExternalLinkRows(rows) {
  const errors = [];
  if (buildExternalLinksPayload(rows).length > 30) errors.push({ index: -1, message: "Chỉ được thêm tối đa 30 liên kết." });
  rows.forEach((row, index) => {
    const label = row.label.trim(), url = row.url.trim();
    if (!label && !url) return;
    if (!label || !url) errors.push({ index, message: "Vui lòng nhập cả tiêu đề và địa chỉ liên kết." });
    else if (!isSafeExternalUrl(url)) errors.push({ index, message: "Địa chỉ liên kết phải bắt đầu bằng https:// và là URL hợp lệ." });
  });
  return errors;
}

export function buildExternalLinksPayload(rows) {
  return rows.filter((row) => row.label.trim() || row.url.trim()).map((row) => ({ provider: row.provider || "web", url: row.url.trim(), label: row.label.trim() }));
}
