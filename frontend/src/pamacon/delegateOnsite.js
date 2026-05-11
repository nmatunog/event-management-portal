import { formatPositionShort, positionLabelLong } from "./positionCodes";
import { formatShirtSizeCell } from "./shirtOrderingPolicy";

export const PAMACON_CHECK_IN_TIMEZONE = "Asia/Manila";
export const PAMACON_VENUE_ARRIVAL_DATE = "2026-05-13";
export const PAMACON_HALL_ENTRY_DATE = "2026-05-14";
export const SELF_CHECK_IN_DISCLAIMER =
  "This is not the Waterfront Hotel Check In. This is the Conference Self Registration and Event Check in.";

export const DELEGATE_CHECK_IN_PHASES = [
  {
    id: "venue-arrival",
    label: "May 13 · venue arrival",
    shortLabel: "May 13",
    eventDate: PAMACON_VENUE_ARRIVAL_DATE,
    description: "Capture registration details and check the delegate in for May 13.",
  },
  {
    id: "hall-entry",
    label: "May 14 · hall entry",
    shortLabel: "May 14",
    eventDate: PAMACON_HALL_ENTRY_DATE,
    description: "Confirm hall entry for May 14. Details from May 13 stay on file.",
  },
];

export function getManilaDateKey(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: PAMACON_CHECK_IN_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** On event days, the desk opens in the matching check-in window. */
export function getAutoCheckInPhaseForToday(now = new Date()) {
  const today = getManilaDateKey(now);
  if (today === PAMACON_HALL_ENTRY_DATE) return "hall-entry";
  if (today === PAMACON_VENUE_ARRIVAL_DATE) return "venue-arrival";
  return null;
}

export function isCheckInDetailsPhase(phase) {
  return normalizeCheckInPhase(phase) === "venue-arrival";
}

export function getCheckInPhaseForToday(now = new Date()) {
  return getAutoCheckInPhaseForToday(now) || "venue-arrival";
}

export function isHallEntryQuickCheckIn(phase) {
  return normalizeCheckInPhase(phase) === "hall-entry";
}

export function isVenueRegistrationCheckIn(phase) {
  return isCheckInDetailsPhase(phase);
}

export const DELEGATE_ONSITE_POSITION_OPTIONS = [
  { value: "DD", label: "District Director" },
  { value: "AD", label: "Agency Director" },
  { value: "SUM", label: "Senior Unit Manager" },
  { value: "UM", label: "Unit Manager" },
];

function normalizeToken(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function nameTokens(row) {
  const first = normalizeToken(row?.firstName);
  const last = normalizeToken(row?.lastName);
  const full = normalizeToken(row?.name);
  const words = full.split(/\s+/).filter(Boolean);
  return { first, last, full, words };
}

function scoreDelegateMatch(row, query) {
  const q = normalizeToken(query);
  if (!q) return -1;
  const { first, last, full, words } = nameTokens(row);
  let score = 0;
  if (last && last.startsWith(q)) score += 120 + (last.length === q.length ? 10 : 0);
  if (first && first.startsWith(q)) score += 100;
  for (const word of words) {
    if (word.startsWith(q)) score += 70;
    else if (word.includes(q)) score += 25;
  }
  if (full.includes(q)) score += 15;
  const nickname = normalizeToken(row?.nickname);
  if (nickname && nickname.startsWith(q)) score += 60;
  return score;
}

/** Predictive lookup after 1–2 characters on first or family name. */
export function filterDelegatesByNameQuery(registrants, query, { minChars = 1, limit = 12 } = {}) {
  const q = normalizeToken(query);
  if (q.length < minChars) return [];
  return [...(registrants || [])]
    .map((row) => ({ row, score: scoreDelegateMatch(row, q) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || String(a.row.name || "").localeCompare(String(b.row.name || "")))
    .slice(0, limit)
    .map((entry) => entry.row);
}

export function normalizeCheckInPhase(phase) {
  return String(phase || "").trim().toLowerCase() === "hall-entry" ? "hall-entry" : "venue-arrival";
}

export function getCheckInPhaseMeta(phase) {
  if (normalizeCheckInPhase(phase) === "hall-entry") {
    return {
      atKey: "hallEntryCheckInAt",
      byKey: "hallEntryCheckInBy",
    };
  }
  return {
    atKey: "venueArrivalCheckInAt",
    byKey: "venueArrivalCheckInBy",
  };
}

export function delegateContactNumber(row) {
  const meta = row?.metaBase && typeof row.metaBase === "object" ? row.metaBase : {};
  return String(row?.mobileNumber || meta.mobileNumber || meta.attendeeClaimMobile || "").trim();
}

export function delegateAgentCode(row) {
  const meta = row?.metaBase && typeof row.metaBase === "object" ? row.metaBase : {};
  return String(row?.aiaAgentCode || meta.aiaAgentCode || "").trim();
}

export function delegateRoomNumber(row) {
  const meta = row?.metaBase && typeof row.metaBase === "object" ? row.metaBase : {};
  return String(row?.roomNumber || meta.roomNumber || "").trim();
}

export function delegateVenueArrivalCheckInAt(row) {
  const meta = row?.metaBase && typeof row.metaBase === "object" ? row.metaBase : {};
  return String(row?.venueArrivalCheckInAt || meta.venueArrivalCheckInAt || row?.onsiteRegisteredAt || meta.onsiteRegisteredAt || "").trim();
}

export function delegateVenueArrivalCheckInBy(row) {
  const meta = row?.metaBase && typeof row.metaBase === "object" ? row.metaBase : {};
  return String(row?.venueArrivalCheckInBy || meta.venueArrivalCheckInBy || row?.onsiteRegisteredBy || meta.onsiteRegisteredBy || "").trim();
}

export function delegateHallEntryCheckInAt(row) {
  const meta = row?.metaBase && typeof row.metaBase === "object" ? row.metaBase : {};
  return String(row?.hallEntryCheckInAt || meta.hallEntryCheckInAt || "").trim();
}

export function delegateHallEntryCheckInBy(row) {
  const meta = row?.metaBase && typeof row.metaBase === "object" ? row.metaBase : {};
  return String(row?.hallEntryCheckInBy || meta.hallEntryCheckInBy || "").trim();
}

export function isDelegatePhaseCheckedIn(row, phase) {
  const normalized = normalizeCheckInPhase(phase);
  if (normalized === "hall-entry") return Boolean(delegateHallEntryCheckInAt(row));
  return Boolean(delegateVenueArrivalCheckInAt(row) || String(row?.checkedInAt || "").trim());
}

export function countDelegatesPhaseCheckedIn(registrants, phase) {
  return (registrants || []).filter((row) => isDelegatePhaseCheckedIn(row, phase)).length;
}

export function isDelegateCheckedIn(row) {
  return isDelegatePhaseCheckedIn(row, "venue-arrival") || isDelegatePhaseCheckedIn(row, "hall-entry");
}

export function onsiteMasterlistHeaders() {
  return [
    "Full Name",
    "First Name",
    "Last Name",
    "Nickname",
    "Position",
    "AIA Agent Code",
    "Contact No.",
    "Room No.",
    "Registration Status",
    "Venue Arrival Check-in (May 13)",
    "Venue Arrival Checked In By",
    "Hall Entry Check-in (May 14)",
    "Hall Entry Checked In By",
    "Conference Kit Claimed",
    "T-shirt Claimed",
    "Participant Shirt",
    "Committee Shirt",
    "Payment Mode",
    "Paid Amount",
    "Payment Validation",
    "Remarks",
  ];
}

function parseRegistrationMeta(row) {
  const raw = row?.metadata_json ?? row?.metaBase;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return raw && typeof raw === "object" ? raw : {};
}

export function mapRegistrationFromApi(row) {
  const meta = parseRegistrationMeta(row);
  const nameParts = String(row?.full_name || row?.name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const inferredLast = String(meta.lastName || (nameParts.length ? nameParts[nameParts.length - 1] : "")).trim();
  const inferredFirst = String(meta.firstName || (nameParts.length ? nameParts[0] : "")).trim();
  const roleSource = String(meta.positionCode || row?.attendee_type || row?.role || "").trim();
  const mode =
    row?.payment_plan === "installment" ? "Installment" : row?.payment_plan === "partial" ? "Partial" : "Full";
  return {
    id: row?.id,
    name: row?.full_name || row?.name || "",
    firstName: inferredFirst,
    lastName: inferredLast,
    role: formatPositionShort(roleSource),
    mode,
    status: row?.status || "pre-registered",
    metaBase: { ...meta },
    aiaAgentCode: meta.aiaAgentCode || "",
    mobileNumber: meta.mobileNumber || meta.attendeeClaimMobile || "",
    roomNumber: meta.roomNumber || "",
    checkedInAt: row?.checked_in_at || "",
    venueArrivalCheckInAt: meta.venueArrivalCheckInAt || meta.onsiteRegisteredAt || "",
    venueArrivalCheckInBy: meta.venueArrivalCheckInBy || meta.onsiteRegisteredBy || "",
    hallEntryCheckInAt: meta.hallEntryCheckInAt || "",
    hallEntryCheckInBy: meta.hallEntryCheckInBy || "",
    onsiteRegisteredAt: meta.onsiteRegisteredAt || meta.venueArrivalCheckInAt || "",
    onsiteRegisteredBy: meta.onsiteRegisteredBy || meta.venueArrivalCheckInBy || "",
  };
}

export function onsiteMasterlistRow(row) {
  const position = formatPositionShort(row?.role);
  return [
    row?.name || "",
    row?.firstName || "",
    row?.lastName || "",
    row?.nickname || "",
    positionLabelLong(position),
    delegateAgentCode(row),
    delegateContactNumber(row),
    delegateRoomNumber(row),
    row?.status || "",
    delegateVenueArrivalCheckInAt(row),
    delegateVenueArrivalCheckInBy(row),
    delegateHallEntryCheckInAt(row),
    delegateHallEntryCheckInBy(row),
    row?.conferenceKitClaimed ? "Yes" : "No",
    row?.tshirtClaimed ? "Yes" : "No",
    formatShirtSizeCell(row?.shirtSize, row?.shirtSizeOther),
    formatShirtSizeCell(row?.committeeShirtSize, row?.committeeShirtSizeOther),
    row?.mode || "",
    Number(row?.paid || 0),
    String(row?.paymentValidationStatus || "pending"),
    row?.remarks || "",
  ];
}
