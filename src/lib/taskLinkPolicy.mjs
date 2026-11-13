export function normalizeTaskLink(url, title) {
  if (typeof url !== "string" || (title != null && typeof title !== "string")) return null;
  const value = url.trim();
  if (value.length > 2048 || !/^https:\/\/[^\s/@]+/.test(value) || /[\s\\]/.test(value)) return null;
  try {
    const parsed = new URL(value);
    const authority = value.slice(8).split(/[/?#]/, 1)[0];
    if (parsed.protocol !== "https:" || !parsed.hostname || parsed.username || parsed.password || authority.includes("@")) return null;
    return { url: value, title: [...(title?.trim() || parsed.hostname)].slice(0, 200).join("") };
  } catch {
    return null;
  }
}
