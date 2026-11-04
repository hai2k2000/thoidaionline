// Preserve unrelated query parameters (for example, the project library tab).
export function readProjectFilterQuery(params, defaults) {
  return Object.fromEntries(Object.entries(defaults).map(([key, fallback]) => [key,
    typeof fallback === "boolean" ? params.get(key) === "1" : params.get(key) ?? fallback,
  ]));
}
export function writeProjectFilterQuery(params, filters, defaults) {
  const next = new URLSearchParams(params.toString());
  for (const [key, fallback] of Object.entries(defaults)) {
    const value = filters[key] ?? fallback;
    if (value === fallback || value === "") next.delete(key);
    else next.set(key, value === true ? "1" : String(value));
  }
  return next.toString();
}
export function activeProjectFilterCount(filters, defaults) {
  return Object.entries(defaults).filter(([key, value]) => key !== "sort" && filters[key] !== value).length;
}
