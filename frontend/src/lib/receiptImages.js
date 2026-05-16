/** Parse stored receipt field (single data URL or JSON array). */
export function parseReceiptDataUrls(stored) {
  const s = String(stored ?? "").trim();
  if (!s) return [];
  if (s.startsWith("[")) {
    try {
      const parsed = JSON.parse(s);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((x) => typeof x === "string" && x.startsWith("data:image/"));
    } catch {
      return [];
    }
  }
  if (s.startsWith("data:image/")) return [s];
  return [];
}

/** Normalize ReceiptUpload value prop to string[]. */
export function normalizeReceiptImages(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  return parseReceiptDataUrls(value);
}
