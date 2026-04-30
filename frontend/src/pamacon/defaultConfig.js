export const PAMACON_TITLE = "PAMACON 2026";

export const DEFAULT_PROGRAM_MODULES = [
  { day: "Day 1 - May 13", time: "4:00", program: "Breakout Coffee Session", assigned: "Check in area Coffee Shop" },
  { day: "Day 1 - May 13", time: "6:00", program: "Welcome Dinner (Barrio Fiesta?)", assigned: "Arctic Hall?" },
  { day: "Day 2 - May 14", time: "9:00", program: "Welcome Ceremonies", assigned: "Hosts (Belmar & Jen)" },
  { day: "Day 2 - May 14", time: "9:30", program: "Opening Remarks", assigned: "Nilo Matunog" },
  { day: "Day 2 - May 14", time: "9:50", program: "Message from the CEO", assigned: "Melita Teo" },
  { day: "Day 2 - May 14", time: "10:00", program: "Talk 1", assigned: "Eric Nicdao?" },
  { day: "Day 2 - May 14", time: "10:30", program: "Keynote Speaker ?", assigned: "" },
  { day: "Day 2 - May 14", time: "11:15", program: "Medicard", assigned: "Reyann Altoveros" },
  { day: "Day 2 - May 14", time: "12:00", program: "Lunch (with talks of Sponsors)", assigned: "" },
  { day: "Day 2 - May 14", time: "1:00", program: "Election of New Board (COMELEC?)", assigned: "" },
  { day: "Day 2 - May 14", time: "1:45", program: "Talk 2", assigned: "" },
  { day: "Day 2 - May 14", time: "2:45", program: "Panel (DJ)", assigned: "" },
  { day: "Day 2 - May 14", time: "3:45", program: "Talk 3", assigned: "Chris Cervantes ?" },
  { day: "Day 2 - May 14", time: "4:30", program: "Mini-workshop / Recap", assigned: "Consolidate Learnings" },
  { day: "Day 2 - May 14", time: "5:15", program: "Announcement of New BOD", assigned: "" },
  { day: "Day 2 - May 14", time: "5:30", program: "Closing", assigned: "" },
  { day: "Day 2 - May 14", time: "6:30", program: "Fellowship Dinner", assigned: "Rock of Ages" },
];

export const DEFAULT_EXPENSE_BUDGET_MODULES = [
  { label: "Accommodation & Banquets", budget: 680000, categories: ["Accommodation & Banquets"] },
  { label: "Speakers & Talent", budget: 70000, categories: ["Speakers & Talent"] },
  { label: "Lights & Sound", budget: 100000, categories: ["Lights and Sounds"] },
  { label: "Decor & Creative", budget: 200000, categories: ["Decor", "Program Materials"] },
  { label: "Operations & Supplies", budget: 100000, categories: ["Supplies", "Miscellaneous", "Others"] },
];

/** Defaults for the signed-in attendee portal (posters, promo video, quote email). */
export const DEFAULT_ATTENDEE_PORTAL = {
  /** Full YouTube watch or youtu.be URL — shown in the portal when set. */
  youtubeUrl: "",
  /** Number of poster cards shown in attendee portal hub. */
  posterDisplayCount: 3,
  /** Up to six image URLs for marketing posters; empty strings show placeholders. */
  posterImageUrls: ["", "", "", "", "", ""],
  /** Organizer inbox for quote requests (mailto). Falls back to VITE_QUOTE_REQUEST_EMAIL. */
  quoteRequestEmail: "",
};

export const DEFAULT_PAMACON_CONFIG = {
  eventName: PAMACON_TITLE,
  theme: "Sulog: Rise with the current",
  targetRegistrants: 100,
  attendeePortal: { ...DEFAULT_ATTENDEE_PORTAL },
  roomRate: 3800,
  soloUpgrade: 3800,
  umInstallment: 2850,
  projections: {
    hotelFunction: 364000,
    rooms: 266000,
    speakerHonorarium: 150000,
  },
  programModules: DEFAULT_PROGRAM_MODULES,
  expenseBudgetModules: DEFAULT_EXPENSE_BUDGET_MODULES,
};

export function mergeConfigFromEvent(eventRow) {
  if (!eventRow?.config_json) return { ...DEFAULT_PAMACON_CONFIG };
  try {
    const parsed = JSON.parse(eventRow.config_json);
    const posterUrls = Array.isArray(parsed.attendeePortal?.posterImageUrls)
      ? parsed.attendeePortal.posterImageUrls.slice(0, 6)
      : null;
    const mergedPosters = posterUrls
      ? [...posterUrls, "", "", "", "", "", ""].slice(0, 6)
      : DEFAULT_ATTENDEE_PORTAL.posterImageUrls;
    const parsedDisplayCount = Number(parsed.attendeePortal?.posterDisplayCount);
    const posterDisplayCount = Number.isFinite(parsedDisplayCount)
      ? Math.max(1, Math.min(6, Math.trunc(parsedDisplayCount)))
      : DEFAULT_ATTENDEE_PORTAL.posterDisplayCount;
    return {
      ...DEFAULT_PAMACON_CONFIG,
      ...parsed,
      projections: {
        ...DEFAULT_PAMACON_CONFIG.projections,
        ...(parsed.projections || {}),
      },
      programModules: Array.isArray(parsed.programModules) ? parsed.programModules : DEFAULT_PROGRAM_MODULES,
      expenseBudgetModules: Array.isArray(parsed.expenseBudgetModules)
        ? parsed.expenseBudgetModules
        : DEFAULT_EXPENSE_BUDGET_MODULES,
      attendeePortal: {
        ...DEFAULT_ATTENDEE_PORTAL,
        ...(parsed.attendeePortal || {}),
        posterDisplayCount,
        posterImageUrls: mergedPosters,
      },
    };
  } catch {
    return { ...DEFAULT_PAMACON_CONFIG };
  }
}
