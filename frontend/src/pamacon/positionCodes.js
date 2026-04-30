/** Canonical position codes shown in the UI. */
export const POSITION_CODES = ["DD", "AD", "SUM", "UM"];

const CODE_SET = new Set(POSITION_CODES);

/**
 * Map stored attendee_type (long or short) to DD | AD | SUM | UM.
 */
export function formatPositionShort(raw) {
  if (!raw || typeof raw !== "string") return "UM";
  const t = raw.trim();
  const upper = t.toUpperCase();
  if (CODE_SET.has(upper)) return upper;
  const paren = t.match(/\((DD|AD|SUM|UM)\)/i);
  if (paren) return paren[1].toUpperCase();
  const u = t.toUpperCase();
  if (u.includes("DISTRICT") && u.includes("DIRECTOR")) return "DD";
  if (u.includes("AGENCY") && u.includes("DIRECTOR")) return "AD";
  if (u.includes("SENIOR") && u.includes("UNIT")) return "SUM";
  if (u.includes("UNIT") && u.includes("MANAGER")) return "UM";
  return upper.length <= 4 ? upper : "UM";
}

export function positionBadgeClass(code) {
  const c = formatPositionShort(code);
  if (c === "DD") return "bg-red-50 text-red-700 border-red-100";
  return "bg-blue-50 text-blue-700 border-blue-100";
}
