const encodeFilename = (value) => encodeURIComponent(value).replace(/['()*!]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);

const asciiFallback = (value) => {
  const cleaned = String(value ?? "").replace(/[\r\n"\\]/g, "_").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").replace(/[^A-Za-z0-9._ -]/g, "_").replace(/_+/g, "_").replace(/ +/g, " ").trim();
  if (!cleaned) return "download";
  if (cleaned.length <= 180) return cleaned;
  const extension = cleaned.match(/\.[A-Za-z0-9]+$/)?.[0] ?? "";
  const stem = cleaned.slice(0, cleaned.length - extension.length).slice(0, Math.max(1, 180 - extension.length)).replace(/[ .]+$/g, "") || "download";
  return `${stem}${extension}`;
};

export function contentDisposition(filename, { inline = false } = {}) {
  let value = String(filename ?? "").toWellFormed().replace(/[\x00-\x1f\x7f"\\]/g, "").trim() || "download";
  // Bound the encoded header without cutting off the file extension or a surrogate pair.
  const extension = value.match(/\.[A-Za-z0-9]{1,16}$/)?.[0] ?? "";
  const stem = extension ? value.slice(0, -extension.length) : value;
  value = [...stem].slice(0, 180 - extension.length).join("") + extension;
  return `${inline ? "inline" : "attachment"}; filename="${asciiFallback(value)}"; filename*=UTF-8''${encodeFilename(value)}`;
}
