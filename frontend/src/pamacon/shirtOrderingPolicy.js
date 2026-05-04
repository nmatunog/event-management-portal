/**
 * Committee plans default shirt orders from the admin "Committee shirt" column.
 * Participants may set or change their own shirt on the portal until this instant (Philippines).
 * Afterward, self-service shirt updates are ignored on sync; only admins may change committee defaults (and full delegate metadata via admin tools).
 */
export const PARTICIPANT_SHIRT_EDIT_DEADLINE_MS = Date.parse("2026-05-05T00:00:00+08:00");

export function isParticipantShirtEditOpenNow(now = Date.now()) {
  return now < PARTICIPANT_SHIRT_EDIT_DEADLINE_MS;
}

/** Human-readable cutoff for UI copy (matches PARTICIPANT_SHIRT_EDIT_DEADLINE_MS). */
export function participantShirtDeadlineLabel() {
  return "4 May 2026, end of day (Philippines, UTC+8) — locks at midnight 5 May 2026";
}

/** Size used for ordering counts: participant size if set, otherwise committee default. */
export function effectiveShirtOrderBucket(r) {
  const participant = String(r?.shirtSize || "").trim();
  const committee = String(r?.committeeShirtSize || "").trim();
  const eff = participant || committee;
  if (!eff) return "";
  if (eff.toLowerCase() === "others") {
    const detail =
      participant && String(r.shirtSize || "").toLowerCase() === "others"
        ? String(r.shirtSizeOther || "").trim()
        : String(r.committeeShirtSizeOther || "").trim();
    return `OTHER:${detail || "?"}`;
  }
  return eff.toUpperCase();
}

export function formatShirtSizeCell(size, other) {
  const s = String(size || "").trim();
  if (!s) return "—";
  if (s.toLowerCase() === "others") {
    const o = String(other || "").trim();
    return o ? `Others (${o})` : "Others";
  }
  return s;
}

export const DELEGATE_SHIRT_SIZE_SELECT = [
  { value: "", label: "— Unset —" },
  { value: "XS", label: "XS" },
  { value: "S", label: "S" },
  { value: "M", label: "M" },
  { value: "L", label: "L" },
  { value: "XL", label: "XL" },
  { value: "XXL", label: "XXL" },
  { value: "XXXL", label: "XXXL" },
  { value: "others", label: "Others (specify)" },
];
