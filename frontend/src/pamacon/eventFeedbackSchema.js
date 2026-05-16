/** PAMACON evaluation — program order: Day 1 breakout → Day 2 talks → logistics → reflections. */

export const FEEDBACK_STEP_LABELS = {
  1: "About you",
  2: "Day 1 — May 13",
  3: "Day 2 — Talks & speakers",
  4: "Overall & venue",
  5: "Reflections",
};

/** All rating keys in program order (must match backend EVENT_FEEDBACK_RATING_SCHEMA). */
export const FEEDBACK_RATING_KEYS = [
  "coffee_sessions",
  "welcome_dinner",
  "workshop_nicdao",
  "keynote_pages",
  "talk_dimaliuat",
  "talk_velasquez",
  "panel",
  "keynote_ledesma",
  "talk_nilo",
  "fellowship_night",
  "hotel_venue",
  "conference_proper",
];

export const FEEDBACK_RATING_LABELS = {
  coffee_sessions: "Day 1 Breakout Sessions",
  welcome_dinner: "Welcome Dinner",
  workshop_nicdao: "Eric Nicdao",
  keynote_pages: "Mr. Bunny Pages",
  talk_dimaliuat: "DJ Dimaliuat",
  talk_velasquez: "James Velasquez",
  panel: "Panel — Christine Dimaliuat & Abbie Villarosa",
  keynote_ledesma: "Ms. Anagel Ledesma",
  talk_nilo: "Nilo Matunog",
  fellowship_night: "Fellowship Night",
  hotel_venue: "Hotel & venue",
  conference_proper: "Conference proper (overall)",
};

/** UI sections: icons are lucide-react component names. */
export const FEEDBACK_RATING_SECTIONS = [
  {
    step: 2,
    title: "Day 1 — May 13",
    accent: "border-blue-600",
    items: [
      { key: "coffee_sessions", label: "Day 1 Breakout Sessions", icon: "Coffee" },
      { key: "welcome_dinner", label: "Welcome Dinner", icon: "UtensilsCrossed" },
    ],
  },
  {
    step: 3,
    title: "Day 2 — Talks & speakers (program order)",
    accent: "border-red-600",
    items: [
      {
        key: "workshop_nicdao",
        label: "Eric Nicdao",
        subtitle: "The Rise Begins: Aligning with the Current",
        icon: "Sparkles",
      },
      { key: "keynote_pages", label: "Mr. Bunny Pages", subtitle: "Keynote Speaker", icon: "Presentation" },
      {
        key: "talk_dimaliuat",
        label: "DJ Dimaliuat",
        subtitle: "Riding the Wave: Sustainable Success thru Leadership",
        icon: "Mic",
      },
      {
        key: "talk_velasquez",
        label: "James Velasquez",
        subtitle: "Product Bundling — The MDRT Way!",
        icon: "Mic2",
      },
      {
        key: "panel",
        label: "Panel discussion",
        subtitle: "Christine Dimaliuat & Abbie Villarosa · Facilitator: Emman Paras",
        icon: "Users2",
      },
      { key: "keynote_ledesma", label: "Ms. Anagel Ledesma", subtitle: "Keynote 2", icon: "Trophy" },
      { key: "talk_nilo", label: "Nilo Matunog", subtitle: "Optimizing AI for AIA", icon: "Tv" },
    ],
  },
  {
    step: 4,
    title: "Overall experience & logistics",
    accent: "border-violet-600",
    items: [
      { key: "fellowship_night", label: "Fellowship Night", icon: "Users2" },
      { key: "hotel_venue", label: "Hotel & venue", icon: "Hotel" },
      { key: "conference_proper", label: "Conference proper (overall)", icon: "Star" },
    ],
  },
];

export const SPEAKER_RATING_KEYS = [
  "workshop_nicdao",
  "keynote_pages",
  "talk_dimaliuat",
  "talk_velasquez",
  "panel",
  "keynote_ledesma",
  "talk_nilo",
];

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

export function ratingsForStep(schemaRatings, stepNum) {
  return (schemaRatings || []).filter((r) => r.step === stepNum);
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
