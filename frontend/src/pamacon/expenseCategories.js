/** Official PAMACON expense group headings (display order). */
export const EXPENSE_CATEGORY_GROUPS = [
  "Hotel and Banquet",
  "Conference Kits and Shirts",
  "Speakers and Guests",
  "Events Planning, Program and Tech",
  "Lights, Sounds, LED Wall",
  "Styling, Deco and venue set up",
  "Band and Entretainment",
  "Photo & Video Coverage",
  "Other Expenses",
  "Coordination Meetings",
  "Misc. Expenses",
];

export const DEFAULT_EXPENSE_CATEGORY = "Other Expenses";

/** Map legacy / alternate labels to the current group headings. */
const LEGACY_CATEGORY_ALIASES = {
  "accommodation & banquets": "Hotel and Banquet",
  "accommodation and banquets": "Hotel and Banquet",
  "hotel and banquet": "Hotel and Banquet",
  "speakers & talent": "Speakers and Guests",
  "speakers and talent": "Speakers and Guests",
  "speakers and guests": "Speakers and Guests",
  "lights and sounds": "Lights, Sounds, LED Wall",
  "lights & sounds": "Lights, Sounds, LED Wall",
  "lights, sounds, led wall": "Lights, Sounds, LED Wall",
  "led wall": "Lights, Sounds, LED Wall",
  decor: "Styling, Deco and venue set up",
  "decor & creative": "Styling, Deco and venue set up",
  "styling, deco and venue set up": "Styling, Deco and venue set up",
  "program materials": "Conference Kits and Shirts",
  supplies: "Conference Kits and Shirts",
  "conference kits and shirts": "Conference Kits and Shirts",
  "events planning, program and tech": "Events Planning, Program and Tech",
  "band/entertainment": "Band and Entretainment",
  "band and entertainment": "Band and Entretainment",
  "band and entretainment": "Band and Entretainment",
  "photo & video coverage": "Photo & Video Coverage",
  "photo and video coverage": "Photo & Video Coverage",
  miscellaneous: "Misc. Expenses",
  "misc. expenses": "Misc. Expenses",
  "misc expenses": "Misc. Expenses",
  others: "Other Expenses",
  "other expenses": "Other Expenses",
  general: "Other Expenses",
  uncategorized: "Other Expenses",
  "coordination meetings": "Coordination Meetings",
};

/**
 * Normalize stored category (+ optional vendor name heuristics) to a group heading.
 */
export function normalizeExpenseCategory(raw, company = "") {
  const trimmed = String(raw || "").trim();
  const lower = trimmed.toLowerCase();
  if (LEGACY_CATEGORY_ALIASES[lower]) return LEGACY_CATEGORY_ALIASES[lower];
  if (EXPENSE_CATEGORY_GROUPS.includes(trimmed)) return trimmed;

  const name = String(company || "").toLowerCase();
  if (name.includes("waterfront hotel") || name === "drinks" || name === "rooms") return "Hotel and Banquet";
  if (name.includes("speaker honorarium") || name.includes("tokens to speakers")) return "Speakers and Guests";
  if (name.includes("light") || name.includes("sound") || name.includes("led")) return "Lights, Sounds, LED Wall";
  if (name.includes("certificate") || name.includes("shirt") || name.includes("kit")) return "Conference Kits and Shirts";
  if (name.includes("graphic artist") || name.includes("deco") || name.includes("styling")) return "Styling, Deco and venue set up";
  if (name.includes("band") || name.includes("entertain")) return "Band and Entretainment";
  if (name.includes("photo") || name.includes("video")) return "Photo & Video Coverage";
  if (name.includes("coordination") || name.includes("meeting")) return "Coordination Meetings";
  if (name === "tip" || name.includes("misc")) return "Misc. Expenses";
  if (name.includes("supplies")) return "Conference Kits and Shirts";

  if (trimmed) return trimmed;
  return DEFAULT_EXPENSE_CATEGORY;
}

/** Group supplier/expense rows under official headings; unknown categories listed after the standard groups. */
export function groupExpensesByCategory(rows) {
  const buckets = new Map(EXPENSE_CATEGORY_GROUPS.map((g) => [g, []]));
  const extras = new Map();

  for (const row of rows || []) {
    const company = row.company ?? row.supplier ?? "";
    const category = normalizeExpenseCategory(row.category, company);
    const normalized = { ...row, category };
    if (buckets.has(category)) {
      buckets.get(category).push(normalized);
    } else if (!extras.has(category)) {
      extras.set(category, [normalized]);
    } else {
      extras.get(category).push(normalized);
    }
  }

  const groups = EXPENSE_CATEGORY_GROUPS.map((heading) => ({
    heading,
    items: buckets.get(heading) || [],
    total: (buckets.get(heading) || []).reduce((s, x) => s + (Number(x.amount) || 0), 0),
  }));

  for (const [heading, items] of extras) {
    groups.push({
      heading,
      items,
      total: items.reduce((s, x) => s + (Number(x.amount) || 0), 0),
    });
  }

  return groups;
}

/** Expense group for a payment voucher linked to a budget line. */
export function expenseGroupForLinkedExpense(expenseId, suppliers) {
  if (!expenseId) return "";
  const row = (suppliers || []).find((s) => s.id === expenseId);
  if (!row) return "";
  return normalizeExpenseCategory(row.category, row.company);
}

export function sortCategoryRows(rows) {
  const order = new Map(EXPENSE_CATEGORY_GROUPS.map((g, i) => [g, i]));
  return [...(rows || [])].sort((a, b) => {
    const ca = normalizeExpenseCategory(a.category, a.supplier ?? a.company);
    const cb = normalizeExpenseCategory(b.category, b.supplier ?? b.company);
    const ia = order.has(ca) ? order.get(ca) : 999;
    const ib = order.has(cb) ? order.get(cb) : 999;
    if (ia !== ib) return ia - ib;
    return String(a.supplier ?? a.company ?? "").localeCompare(String(b.supplier ?? b.company ?? ""));
  });
}
