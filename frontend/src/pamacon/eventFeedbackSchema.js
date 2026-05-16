/** Aligned with AIA PAMA Con feedback Google Form (coffee sessions, dinners, hotel, written prompts). */

export const FEEDBACK_STEP_LABELS = {
  1: "About you",
  2: "Conference experiences",
  3: "Reflections & testimonial",
};

/** Numeric ratings (1–5), same order as the Google Form experience questions. */
export const FEEDBACK_RATING_KEYS = [
  "coffee_sessions",
  "welcome_dinner",
  "conference_proper",
  "fellowship_night",
  "hotel_venue",
];

export const FEEDBACK_RATING_LABELS = {
  coffee_sessions: "Day 1 Breakout Sessions",
  welcome_dinner: "Welcome Dinner",
  conference_proper: "Conference proper",
  fellowship_night: "Fellowship Night",
  hotel_venue: "Hotel & venue",
};

export function hotelRatingLabel(venue) {
  const v = String(venue || "").trim();
  return v ? `Hotel & venue (${v})` : FEEDBACK_RATING_LABELS.hotel_venue;
}

export function defaultRatingScores() {
  const o = {};
  for (const key of FEEDBACK_RATING_KEYS) o[key] = 0;
  return o;
}

export function defaultResponses() {
  return {
    displayName: "",
    agency: "",
    speakerImpact: "",
    biggestTakeaway: "",
    testimonial: "",
  };
}

export function formatDisplayName(profile) {
  const last = String(profile?.lastName || "").trim();
  const first = String(profile?.firstName || "").trim();
  if (last && first) return `${first} ${last}`;
  if (last || first) return [first, last].filter(Boolean).join(" ");
  return "";
}

/** Legacy portal ratings (pre–Google Form harmonization). */
export const LEGACY_RATING_LABELS = {
  planning_organization: "Planning & organization (legacy)",
  marketing_communications: "Marketing & communications (legacy)",
  registration_fees: "Registration & fees (legacy)",
  scheduling_program: "Scheduling & program (legacy)",
  speakers_content: "Speakers & content (legacy)",
  food_beverage: "Food & beverages (legacy)",
  staff_service: "Staff & service (legacy)",
  technology_av: "Technology & A/V (legacy)",
  overall_experience: "Overall experience (legacy)",
};
