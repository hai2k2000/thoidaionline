const ANNOUNCEMENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
export async function prepareAnnouncementImage(file) {
  if (ANNOUNCEMENT_TYPES.has(file.type) && file.size < 1.5 * 1024 * 1024) return { file, width: null, height: null };
  let bitmap;
  try { bitmap = await createImageBitmap(file, { imageOrientation: "from-image" }); const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height)); const width = Math.max(1, Math.round(bitmap.width * scale)); const height = Math.max(1, Math.round(bitmap.height * scale)); const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height; const context = canvas.getContext("2d"); if (!context) throw new Error("canvas"); context.drawImage(bitmap, 0, 0, width, height); const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85)); if (!blob) throw new Error("blob"); return { file: new File([blob], "announcement.jpg", { type: "image/jpeg" }), width, height }; } finally { bitmap?.close(); }
}
