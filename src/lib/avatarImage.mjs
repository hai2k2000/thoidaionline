const AVATAR_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const AVATAR_MAX_BYTES = 512 * 1024;

export function avatarTargetSize(width, height, maxSide = 1024) {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export function shouldKeepAvatarFile(file) {
  return AVATAR_TYPES.has(file.type) && file.size <= AVATAR_MAX_BYTES;
}

function canvasToBlob(canvas, quality) {
  return new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", quality));
}

export async function prepareAvatarImage(file) {
  if (shouldKeepAvatarFile(file)) return file;
  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const { width, height } = avatarTargetSize(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("canvas");
    context.fillStyle = "#fff"; context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    let blob = await canvasToBlob(canvas, 0.85);
    if (blob && blob.size > 2 * 1024 * 1024) blob = await canvasToBlob(canvas, 0.7);
    if (!blob) throw new Error("blob");
    return new File([blob], "avatar.jpg", { type: "image/jpeg" });
  } catch {
    throw new Error("Không đọc được ảnh này. Vui lòng chọn ảnh JPG, PNG hoặc WebP.");
  } finally { bitmap?.close(); }
}