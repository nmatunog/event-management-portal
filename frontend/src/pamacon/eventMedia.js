/** Normalize Google Drive folder or file links for attendee event media. */
export function normalizeEventMediaDriveUrl(raw) {
  const url = String(raw || "").trim();
  if (!url) return "";
  try {
    const parsed = new URL(url);
    if (!/^https?:$/i.test(parsed.protocol)) return "";
    const host = parsed.hostname.toLowerCase();
    if (!host.includes("drive.google.com") && !host.includes("docs.google.com")) return url;
    return parsed.toString();
  } catch {
    return "";
  }
}

export const DEFAULT_EVENT_MEDIA_LABEL = "Event photos & videos";
