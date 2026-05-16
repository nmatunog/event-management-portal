import { Hono } from "hono";
import type { Context } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { createRemoteJWKSet, jwtVerify } from "jose";

type Env = {
  APP_NAME: string;
  DB: D1Database;
  SUPABASE_JWKS_URL?: string;
  SUPABASE_ISSUER?: string;
  AUTH_DEV_FALLBACK?: string;
  SUPERUSER_EMAILS?: string;
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
};
type AppContext = {
  Bindings: Env;
  Variables: {
    authRole: Role;
    authUser: AuthUser;
  };
};

const app = new Hono<AppContext>();

app.use("/api/*", cors());

type Role = "admin" | "staff" | "attendee";
type AuthUser = { sub: string; role: Role; email?: string };

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function roleFromClaim(value: unknown): Role {
  if (value === "admin" || value === "staff" || value === "attendee") return value;
  return "attendee";
}

function parseCsvSet(value: string | undefined) {
  return new Set(
    String(value || "")
      .split(",")
      .map((x) => x.trim().toLowerCase())
      .filter(Boolean)
  );
}

async function lookupDbRoleOverride(c: Context<AppContext>, email: string | undefined): Promise<Role | null> {
  if (!email) return null;
  const row = await c.env.DB.prepare("SELECT role FROM user_roles WHERE email = ?")
    .bind(email.trim().toLowerCase())
    .first<{ role?: string }>();
  if (!row?.role) return null;
  return roleFromClaim(row.role);
}

function getOrCreateJwks(jwksUrl: string) {
  const existing = jwksCache.get(jwksUrl);
  if (existing) return existing;
  const created = createRemoteJWKSet(new URL(jwksUrl));
  jwksCache.set(jwksUrl, created);
  return created;
}

async function resolveAuthUser(c: Context<AppContext>): Promise<AuthUser | null> {
  const authHeader = c.req.header("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (token) {
    const jwksUrl = c.env.SUPABASE_JWKS_URL;
    if (!jwksUrl) throw new HTTPException(500, { message: "SUPABASE_JWKS_URL is not configured." });
    const jwks = getOrCreateJwks(jwksUrl);
    const issuer = c.env.SUPABASE_ISSUER;
    let verified: Awaited<ReturnType<typeof jwtVerify>>;
    try {
      verified = await jwtVerify(token, jwks, issuer ? { issuer } : undefined);
    } catch {
      return null;
    }
    const claims = verified.payload as Record<string, unknown> & { app_metadata?: { role?: string } };
    const email = claims.email ? String(claims.email) : undefined;
    const superusers = parseCsvSet(c.env.SUPERUSER_EMAILS);
    const isSuperuser = email ? superusers.has(email.toLowerCase()) : false;
    const dbRole = await lookupDbRoleOverride(c, email);
    const role = isSuperuser ? "admin" : dbRole ?? roleFromClaim(claims.app_metadata?.role ?? claims.role);
    return {
      sub: String(claims.sub ?? ""),
      role,
      email,
    };
  }

  if (c.env.AUTH_DEV_FALLBACK === "true") {
    const role = roleFromClaim(c.req.header("x-role"));
    return { sub: "dev-user", role };
  }

  return null;
}

function getRole(c: Context<AppContext>): Role {
  return roleFromClaim(c.get("authRole"));
}

function requireRole(allowed: Role[]) {
  return async (c: Context<AppContext>, next: () => Promise<void>) => {
    const authUser = await resolveAuthUser(c);
    if (!authUser) {
      throw new HTTPException(401, { message: "Unauthorized: missing or invalid token." });
    }
    c.set("authRole", authUser.role);
    c.set("authUser", authUser);
    const role = getRole(c);
    if (!allowed.includes(role)) {
      throw new HTTPException(403, { message: "Forbidden: insufficient role" });
    }
    await next();
  };
}

function assertAdminOnly(c: Context<AppContext>) {
  if (getRole(c) !== "admin") {
    throw new HTTPException(403, { message: "Forbidden: only admins can perform this action." });
  }
}

/** Email must appear in `SUPERUSER_EMAILS` (Worker env). */
function assertSuperuser(c: Context<AppContext>) {
  const email = String(c.get("authUser")?.email ?? "").trim().toLowerCase();
  const supers = parseCsvSet(c.env.SUPERUSER_EMAILS);
  if (!email || !supers.has(email)) {
    throw new HTTPException(403, { message: "Forbidden: only a configured superuser can delete payment vouchers." });
  }
}

function asNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** Philippines: attendees may change shirt on portal until start of 5 May 2026 (UTC+8). */
const PARTICIPANT_SHIRT_EDIT_DEADLINE_MS = Date.parse("2026-05-05T00:00:00+08:00");
function participantShirtEditOpen(now = Date.now()) {
  return now < PARTICIPANT_SHIRT_EDIT_DEADLINE_MS;
}

function parseMetadataJson(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === "object") return raw as Record<string, unknown>;
  try {
    return JSON.parse(String(raw)) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function normalizeName(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function toNameCase(raw: unknown) {
  const src = String(raw ?? "")
    .trim()
    .replace(/\s+/g, " ");
  if (!src) return "";
  return src
    .split(" ")
    .map((word) =>
      word
        .split("-")
        .map((part) => {
          const t = String(part || "").trim();
          if (!t) return "";
          const apos = t.split("'");
          return apos
            .map((chunk) => {
              const c = String(chunk || "").trim();
              if (!c) return "";
              return c.charAt(0).toUpperCase() + c.slice(1).toLowerCase();
            })
            .join("'");
        })
        .join("-")
    )
    .join(" ");
}

function isSeedSource(source: unknown) {
  const src = String(source || "").trim();
  return src === "pamacon-seed" || src === "pamacon-seed-ocr" || src === "pamacon-seed-text" || src === "pamacon-seed-manual";
}

const PAMACON_CHECK_IN_TIMEZONE = "Asia/Manila";
const PAMACON_VENUE_ARRIVAL_DATE = "2026-05-13";
const PAMACON_HALL_ENTRY_DATE = "2026-05-14";

function getManilaDateKey(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: PAMACON_CHECK_IN_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function getAutoCheckInPhaseForToday(now = new Date()) {
  const today = getManilaDateKey(now);
  if (today === PAMACON_HALL_ENTRY_DATE) return "hall-entry";
  if (today === PAMACON_VENUE_ARRIVAL_DATE) return "venue-arrival";
  return null;
}

function normalizeCheckInPhase(phase: unknown) {
  return String(phase || "").trim().toLowerCase() === "hall-entry" ? "hall-entry" : "venue-arrival";
}

function isPhaseCheckedIn(meta: Record<string, unknown>, phase: string, checkedInAt?: unknown) {
  if (normalizeCheckInPhase(phase) === "hall-entry") {
    return Boolean(String(meta.hallEntryCheckInAt || "").trim());
  }
  return Boolean(String(meta.venueArrivalCheckInAt || meta.onsiteRegisteredAt || checkedInAt || "").trim());
}

function applyClaimFlags(meta: Record<string, unknown>, body: Record<string, unknown>) {
  if (body.conferenceKitClaimed !== undefined) meta.conferenceKitClaimed = Boolean(body.conferenceKitClaimed);
  if (body.tshirtClaimed !== undefined) meta.tshirtClaimed = Boolean(body.tshirtClaimed);
}

function findSyncCandidate(
  rows: any[],
  email: string,
  opts: { seededRegistrationId?: string; seededDelegateName?: string; profile?: Record<string, unknown> }
) {
  const seededRegistrationId = String(opts.seededRegistrationId ?? "").trim();
  const seededDelegateName = String(opts.seededDelegateName ?? "").trim();
  const profile = opts.profile || {};
  const normalizedSeededName = normalizeName(seededDelegateName);
  const normalizedFirst = normalizeName(profile.firstName);
  const normalizedLast = normalizeName(profile.lastName);
  const normalizedNick = normalizeName(profile.nickname);
  return (
    rows.find((r) => String(r.id || "") === seededRegistrationId) ||
    rows.find((r) => {
      const meta = parseMetadataJson(r.metadata_json);
      return normalizeName(meta.attendeeClaimEmail) === email;
    }) ||
    rows.find((r) => normalizeName(r.full_name) === normalizedSeededName) ||
    rows.find((r) => {
      const full = normalizeName(r.full_name);
      if (!full || !normalizedLast) return false;
      const hasLast = full.endsWith(` ${normalizedLast}`) || full.includes(` ${normalizedLast} `);
      const hasFirst = normalizedFirst && (full.startsWith(`${normalizedFirst} `) || full.includes(` ${normalizedFirst} `));
      const hasNick = normalizedNick && (full.startsWith(`${normalizedNick} `) || full.includes(` ${normalizedNick} `));
      return hasLast && Boolean(hasFirst || hasNick);
    }) ||
    null
  );
}

/** Ratings in program order: Day 1 → Day 2 speakers → logistics. */
const EVENT_FEEDBACK_RATING_SCHEMA = [
  { key: "coffee_sessions", label: "Day 1 Breakout Sessions", step: 2, group: "day1" },
  { key: "welcome_dinner", label: "Welcome Dinner", step: 2, group: "day1" },
  { key: "workshop_nicdao", label: "Eric Nicdao", subtitle: "The Rise Begins: Aligning with the Current", step: 3, group: "speakers" },
  { key: "keynote_pages", label: "Mr. Bunny Pages", subtitle: "Keynote Speaker", step: 3, group: "speakers" },
  { key: "talk_dimaliuat", label: "DJ Dimaliuat", subtitle: "Riding the Wave: Sustainable Success thru Leadership", step: 3, group: "speakers" },
  { key: "talk_velasquez", label: "James Velasquez", subtitle: "Product Bundling — The MDRT Way!", step: 3, group: "speakers" },
  { key: "panel", label: "Panel — Christine Dimaliuat & Abbie Villarosa", subtitle: "Facilitator: Emman Paras", step: 3, group: "speakers" },
  { key: "keynote_ledesma", label: "Ms. Anagel Ledesma", subtitle: "Keynote 2", step: 3, group: "speakers" },
  { key: "talk_nilo", label: "Nilo Matunog", subtitle: "Optimizing AI for AIA", step: 3, group: "speakers" },
  { key: "fellowship_night", label: "Fellowship Night", step: 4, group: "logistics" },
  { key: "hotel_venue", label: "Hotel & venue", step: 4, group: "logistics" },
  { key: "conference_proper", label: "Conference proper (overall)", step: 4, group: "logistics" },
] as const;

const SPEAKER_FEEDBACK_KEYS = new Set(
  EVENT_FEEDBACK_RATING_SCHEMA.filter((r) => r.group === "speakers").map((r) => r.key)
);

const LEGACY_FEEDBACK_RATING_LABELS: Record<string, string> = {
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

const FEEDBACK_TEXT_FIELD_DEFS = [
  { key: "speakerImpact", label: "Which speaker impacted you the most and why?", step: 5, required: true, maxLength: 4000 },
  { key: "biggestTakeaway", label: "What is your biggest takeaway from the conference?", step: 5, required: true, maxLength: 4000 },
  { key: "likedMost", label: "What did you like the most about the conference this year?", step: 5, required: true, maxLength: 4000, column: "highlights" as const },
  {
    key: "suggestions",
    label: "Do you have any suggestions for us to improve in the next conferences?",
    step: 5,
    required: true,
    maxLength: 8000,
    column: "suggestions" as const,
  },
  { key: "testimonial", label: "Short testimonial of your experience at the conference", step: 5, required: true, maxLength: 4000 },
] as const;

const FEEDBACK_STOPWORDS = new Set(
  `a an the and or but if to of in on for with as at by from up out about into over after before under again further then once here there when where why how all any both each few more most other some such no nor not only own same so than too very can will just don should now ve re ll d m t s isn wasn weren doesn didn wasn had has have having be been being is am are was were do does did doing get got getting go went going make made making take took taking come came coming use used using would could should may might must shall per our your their they them we us you it its this that these those wasnt werent dont doesnt didnt im`.split(
    /\s+/
  )
);

function feedbackSchemaPayload(venue?: string | null) {
  const hotelVenue = String(venue || "").trim();
  const ratings = EVENT_FEEDBACK_RATING_SCHEMA.map((row) => ({
    key: row.key,
    label: row.key === "hotel_venue" && hotelVenue ? `Hotel & venue (${hotelVenue})` : row.label,
    subtitle: "subtitle" in row ? row.subtitle : undefined,
    step: row.step,
    group: row.group,
  }));
  return {
    formTitle: "PAMACON Conference Evaluation",
    formIntro:
      "Rate each session and speaker from the program (1 = dissatisfied, 5 = highly satisfied). Follows the official program flow: Day 1 breakout, Day 2 talks, then overall logistics.",
    steps: [
      { id: 1, label: "About you" },
      { id: 2, label: "Day 1 — May 13" },
      { id: 3, label: "Day 2 — Talks & speakers" },
      { id: 4, label: "Overall & venue" },
      { id: 5, label: "Reflections" },
    ],
    ratings,
    profileFields: [
      { key: "displayName", label: "Name (First Name Last Name)", step: 1, required: true, maxLength: 200 },
      { key: "agency", label: "Agency", step: 1, required: true, maxLength: 200 },
    ],
    textFields: FEEDBACK_TEXT_FIELD_DEFS.map(({ key, label, step, required, maxLength }) => ({
      key,
      label,
      step,
      required,
      maxLength,
    })),
  };
}

function feedbackLabelForKey(key: string) {
  const cur = EVENT_FEEDBACK_RATING_SCHEMA.find((r) => r.key === key);
  if (cur) return cur.label;
  return LEGACY_FEEDBACK_RATING_LABELS[key] ?? key;
}

function parseFeedbackScores(body: Record<string, unknown>) {
  const raw = body.scores;
  if (!raw || typeof raw !== "object") {
    throw new HTTPException(400, { message: "scores object is required." });
  }
  const src = raw as Record<string, unknown>;
  const out: Record<string, number> = {};
  for (const row of EVENT_FEEDBACK_RATING_SCHEMA) {
    const n = Math.round(Number(src[row.key]));
    if (!Number.isFinite(n) || n < 1 || n > 5) {
      throw new HTTPException(400, { message: `Each rating must be a whole number from 1 to 5 (${row.key}).` });
    }
    out[row.key] = n;
  }
  return out;
}

function parseFeedbackResponses(body: Record<string, unknown>) {
  const raw = body.responses;
  const src = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : body;
  const displayName = String(src.displayName ?? body.displayName ?? "").trim().slice(0, 200);
  const agency = String(src.agency ?? body.agency ?? "").trim().slice(0, 200);
  if (!displayName) throw new HTTPException(400, { message: "Name is required." });
  if (!agency) throw new HTTPException(400, { message: "Agency is required." });

  const speakerImpact = String(src.speakerImpact ?? body.speakerImpact ?? "").trim().slice(0, 4000);
  const biggestTakeaway = String(src.biggestTakeaway ?? body.biggestTakeaway ?? "").trim().slice(0, 4000);
  const testimonial = String(src.testimonial ?? body.testimonial ?? "").trim().slice(0, 4000);
  const likedMost = String(src.likedMost ?? body.likedMost ?? body.highlights ?? "").trim().slice(0, 4000);
  const suggestions = String(src.suggestions ?? body.suggestions ?? "").trim().slice(0, 8000);

  if (!speakerImpact) throw new HTTPException(400, { message: "Speaker impact response is required." });
  if (!biggestTakeaway) throw new HTTPException(400, { message: "Biggest takeaway is required." });
  if (!likedMost) throw new HTTPException(400, { message: "What you liked most is required." });
  if (!suggestions) throw new HTTPException(400, { message: "Suggestions for improvement are required." });
  if (!testimonial) throw new HTTPException(400, { message: "Testimonial is required." });

  return {
    displayName,
    agency,
    speakerImpact,
    biggestTakeaway,
    testimonial,
    likedMost,
    suggestions,
  };
}

function parseStoredFeedbackResponses(row: Record<string, unknown>) {
  const fromJson = parseMetadataJson(row.responses_json);
  return {
    displayName: String(fromJson.displayName ?? ""),
    agency: String(fromJson.agency ?? ""),
    speakerImpact: String(fromJson.speakerImpact ?? ""),
    biggestTakeaway: String(fromJson.biggestTakeaway ?? ""),
    testimonial: String(fromJson.testimonial ?? ""),
  };
}

function tokenizeFeedbackText(text: string) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, " ")
    .split(/\s+/)
    .map((w) => w.replace(/^'+|'+$/g, ""))
    .filter((w) => w.length > 2 && !FEEDBACK_STOPWORDS.has(w));
}

function topFeedbackKeywords(texts: string[], limit: number) {
  const freq = new Map<string, number>();
  for (const block of texts) {
    const seen = new Set<string>();
    for (const w of tokenizeFeedbackText(block)) {
      if (seen.has(w)) continue;
      seen.add(w);
      freq.set(w, (freq.get(w) || 0) + 1);
    }
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word, count]) => ({ word, count }));
}

function buildFeedbackSuggestionInsights(
  responseCount: number,
  rows: {
    scores: Record<string, number>;
    suggestions: string;
    highlights: string;
    speakerImpact?: string;
    biggestTakeaway?: string;
    testimonial?: string;
  }[]
) {
  if (responseCount < 40) {
    return {
      unlocked: false,
      responseCount,
      nextMilestone: 40,
      message: "Thematic summaries and priority hints unlock automatically once there are at least 40 submitted feedback responses.",
    };
  }
  const combinedTexts: string[] = [];
  for (const r of rows) {
    for (const t of [r.suggestions, r.highlights, r.speakerImpact, r.biggestTakeaway, r.testimonial]) {
      const s = String(t || "").trim();
      if (s) combinedTexts.push(s);
    }
  }
  const topKeywords = topFeedbackKeywords(combinedTexts, 12);

  const dimTotals = new Map<string, { sum: number; n: number }>();
  for (const row of EVENT_FEEDBACK_RATING_SCHEMA) {
    dimTotals.set(row.key, { sum: 0, n: 0 });
  }
  for (const r of rows) {
    for (const [key, v0] of Object.entries(r.scores)) {
      const v = Math.round(Number(v0));
      if (!Number.isFinite(v) || v < 1 || v > 5) continue;
      if (!dimTotals.has(key)) dimTotals.set(key, { sum: 0, n: 0 });
      const cur = dimTotals.get(key)!;
      cur.sum += v;
      cur.n += 1;
    }
  }
  const dimAvgs = [...dimTotals.entries()]
    .map(([key, { sum, n }]) => ({
      key,
      label: feedbackLabelForKey(key),
      avg: n ? sum / n : 0,
      n,
    }))
    .sort((a, b) => a.avg - b.avg);

  const weakest = dimAvgs.slice(0, 4).filter((d) => d.n > 0);

  const keywordBoost = new Map<string, string[]>([
    ["coffee", ["coffee_sessions"]],
    ["dinner", ["welcome_dinner", "fellowship_night"]],
    ["fellowship", ["fellowship_night"]],
    ["welcome", ["welcome_dinner"]],
    ["hotel", ["hotel_venue"]],
    ["room", ["hotel_venue"]],
    ["venue", ["hotel_venue"]],
    ["speaker", ["conference_proper", "talk_nilo", "keynote_pages"]],
    ["nicdao", ["workshop_nicdao"]],
    ["pages", ["keynote_pages"]],
    ["dimaliuat", ["talk_dimaliuat", "panel"]],
    ["velasquez", ["talk_velasquez"]],
    ["panel", ["panel"]],
    ["ledesma", ["keynote_ledesma"]],
    ["nilo", ["talk_nilo"]],
    ["ai", ["talk_nilo"]],
    ["session", ["coffee_sessions", "conference_proper"]],
    ["conference", ["conference_proper"]],
    ["program", ["conference_proper"]],
  ]);

  const boostedKeys = new Set<string>();
  for (const { word } of topKeywords.slice(0, 6)) {
    for (const [needle, keys] of keywordBoost.entries()) {
      if (word.includes(needle)) {
        keys.forEach((k) => boostedKeys.add(k));
      }
    }
  }

  const priorityActions: { rank: number; title: string; rationale: string }[] = [];
  let rank = 1;
  for (const d of weakest.slice(0, 3)) {
    priorityActions.push({
      rank: rank++,
      title: `Strengthen ${d.label.split("(")[0].trim()}`,
      rationale: `Average ${d.avg.toFixed(2)} / 5 across ${responseCount} responses — one of the lowest-rated areas.`,
    });
  }
  for (const key of boostedKeys) {
    const hit = dimAvgs.find((d) => d.key === key);
    if (!hit) continue;
    if (priorityActions.some((p) => p.title.includes(hit.label.slice(0, 18)))) continue;
    priorityActions.push({
      rank: rank++,
      title: `Validate ${hit.label.split("(")[0].trim()} against written comments`,
      rationale: `Delegates repeatedly used words related to this area in open feedback.`,
    });
    if (priorityActions.length >= 6) break;
  }
  if (topKeywords.length && priorityActions.length < 6) {
    const k = topKeywords.slice(0, 3).map((x) => x.word);
    priorityActions.push({
      rank: rank++,
      title: "Thematic review of open-ended comments",
      rationale: `Recurring words include: ${k.join(", ")}. Use these as prompts for a short leadership debrief.`,
    });
  }

  const summaryLines: string[] = [];
  if (topKeywords.length) {
    summaryLines.push(
      `Most-mentioned themes in written feedback: ${topKeywords
        .slice(0, 5)
        .map((t) => `${t.word} (${t.count})`)
        .join(", ")}.`
    );
  }
  if (weakest.length) {
    summaryLines.push(
      `Lowest-rated areas on the numeric survey: ${weakest
        .slice(0, 3)
        .map((d) => `${d.label.split("(")[0].trim()} (${d.avg.toFixed(2)}/5)`)
        .join("; ")}.`
    );
  }

  return {
    unlocked: true,
    responseCount,
    summaryLines,
    topKeywords,
    weakestDimensions: weakest,
    priorityActions: priorityActions.slice(0, 6),
  };
}

type FeedbackAverageRow = {
  key: string;
  label: string;
  average: number;
  count: number;
  legacy?: boolean;
};

function buildFeedbackExecutiveSummary(
  averages: FeedbackAverageRow[],
  responseCount: number,
  overallAverage: number
) {
  const current = averages.filter((a) => !a.legacy && a.count > 0);
  const sum = current.reduce((s, a) => s + a.average, 0);
  const composite = current.length ? Math.round((sum / current.length) * 100) / 100 : overallAverage;
  const sorted = [...current].sort((a, b) => b.average - a.average);
  const logisticsKeys = new Set(["hotel_venue", "fellowship_night", "conference_proper"]);
  const speakerKeys = SPEAKER_FEEDBACK_KEYS;
  const logistics = current.filter((a) => logisticsKeys.has(a.key));
  const speakers = current.filter((a) => speakerKeys.has(a.key));
  const experience = current.filter((a) => !logisticsKeys.has(a.key) && !speakerKeys.has(a.key));
  const avgGroup = (arr: FeedbackAverageRow[]) =>
    arr.length ? Math.round((arr.reduce((s, a) => s + a.average, 0) / arr.length) * 100) / 100 : 0;
  return {
    responseCount,
    compositeSatisfaction: composite,
    logisticsAverage: avgGroup(logistics),
    speakersAverage: avgGroup(speakers),
    experienceAverage: avgGroup(experience),
    conferenceProperAverage: overallAverage,
    strongest: sorted[0] ? { label: sorted[0].label, average: sorted[0].average } : null,
    weakest: sorted.length ? { label: sorted[sorted.length - 1].label, average: sorted[sorted.length - 1].average } : null,
  };
}

function buildPamaconYearAheadPlan(
  eventTitle: string,
  executiveSummary: ReturnType<typeof buildFeedbackExecutiveSummary>,
  suggestionInsights: ReturnType<typeof buildFeedbackSuggestionInsights>,
  speakerSnippets: string[]
) {
  const strengths: string[] = [];
  const improvements: string[] = [];
  if (executiveSummary.strongest) {
    strengths.push(`${executiveSummary.strongest.label} rated highest (${executiveSummary.strongest.average.toFixed(2)}/5).`);
  }
  if (executiveSummary.experienceAverage >= 4) {
    strengths.push(`Core conference experiences average ${executiveSummary.experienceAverage.toFixed(2)}/5 across ${executiveSummary.responseCount} delegates.`);
  }
  if (executiveSummary.weakest) {
    improvements.push(`Focus planning on ${executiveSummary.weakest.label} (${executiveSummary.weakest.average.toFixed(2)}/5).`);
  }
  if (executiveSummary.logisticsAverage > 0 && executiveSummary.logisticsAverage < 4) {
    improvements.push(`Venue and logistics scored ${executiveSummary.logisticsAverage.toFixed(2)}/5 — review hotel, F&B, and on-site coordination.`);
  }
  if (suggestionInsights.unlocked && suggestionInsights.summaryLines?.length) {
    for (const line of suggestionInsights.summaryLines.slice(0, 2)) strengths.push(line);
  }
  if (speakerSnippets.length) {
    strengths.push(`Delegates highlighted speakers in open responses (e.g. “${speakerSnippets[0].slice(0, 80)}…”).`);
  }

  const themeSuggestion =
    executiveSummary.compositeSatisfaction >= 4.2
      ? "Elevate what worked — deepen delegate engagement and showcase success stories from this year."
      : "Rebuild the delegate journey — tighten program flow, logistics, and communication from registration through fellowship night.";

  const actionItems: { rank: number; title: string; rationale: string; horizon: string }[] = [];
  let rank = 1;
  if (suggestionInsights.unlocked && suggestionInsights.priorityActions?.length) {
    for (const a of suggestionInsights.priorityActions.slice(0, 5)) {
      actionItems.push({
        rank: rank++,
        title: a.title,
        rationale: a.rationale,
        horizon: "next_pamacon",
      });
    }
  } else {
    actionItems.push({
      rank: 1,
      title: "Complete debrief once 40+ surveys are in",
      rationale: "Priority themes and keyword analysis unlock at 40 responses for richer planning input.",
      horizon: "next_pamacon",
    });
    if (executiveSummary.weakest) {
      actionItems.push({
        rank: 2,
        title: `Early workstream: ${executiveSummary.weakest.label.split("(")[0].trim()}`,
        rationale: `Currently the lowest-rated survey dimension at ${executiveSummary.weakest.average.toFixed(2)}/5.`,
        horizon: "next_pamacon",
      });
    }
  }
  actionItems.push({
    rank: rank++,
    title: "Publish evaluation link early in the closing session",
    rationale: "Maximize response rate while memories are fresh — link: /evaluation on the delegate portal.",
    horizon: "next_pamacon",
  });

  const narrative = [
    `# PAMACON planning insights — ${eventTitle}`,
    "",
    "## Executive snapshot",
    `- ${executiveSummary.responseCount} delegate responses`,
    `- Composite satisfaction: ${executiveSummary.compositeSatisfaction.toFixed(2)} / 5`,
    `- Conference proper: ${executiveSummary.conferenceProperAverage.toFixed(2)} / 5`,
    "",
    "## Suggested theme direction",
    themeSuggestion,
    "",
    "## Strengths",
    ...strengths.map((s) => `- ${s}`),
    "",
    "## Improvements",
    ...(improvements.length ? improvements.map((s) => `- ${s}`) : ["- Collect more responses for deeper qualitative themes."]),
    "",
    "## Action items for next PAMACON",
    ...actionItems.map((a) => `${a.rank}. **${a.title}** — ${a.rationale}`),
  ].join("\n");

  return { themeSuggestion, strengths, improvements, actionItems, narrative };
}

function parseActionItemsFromAiReport(report: string) {
  const items: { rank: number; title: string; rationale: string; horizon: string }[] = [];
  const lines = report.split(/\n/);
  for (const line of lines) {
    const m = line.match(/^\s*(\d+)[.)]\s*\*?\*?([^*]+?)\*?\*?\s*[—–-]\s*(.+)$/);
    if (m) {
      items.push({
        rank: Number(m[1]),
        title: m[2].trim(),
        rationale: m[3].trim(),
        horizon: "next_pamacon",
      });
    }
  }
  return items.slice(0, 8);
}

async function callGeminiFeedbackStrategy(
  apiKey: string,
  model: string,
  prompt: string,
  retryCount = 0
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 2048 },
    }),
  });
  if (!response.ok) {
    if (retryCount < 3 && (response.status === 429 || response.status >= 500)) {
      await new Promise((r) => setTimeout(r, Math.pow(2, retryCount) * 1000));
      return callGeminiFeedbackStrategy(apiKey, model, prompt, retryCount + 1);
    }
    throw new Error(`Gemini API error (${response.status})`);
  }
  const result = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) throw new Error("Empty Gemini response.");
  return text;
}

function buildFeedbackAiPrompt(
  eventTitle: string,
  executiveSummary: ReturnType<typeof buildFeedbackExecutiveSummary>,
  averages: FeedbackAverageRow[],
  suggestionInsights: ReturnType<typeof buildFeedbackSuggestionInsights>,
  recentSuggestions: string[],
  recentTestimonials: string[]
) {
  const ratingLines = averages
    .filter((a) => a.count > 0 && !a.legacy)
    .map((a) => `- ${a.label}: ${a.average.toFixed(2)}/5 (n=${a.count})`)
    .join("\n");
  const comments = [...recentSuggestions.slice(0, 8), ...recentTestimonials.slice(0, 5)].join(" | ");
  const priorityHint = suggestionInsights.unlocked
    ? `Priority hints: ${(suggestionInsights.priorityActions || []).map((p) => p.title).join("; ")}`
    : "Fewer than 40 responses — note limited statistical confidence.";

  return `You are an expert convention analyst for AIA PAMA Conference (PAMACON).

Review delegate feedback for "${eventTitle}" and produce a planning report for the NEXT year's PAMACON.

Survey data:
- Responses: ${executiveSummary.responseCount}
- Composite satisfaction: ${executiveSummary.compositeSatisfaction.toFixed(2)}/5
- Conference proper: ${executiveSummary.conferenceProperAverage.toFixed(2)}/5
- Experience average: ${executiveSummary.experienceAverage.toFixed(2)}/5
- Logistics (hotel/venue): ${executiveSummary.logisticsAverage.toFixed(2)}/5

Ratings by dimension:
${ratingLines}

${priorityHint}

Sample written feedback: ${comments || "(none yet)"}

Format your response in English with these sections:
## Executive Summary
## Strengths
## Areas for Improvement
## Suggested Theme for Next PAMACON
## Recommended Action Items for Next PAMACON

For action items use numbered lines like:
1. **Title** — One sentence rationale focused on next year's conference planning.

Be specific, professional, and concise.`;
}

function mapFeedbackRow(row: Record<string, unknown> | null | undefined) {
  if (!row?.id) return null;
  const responses = parseStoredFeedbackResponses(row);
  return {
    id: row.id,
    scores: parseMetadataJson(row.scores_json) as Record<string, number>,
    responses,
    likedMost: String(row.highlights ?? ""),
    highlights: String(row.highlights ?? ""),
    suggestions: String(row.suggestions ?? ""),
    updatedAt: row.updated_at,
    createdAt: row.created_at,
  };
}

function statusRank(value: unknown) {
  const s = String(value || "").trim().toLowerCase();
  if (s === "checked-in") return 3;
  if (s === "registered") return 2;
  if (s === "pre-registered") return 1;
  return 0;
}

function statusByRank(rank: number) {
  if (rank >= 3) return "checked-in";
  if (rank >= 2) return "registered";
  if (rank >= 1) return "pre-registered";
  return "pre-registered";
}

app.get("/api/auth/me", async (c) => {
  const authUser = await resolveAuthUser(c);
  if (!authUser) {
    throw new HTTPException(401, { message: "Unauthorized: missing or invalid token." });
  }
  return c.json({ user: authUser });
});

app.get("/api/admin/user-roles", requireRole(["admin"]), async (c) => {
  const res = await c.env.DB.prepare("SELECT email, role, created_at, updated_at FROM user_roles ORDER BY email ASC").all();
  return c.json({ items: res.results });
});

function assertSuperuserRoleManager(c: Context<AppContext>) {
  const supers = parseCsvSet(c.env.SUPERUSER_EMAILS);
  const actor = String(c.get("authUser")?.email ?? "").trim().toLowerCase();
  if (!actor) throw new HTTPException(403, { message: "Forbidden: signed-in email required to manage roles." });
  if (supers.size === 0) {
    throw new HTTPException(403, {
      message: "Forbidden: configure SUPERUSER_EMAILS on the worker to allow role assignments.",
    });
  }
  if (!supers.has(actor)) {
    throw new HTTPException(403, { message: "Forbidden: only a configured superuser can assign Admin or Working Team roles." });
  }
}

app.put("/api/admin/user-roles", requireRole(["admin"]), async (c) => {
  assertSuperuserRoleManager(c);
  const body = await c.req.json();
  const email = String(body.email ?? "").trim().toLowerCase();
  const role = roleFromClaim(body.role);
  if (!email) throw new HTTPException(400, { message: "Email is required." });
  await c.env.DB.prepare(
    `INSERT INTO user_roles (email, role, created_at, updated_at)
     VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT(email) DO UPDATE SET role=excluded.role, updated_at=CURRENT_TIMESTAMP`
  )
    .bind(email, role)
    .run();
  const item = await c.env.DB.prepare("SELECT email, role, created_at, updated_at FROM user_roles WHERE email = ?").bind(email).first();
  return c.json({ item });
});

app.delete("/api/admin/user-roles/:email", requireRole(["admin"]), async (c) => {
  assertSuperuserRoleManager(c);
  const email = String(c.req.param("email") ?? "").trim().toLowerCase();
  if (!email) throw new HTTPException(400, { message: "Email is required." });
  await c.env.DB.prepare("DELETE FROM user_roles WHERE email = ?").bind(email).run();
  return c.json({ ok: true });
});

app.get("/api/health", (c) => {
  return c.json({
    ok: true,
    service: c.env.APP_NAME ?? "Event Management API",
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/events", (c) => {
  return c.env.DB.prepare("SELECT * FROM events ORDER BY created_at DESC")
    .all()
    .then((res) => c.json({ items: res.results }));
});

app.post("/api/events", requireRole(["admin", "staff"]), async (c) => {
  const body = await c.req.json();
  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    "INSERT INTO events (id, title, venue, start_date, end_date, organizer, attendee_goal, budget_goal, config_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  )
    .bind(
      id,
      body.title ?? "Untitled Event",
      body.venue ?? "TBA",
      body.startDate ?? null,
      body.endDate ?? null,
      body.organizer ?? "VibeEvent Global",
      asNumber(body.attendeeGoal, 0),
      asNumber(body.budgetGoal, 0),
      JSON.stringify(body.config ?? {})
    )
    .run();

  const event = await c.env.DB.prepare("SELECT * FROM events WHERE id = ?").bind(id).first();
  return c.json({ item: event }, 201);
});

app.patch("/api/events/:id", requireRole(["admin", "staff"]), async (c) => {
  const id = c.req.param("id");
  let body: Record<string, unknown>;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ message: "Invalid JSON body." }, 400);
  }

  let configJson: string | null = null;
  if (body.config !== undefined && body.config !== null) {
    try {
      configJson = JSON.stringify(body.config);
    } catch {
      return c.json({ message: "Configuration contains values that cannot be serialized to JSON." }, 400);
    }
    const configBytes = new TextEncoder().encode(configJson).length;
    if (configBytes > 1_950_000) {
      return c.json(
        {
          message:
            "Configuration is too large to store (over ~2MB). Remove large embedded images from posters or the reference list screenshot, or use hosted image URLs instead.",
        },
        413
      );
    }
  }

  try {
    await c.env.DB.prepare(
      `UPDATE events
     SET title = COALESCE(?, title),
         venue = COALESCE(?, venue),
         start_date = COALESCE(?, start_date),
         end_date = COALESCE(?, end_date),
         organizer = COALESCE(?, organizer),
         attendee_goal = COALESCE(?, attendee_goal),
         budget_goal = COALESCE(?, budget_goal),
         config_json = COALESCE(?, config_json),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
    )
      .bind(
        body.title ?? null,
        body.venue ?? null,
        body.startDate ?? null,
        body.endDate ?? null,
        body.organizer ?? null,
        body.attendeeGoal != null ? asNumber(body.attendeeGoal, 0) : null,
        body.budgetGoal != null ? asNumber(body.budgetGoal, 0) : null,
        configJson,
        id
      )
      .run();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const tooLarge =
      /too large|maximum|exceeds|100[,\s]?000|1,?000,?000|row size|statement/i.test(msg) || /D1_ERROR/i.test(msg);
    return c.json(
      {
        message: tooLarge
          ? `The database rejected this save (payload likely too large for D1 limits). Remove or shrink embedded images in Setup (posters) or the delegates reference screenshot, then try again. Detail: ${msg}`
          : msg,
      },
      tooLarge ? 413 : 500
    );
  }

  const event = await c.env.DB.prepare("SELECT * FROM events WHERE id = ?").bind(id).first();
  return c.json({ item: event });
});

app.delete("/api/events/:id", requireRole(["admin"]), async (c) => {
  const id = c.req.param("id");
  await c.env.DB.prepare("DELETE FROM events WHERE id = ?").bind(id).run();
  return c.json({ ok: true });
});

app.get("/api/events/:eventId/registrations", async (c) => {
  const eventId = c.req.param("eventId");
  const res = await c.env.DB.prepare("SELECT * FROM registrations WHERE event_id = ? ORDER BY created_at DESC").bind(eventId).all();
  return c.json({ items: res.results });
});

app.post("/api/registrations/:id/claim-seeded", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const email = String(body?.email ?? "").trim().toLowerCase();
  const mobileNumber = String(body?.mobileNumber ?? "").trim();
  if (!email) throw new HTTPException(400, { message: "Email is required." });

  const existing = await c.env.DB.prepare("SELECT id, full_name, metadata_json FROM registrations WHERE id = ?").bind(id).first<Record<string, unknown>>();
  if (!existing) throw new HTTPException(404, { message: "Registration not found." });

  let meta: Record<string, unknown> = {};
  try {
    meta = existing.metadata_json ? (JSON.parse(String(existing.metadata_json)) as Record<string, unknown>) : {};
  } catch {
    meta = {};
  }

  const claimedBy = String(meta.attendeeClaimEmail || "").trim().toLowerCase();
  const providedSeededName = String(body?.seededDelegateName ?? "").trim().toLowerCase();
  const rowName = String(existing.full_name || "").trim().toLowerCase();
  const seedSrc = String(meta.seedSource || "").trim();
  const isSeedFlagged =
    seedSrc === "pamacon-seed" ||
    seedSrc === "pamacon-seed-ocr" ||
    seedSrc === "pamacon-seed-text" ||
    seedSrc === "pamacon-seed-manual";
  const isNameMatchedSeed = Boolean(providedSeededName && rowName && providedSeededName === rowName);
  const isAlreadyClaimedBySameAttendee = Boolean(claimedBy && claimedBy === email);
  if (!isSeedFlagged && !isNameMatchedSeed && !isAlreadyClaimedBySameAttendee) {
    throw new HTTPException(400, { message: "Only seeded delegates can be claimed through this flow." });
  }

  if (claimedBy && claimedBy !== email) {
    throw new HTTPException(409, { message: "This seeded delegate has already been claimed." });
  }

  const nextMeta: Record<string, unknown> = {
    ...meta,
    attendeeClaimEmail: email,
    attendeeClaimedAt: new Date().toISOString(),
    attendeeClaimMobile: mobileNumber || String(meta.attendeeClaimMobile || ""),
  };
  let nextAttendeeType: string | null = null;
  let nextFullName: string | null = null;
  const profile = body?.attendeeProfile;
  if (profile && typeof profile === "object") {
    const p = profile as Record<string, unknown>;
    const applyText = (key: string) => {
      if (p[key] === undefined || p[key] === null) return;
      nextMeta[key] = String(p[key]).trim();
    };
    applyText("firstName");
    applyText("nickname");
    applyText("aiaAgentCode");
    applyText("lastName");
    applyText("middleName");
    applyText("positionCode");
    applyText("positionOther");
    applyText("gender");
    if (participantShirtEditOpen()) {
      applyText("shirtSize");
      applyText("shirtSizeOther");
    }
    applyText("arrivalCebu");
    applyText("departureCebu");
    applyText("extraOtherRequest");
    applyText("activityPaymentMethod");
    applyText("activityPaymentReference");
    applyText("activityPaymentAmount");
    applyText("activityPaymentSenderNumber");
    applyText("activityPaymentProofScreenshotDataUrl");
    applyText("activityPaymentProofUploadedAt");
    applyText("activityPaymentConfirmedAt");
    applyText("activityPaymentStatus");
    applyText("paymentProofScreenshotDataUrl");
    applyText("paymentProofUploadedAt");
    if (p.age !== undefined && p.age !== null) nextMeta.age = String(p.age).trim();
    if (p.extraIslandHopping !== undefined) nextMeta.extraIslandHopping = Boolean(p.extraIslandHopping);
    if (p.extraCityTour !== undefined) nextMeta.extraCityTour = Boolean(p.extraCityTour);
    if (p.extraMountainTour !== undefined) nextMeta.extraMountainTour = Boolean(p.extraMountainTour);
    if (p.extraSafari !== undefined) nextMeta.extraSafari = Boolean(p.extraSafari);
    if (p.activityRegistrationConfirmed !== undefined) nextMeta.activityRegistrationConfirmed = Boolean(p.activityRegistrationConfirmed);
    if (p.mobileNumber !== undefined && p.mobileNumber !== null) {
      const mobile = String(p.mobileNumber).trim();
      nextMeta.mobileNumber = mobile;
      nextMeta.attendeeClaimMobile = mobile || String(nextMeta.attendeeClaimMobile || "");
    }
    const positionCode = String(p.positionCode ?? "").trim().toUpperCase();
    if (positionCode) nextAttendeeType = positionCode;
    const firstName = String(p.firstName ?? "").trim();
    const middleName = String(p.middleName ?? "").trim();
    const lastName = String(p.lastName ?? "").trim();
    const joined = [firstName, middleName, lastName].filter(Boolean).join(" ").trim();
    if (joined) nextFullName = toNameCase(joined);
  }

  await c.env.DB.prepare("UPDATE registrations SET metadata_json = ?, attendee_type = COALESCE(?, attendee_type), full_name = COALESCE(?, full_name), updated_at = CURRENT_TIMESTAMP WHERE id = ?")
      .bind(JSON.stringify(nextMeta), nextAttendeeType, nextFullName ? toNameCase(nextFullName) : null, id)
    .run();
  const item = await c.env.DB.prepare("SELECT * FROM registrations WHERE id = ?").bind(id).first();
  return c.json({ item });
});

app.get("/api/events/:eventId/registrations/my-row-summary", requireRole(["admin", "staff", "attendee"]), async (c) => {
  const eventId = c.req.param("eventId");
  const actor = c.get("authUser");
  const email = String(actor?.email || "").trim().toLowerCase();
  if (!email) throw new HTTPException(400, { message: "Signed-in email is required." });
  const qs = c.req.query();
  const seededRegistrationId = String(qs.seededRegistrationId ?? "").trim();
  const seededDelegateName = String(qs.seededDelegateName ?? "").trim();
  const profile = {
    firstName: String(qs.firstName ?? "").trim(),
    lastName: String(qs.lastName ?? "").trim(),
    nickname: String(qs.nickname ?? "").trim(),
  };
  const rowsRes = await c.env.DB.prepare("SELECT * FROM registrations WHERE event_id = ? ORDER BY created_at ASC").bind(eventId).all<any>();
  const rows = (rowsRes.results || []) as any[];
  const candidate = findSyncCandidate(rows, email, { seededRegistrationId, seededDelegateName, profile });
  const meta = candidate ? parseMetadataJson(candidate.metadata_json) : {};
  const isSeededRegistration = candidate ? isSeedSource(meta.seedSource) : false;
  const proof = String(meta.paymentProofScreenshotDataUrl ?? "").trim();
  const paymentValidated = String(meta.paymentValidationStatus ?? "").toLowerCase() === "validated";
  return c.json({
    hasRegistration: Boolean(candidate?.id),
    isSeededRegistration,
    paymentValidated,
    hasPaymentProof: Boolean(proof),
    /** Conference fee proof is optional; attendees can save profile and use tours without it. */
    requiresPaymentProofUpload: false,
  });
});

app.get("/api/events/:eventId/registrations/my-check-in", requireRole(["admin", "staff", "attendee"]), async (c) => {
  const eventId = c.req.param("eventId");
  const email = String(c.get("authUser")?.email || "").trim().toLowerCase();
  if (!email) throw new HTTPException(400, { message: "Signed-in email is required." });
  const qs = c.req.query();
  const profile = {
    firstName: String(qs.firstName ?? "").trim(),
    lastName: String(qs.lastName ?? "").trim(),
    nickname: String(qs.nickname ?? "").trim(),
  };
  const seededRegistrationId = String(qs.seededRegistrationId ?? "").trim();
  const seededDelegateName = String(qs.seededDelegateName ?? "").trim();
  const rowsRes = await c.env.DB.prepare("SELECT * FROM registrations WHERE event_id = ? ORDER BY created_at ASC").bind(eventId).all<any>();
  const candidate = findSyncCandidate((rowsRes.results || []) as any[], email, { seededRegistrationId, seededDelegateName, profile });
  const autoPhase = getAutoCheckInPhaseForToday();
  const checkInPhase = autoPhase || "venue-arrival";
  if (!candidate?.id) {
    return c.json({
      hasRegistration: false,
      autoPhase,
      checkInPhase,
      venueCheckedIn: false,
      hallCheckedIn: false,
      item: null,
    });
  }
  const meta = parseMetadataJson(candidate.metadata_json);
  return c.json({
    hasRegistration: true,
    autoPhase,
    checkInPhase,
    venueCheckedIn: isPhaseCheckedIn(meta, "venue-arrival", candidate.checked_in_at),
    hallCheckedIn: isPhaseCheckedIn(meta, "hall-entry"),
    item: candidate,
  });
});

app.post("/api/events/:eventId/registrations/self-check-in", requireRole(["admin", "staff", "attendee"]), async (c) => {
  const eventId = c.req.param("eventId");
  const email = String(c.get("authUser")?.email || "").trim().toLowerCase();
  if (!email) throw new HTTPException(400, { message: "Signed-in email is required." });
  const body = await c.req.json();
  const profile = body?.profile && typeof body.profile === "object" ? (body.profile as Record<string, unknown>) : {};
  const rowsRes = await c.env.DB.prepare("SELECT * FROM registrations WHERE event_id = ? ORDER BY created_at ASC").bind(eventId).all<any>();
  const candidate = findSyncCandidate((rowsRes.results || []) as any[], email, {
    seededRegistrationId: String(body?.seededRegistrationId ?? "").trim(),
    seededDelegateName: String(body?.seededDelegateName ?? "").trim(),
    profile,
  });
  if (!candidate?.id) throw new HTTPException(404, { message: "No matching registration for this account." });
  const autoPhase = getAutoCheckInPhaseForToday();
  if (!autoPhase) throw new HTTPException(403, { message: "Self check-in opens on May 13 and May 14 only." });
  const phase = normalizeCheckInPhase(body?.checkInPhase || autoPhase);
  if (phase !== autoPhase) throw new HTTPException(403, { message: "This check-in window is not open today." });
  const meta = parseMetadataJson(candidate.metadata_json);
  applyClaimFlags(meta, body && typeof body === "object" ? body : {});
  if (isPhaseCheckedIn(meta, phase, candidate.checked_in_at)) {
    await c.env.DB.prepare("UPDATE registrations SET metadata_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
      .bind(JSON.stringify(meta), candidate.id)
      .run();
    const item = await c.env.DB.prepare("SELECT * FROM registrations WHERE id = ?").bind(candidate.id).first();
    return c.json({ item, alreadyCheckedIn: true });
  }
  const nowIso = new Date().toISOString();
  if (phase === "hall-entry") {
    meta.hallEntryCheckInAt = nowIso;
    meta.hallEntryCheckInBy = email;
    await c.env.DB.prepare("UPDATE registrations SET metadata_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
      .bind(JSON.stringify(meta), candidate.id)
      .run();
  } else {
    const positionCode = String(body?.positionCode ?? meta.positionCode ?? candidate.attendee_type ?? "UM").trim().toUpperCase();
    const aiaAgentCode = String(body?.aiaAgentCode ?? meta.aiaAgentCode ?? "").trim();
    if (!aiaAgentCode) throw new HTTPException(400, { message: "Agent code is required before the May 13 venue check-in." });
    meta.positionCode = positionCode;
    meta.aiaAgentCode = aiaAgentCode;
    meta.mobileNumber = String(body?.mobileNumber ?? meta.mobileNumber ?? meta.attendeeClaimMobile ?? "").trim();
    meta.roomNumber = String(body?.roomNumber ?? meta.roomNumber ?? "").trim();
    meta.venueArrivalCheckInAt = nowIso;
    meta.venueArrivalCheckInBy = email;
    meta.onsiteRegisteredAt = nowIso;
    meta.onsiteRegisteredBy = email;
    await c.env.DB.prepare(
      `UPDATE registrations SET
        attendee_type = ?,
        status = 'checked-in',
        checked_in_at = COALESCE(checked_in_at, CURRENT_TIMESTAMP),
        metadata_json = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`
    )
      .bind(positionCode, JSON.stringify(meta), candidate.id)
      .run();
  }
  const item = await c.env.DB.prepare("SELECT * FROM registrations WHERE id = ?").bind(candidate.id).first();
  return c.json({ item, alreadyCheckedIn: false });
});

app.post("/api/events/:eventId/registrations/sync-my-profile", requireRole(["admin", "staff", "attendee"]), async (c) => {
  const eventId = c.req.param("eventId");
  const actor = c.get("authUser");
  const email = String(actor?.email || "").trim().toLowerCase();
  if (!email) throw new HTTPException(400, { message: "Signed-in email is required for profile sync." });
  const body = await c.req.json();
  const profile = body?.profile && typeof body.profile === "object" ? (body.profile as Record<string, unknown>) : {};
  const seededRegistrationId = String(body?.seededRegistrationId ?? "").trim();
  const seededDelegateName = String(body?.seededDelegateName ?? "").trim();

  const rowsRes = await c.env.DB.prepare("SELECT * FROM registrations WHERE event_id = ? ORDER BY created_at ASC").bind(eventId).all<any>();
  const rows = (rowsRes.results || []) as any[];

  const candidate = findSyncCandidate(rows, email, { seededRegistrationId, seededDelegateName, profile });

  const nextMetaBase = candidate ? parseMetadataJson(candidate.metadata_json) : {};
  const nextMeta: Record<string, unknown> = {
    ...nextMetaBase,
    attendeeClaimEmail: email,
    attendeeClaimedAt: String(nextMetaBase.attendeeClaimedAt || new Date().toISOString()),
    attendeeClaimMobile: String(profile.mobileNumber ?? nextMetaBase.attendeeClaimMobile ?? "").trim(),
    paymentValidationStatus: String(nextMetaBase.paymentValidationStatus || "pending"),
    paymentValidatedAt: nextMetaBase.paymentValidatedAt ?? null,
    paymentValidatedBy: nextMetaBase.paymentValidatedBy ?? null,
    source: String(nextMetaBase.source || "public-signup"),
  };
  const copyText = (key: string) => {
    const v = profile[key];
    if (v === undefined || v === null) return;
    nextMeta[key] = String(v).trim();
  };
  copyText("firstName");
  copyText("middleName");
  copyText("lastName");
  copyText("nickname");
  copyText("mobileNumber");
  copyText("positionCode");
  copyText("positionOther");
  copyText("aiaAgentCode");
  copyText("gender");
  const allowShirtSync = getRole(c) !== "attendee" || participantShirtEditOpen();
  if (allowShirtSync) {
    copyText("shirtSize");
    copyText("shirtSizeOther");
  }
  copyText("arrivalCebu");
  copyText("departureCebu");
  copyText("extraOtherRequest");
  copyText("activityPaymentMethod");
  copyText("activityPaymentReference");
  copyText("activityPaymentAmount");
  copyText("activityPaymentSenderNumber");
  copyText("activityPaymentProofScreenshotDataUrl");
  copyText("activityPaymentProofUploadedAt");
  copyText("activityPaymentConfirmedAt");
  copyText("activityPaymentStatus");
  copyText("paymentProofScreenshotDataUrl");
  copyText("paymentProofUploadedAt");
  if (profile.age !== undefined && profile.age !== null) nextMeta.age = String(profile.age).trim();
  if (profile.extraIslandHopping !== undefined) nextMeta.extraIslandHopping = Boolean(profile.extraIslandHopping);
  if (profile.extraCityTour !== undefined) nextMeta.extraCityTour = Boolean(profile.extraCityTour);
  if (profile.extraMountainTour !== undefined) nextMeta.extraMountainTour = Boolean(profile.extraMountainTour);
  if (profile.extraSafari !== undefined) nextMeta.extraSafari = Boolean(profile.extraSafari);
  if (profile.activityRegistrationConfirmed !== undefined) nextMeta.activityRegistrationConfirmed = Boolean(profile.activityRegistrationConfirmed);

  const positionCode = String(profile.positionCode ?? "").trim().toUpperCase();
  const nextRole = positionCode || String(candidate?.attendee_type || "UM");
  const nextName = [String(profile.firstName || "").trim(), String(profile.middleName || "").trim(), String(profile.lastName || "").trim()]
    .filter(Boolean)
    .join(" ")
    .trim() || String(candidate?.full_name || seededDelegateName || email.split("@")[0] || "Unnamed").trim();
  const normalizedNextName = toNameCase(nextName);

  if (candidate?.id) {
    await c.env.DB.prepare(
      `UPDATE registrations SET
        full_name = COALESCE(?, full_name),
        attendee_type = COALESCE(?, attendee_type),
        status = COALESCE(?, status),
        metadata_json = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`
    )
      .bind(normalizedNextName, nextRole, candidate.status || "pre-registered", JSON.stringify(nextMeta), candidate.id)
      .run();
    const item = await c.env.DB.prepare("SELECT * FROM registrations WHERE id = ?").bind(candidate.id).first();
    return c.json({ action: "updated", item });
  }

  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    `INSERT INTO registrations (id, event_id, full_name, attendee_type, status, total_fee, paid_amount, payment_plan, metadata_json, updated_at)
     VALUES (?, ?, ?, ?, 'pre-registered', 8000, 0, 'full', ?, CURRENT_TIMESTAMP)`
  )
    .bind(id, eventId, normalizedNextName, nextRole, JSON.stringify(nextMeta))
    .run();
  const item = await c.env.DB.prepare("SELECT * FROM registrations WHERE id = ?").bind(id).first();
  return c.json({ action: "created", item }, 201);
});

app.post("/api/events/:eventId/registrations/harmonize", requireRole(["admin", "staff"]), async (c) => {
  const eventId = c.req.param("eventId");
  const rowsRes = await c.env.DB.prepare("SELECT * FROM registrations WHERE event_id = ? ORDER BY created_at ASC").bind(eventId).all<any>();
  const rows = (rowsRes.results || []) as any[];
  if (!rows.length) return c.json({ merged: 0, removed: 0, groups: [] });

  const indexById = new Map(rows.map((r) => [String(r.id), r]));
  const groupsByName = new Map<string, any[]>();
  for (const row of rows) {
    const key = normalizeName(row.full_name);
    if (!key) continue;
    const arr = groupsByName.get(key) || [];
    arr.push(row);
    groupsByName.set(key, arr);
  }

  const mergedGroupNames: string[] = [];
  let removed = 0;

  const choosePrimary = (group: any[]) =>
    [...group].sort((a, b) => {
      const aMeta = parseMetadataJson(a.metadata_json);
      const bMeta = parseMetadataJson(b.metadata_json);
      const aSeed = isSeedSource(aMeta.seedSource) ? 1 : 0;
      const bSeed = isSeedSource(bMeta.seedSource) ? 1 : 0;
      if (aSeed !== bSeed) return bSeed - aSeed;
      const paidDiff = asNumber(b.paid_amount, 0) - asNumber(a.paid_amount, 0);
      if (paidDiff !== 0) return paidDiff;
      return String(a.created_at || "").localeCompare(String(b.created_at || ""));
    })[0];

  for (const [nameKey, group] of groupsByName.entries()) {
    if (group.length < 2) continue;
    const primary = choosePrimary(group);
    const duplicates = group.filter((r) => String(r.id) !== String(primary.id));
    if (!duplicates.length) continue;

    let primaryMeta = parseMetadataJson(primary.metadata_json);
    let bestPaid = asNumber(primary.paid_amount, 0);
    let bestTotal = asNumber(primary.total_fee, 0);
    let bestStatusRank = statusRank(primary.status);

    for (const dup of duplicates) {
      const dupMeta = parseMetadataJson(dup.metadata_json);
      for (const [k, v] of Object.entries(dupMeta)) {
        if (primaryMeta[k] === undefined || primaryMeta[k] === null || primaryMeta[k] === "") {
          primaryMeta[k] = v;
        }
      }
      bestPaid = Math.max(bestPaid, asNumber(dup.paid_amount, 0));
      bestTotal = Math.max(bestTotal, asNumber(dup.total_fee, 0));
      bestStatusRank = Math.max(bestStatusRank, statusRank(dup.status));

      await c.env.DB.prepare("DELETE FROM billing_ledger WHERE registration_id = ?").bind(dup.id).run();
      await c.env.DB.prepare("DELETE FROM registrations WHERE id = ?").bind(dup.id).run();
      indexById.delete(String(dup.id));
      removed += 1;
    }

    await c.env.DB.prepare(
      `UPDATE registrations SET
        paid_amount = ?,
        total_fee = ?,
        status = ?,
        metadata_json = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`
    )
      .bind(bestPaid, bestTotal, statusByRank(bestStatusRank), JSON.stringify(primaryMeta), primary.id)
      .run();

    mergedGroupNames.push(nameKey);
    indexById.set(String(primary.id), { ...primary, paid_amount: bestPaid, total_fee: bestTotal, status: statusByRank(bestStatusRank), metadata_json: JSON.stringify(primaryMeta) });
  }

  // Second pass: merge rows linked by attendeeClaimEmail even if names differ.
  const emailGroups = new Map<string, any[]>();
  for (const row of indexById.values()) {
    const meta = parseMetadataJson(row.metadata_json);
    const email = normalizeName(meta.attendeeClaimEmail);
    if (!email) continue;
    const arr = emailGroups.get(email) || [];
    arr.push(row);
    emailGroups.set(email, arr);
  }
  for (const rowsByEmail of emailGroups.values()) {
    if (rowsByEmail.length < 2) continue;
    const primary = choosePrimary(rowsByEmail);
    const duplicates = rowsByEmail.filter((r) => String(r.id) !== String(primary.id));
    if (!duplicates.length) continue;
    let primaryMeta = parseMetadataJson(primary.metadata_json);
    let bestPaid = asNumber(primary.paid_amount, 0);
    let bestTotal = asNumber(primary.total_fee, 0);
    let bestStatusRank = statusRank(primary.status);
    for (const dup of duplicates) {
      const dupMeta = parseMetadataJson(dup.metadata_json);
      for (const [k, v] of Object.entries(dupMeta)) {
        if (primaryMeta[k] === undefined || primaryMeta[k] === null || primaryMeta[k] === "") {
          primaryMeta[k] = v;
        }
      }
      bestPaid = Math.max(bestPaid, asNumber(dup.paid_amount, 0));
      bestTotal = Math.max(bestTotal, asNumber(dup.total_fee, 0));
      bestStatusRank = Math.max(bestStatusRank, statusRank(dup.status));
      await c.env.DB.prepare("DELETE FROM billing_ledger WHERE registration_id = ?").bind(dup.id).run();
      await c.env.DB.prepare("DELETE FROM registrations WHERE id = ?").bind(dup.id).run();
      indexById.delete(String(dup.id));
      removed += 1;
    }
    await c.env.DB.prepare(
      `UPDATE registrations SET
        paid_amount = ?,
        total_fee = ?,
        status = ?,
        metadata_json = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`
    )
      .bind(bestPaid, bestTotal, statusByRank(bestStatusRank), JSON.stringify(primaryMeta), primary.id)
      .run();
  }

  return c.json({ merged: mergedGroupNames.length, removed, groups: mergedGroupNames.slice(0, 50) });
});

app.post("/api/events/:eventId/registrations", requireRole(["admin", "staff"]), async (c) => {
  const eventId = c.req.param("eventId");
  const body = await c.req.json();
  const id = crypto.randomUUID();
  const meta =
    body.metadata != null
      ? typeof body.metadata === "string"
        ? body.metadata
        : JSON.stringify(body.metadata)
      : null;
  await c.env.DB.prepare(
    `INSERT INTO registrations (id, event_id, full_name, attendee_type, status, total_fee, paid_amount, payment_plan, metadata_json, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
  )
    .bind(
      id,
      eventId,
      toNameCase(body.fullName ?? "Unnamed"),
      body.attendeeType ?? "Standard",
      body.status ?? "pre-registered",
      asNumber(body.totalFee, 0),
      asNumber(body.paidAmount, 0),
      body.paymentPlan ?? "full",
      meta
    )
    .run();
  const item = await c.env.DB.prepare("SELECT * FROM registrations WHERE id = ?").bind(id).first();
  return c.json({ item }, 201);
});

app.patch("/api/registrations/:id", requireRole(["admin", "staff"]), async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const existing = await c.env.DB.prepare("SELECT * FROM registrations WHERE id = ?").bind(id).first<Record<string, unknown>>();
  if (!existing) throw new HTTPException(404, { message: "Registration not found." });
  const nextMeta =
    body.metadata !== undefined
      ? typeof body.metadata === "string"
        ? body.metadata
        : JSON.stringify(body.metadata)
      : (existing.metadata_json as string | null);
  await c.env.DB.prepare(
    `UPDATE registrations SET
      full_name = COALESCE(?, full_name),
      attendee_type = COALESCE(?, attendee_type),
      status = COALESCE(?, status),
      total_fee = COALESCE(?, total_fee),
      paid_amount = COALESCE(?, paid_amount),
      payment_plan = COALESCE(?, payment_plan),
      metadata_json = COALESCE(?, metadata_json),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?`
  )
    .bind(
      body.fullName != null ? toNameCase(body.fullName) : null,
      body.attendeeType ?? null,
      body.status ?? null,
      body.totalFee != null ? asNumber(body.totalFee, 0) : null,
      body.paidAmount != null ? asNumber(body.paidAmount, 0) : null,
      body.paymentPlan ?? null,
      nextMeta ?? null,
      id
    )
    .run();
  const item = await c.env.DB.prepare("SELECT * FROM registrations WHERE id = ?").bind(id).first();
  return c.json({ item });
});

app.delete("/api/registrations/:id", requireRole(["admin", "staff"]), async (c) => {
  const id = c.req.param("id");
  await c.env.DB.prepare("DELETE FROM billing_ledger WHERE registration_id = ?").bind(id).run();
  await c.env.DB.prepare("DELETE FROM registrations WHERE id = ?").bind(id).run();
  return c.json({ ok: true });
});

app.patch("/api/registrations/:id/check-in", requireRole(["admin", "staff"]), async (c) => {
  const id = c.req.param("id");
  await c.env.DB.prepare("UPDATE registrations SET status = 'checked-in', checked_in_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(id).run();
  const item = await c.env.DB.prepare("SELECT * FROM registrations WHERE id = ?").bind(id).first();
  return c.json({ item });
});

app.post("/api/registrations/:id/installments/generate", requireRole(["admin", "staff"]), async (c) => {
  const registrationId = c.req.param("id");
  const body = await c.req.json();
  const total = asNumber(body.totalAmount, 0);
  const count = Math.max(1, asNumber(body.installmentCount, 1));
  const startDate = new Date(body.startDate ?? new Date().toISOString());
  const base = Math.floor(total / count);
  const remainder = total - base * count;

  await c.env.DB.prepare("DELETE FROM billing_ledger WHERE registration_id = ?").bind(registrationId).run();

  for (let i = 0; i < count; i += 1) {
    const due = new Date(startDate);
    due.setMonth(startDate.getMonth() + i);
    const amountDue = i === 0 ? base + remainder : base;
    await c.env.DB.prepare(
      "INSERT INTO billing_ledger (id, registration_id, due_date, amount_due, amount_paid, status) VALUES (?, ?, ?, ?, 0, 'unpaid')"
    )
      .bind(crypto.randomUUID(), registrationId, due.toISOString().slice(0, 10), amountDue)
      .run();
  }

  const ledger = await c.env.DB.prepare("SELECT * FROM billing_ledger WHERE registration_id = ? ORDER BY due_date ASC").bind(registrationId).all();
  return c.json({ items: ledger.results }, 201);
});

app.post("/api/registrations/:id/payments", requireRole(["admin", "staff"]), async (c) => {
  const registrationId = c.req.param("id");
  const body = await c.req.json();
  let remainingCredit = asNumber(body.amount, 0);
  if (remainingCredit <= 0) throw new HTTPException(400, { message: "Payment amount must be greater than zero." });

  const ledgerRows = await c.env.DB.prepare(
    "SELECT * FROM billing_ledger WHERE registration_id = ? AND status IN ('unpaid', 'partial', 'overdue') ORDER BY due_date ASC"
  )
    .bind(registrationId)
    .all();

  for (const row of ledgerRows.results as any[]) {
    if (remainingCredit <= 0) break;
    const due = asNumber(row.amount_due, 0);
    const paid = asNumber(row.amount_paid, 0);
    const gap = Math.max(0, due - paid);
    if (gap <= 0) continue;
    const apply = Math.min(gap, remainingCredit);
    const newPaid = paid + apply;
    const status = newPaid >= due ? "paid" : "partial";
    await c.env.DB.prepare("UPDATE billing_ledger SET amount_paid = ?, status = ? WHERE id = ?").bind(newPaid, status, row.id).run();
    remainingCredit -= apply;
  }

  const summary = await c.env.DB.prepare(
    "SELECT COALESCE(SUM(amount_paid),0) as paid, COALESCE(SUM(amount_due),0) as due FROM billing_ledger WHERE registration_id = ?"
  )
    .bind(registrationId)
    .first<{ paid: number; due: number }>();

  await c.env.DB.prepare("UPDATE registrations SET paid_amount = ?, status = CASE WHEN ? >= total_fee THEN 'registered' ELSE status END, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
    .bind(asNumber(summary?.paid, 0), asNumber(summary?.paid, 0), registrationId)
    .run();

  const ledger = await c.env.DB.prepare("SELECT * FROM billing_ledger WHERE registration_id = ? ORDER BY due_date ASC").bind(registrationId).all();
  return c.json({ items: ledger.results, unappliedCredit: remainingCredit });
});

app.get("/api/events/:eventId/financial-summary", async (c) => {
  const eventId = c.req.param("eventId");
  const regRev = await c.env.DB.prepare("SELECT COALESCE(SUM(paid_amount),0) as value FROM registrations WHERE event_id = ?").bind(eventId).first<{ value: number }>();
  const sponRev = await c.env.DB.prepare("SELECT COALESCE(SUM(amount),0) as value FROM sponsors WHERE event_id = ? AND paid = 1").bind(eventId).first<{ value: number }>();
  const expense = await c.env.DB.prepare("SELECT COALESCE(SUM(amount),0) as value FROM expenses WHERE event_id = ? AND approved = 1").bind(eventId).first<{ value: number }>();
  const totalRev = asNumber(regRev?.value, 0) + asNumber(sponRev?.value, 0);
  const approvedExp = asNumber(expense?.value, 0);
  const netProfit = totalRev - approvedExp;
  const attendee = await c.env.DB.prepare("SELECT COUNT(*) as value FROM registrations WHERE event_id = ? AND status IN ('registered','checked-in')").bind(eventId).first<{ value: number }>();
  const avgTicket = totalRev / Math.max(asNumber(attendee?.value, 0), 1);
  return c.json({
    totalRev,
    approvedExp,
    netProfit,
    breakEven: Math.ceil(approvedExp / Math.max(avgTicket, 1)),
    attendeeCount: asNumber(attendee?.value, 0),
  });
});

app.get("/api/events/:eventId/sponsors", async (c) => {
  const eventId = c.req.param("eventId");
  const res = await c.env.DB.prepare("SELECT * FROM sponsors WHERE event_id = ? ORDER BY created_at DESC").bind(eventId).all();
  return c.json({ items: res.results });
});

app.post("/api/events/:eventId/sponsors", requireRole(["admin", "staff"]), async (c) => {
  const eventId = c.req.param("eventId");
  const body = await c.req.json();
  const id = crypto.randomUUID();
  await c.env.DB.prepare("INSERT INTO sponsors (id, event_id, company, tier, amount, paid, booth, remarks) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(
      id,
      eventId,
      body.company ?? "Unknown Sponsor",
      body.tier ?? "Bronze",
      asNumber(body.amount, 0),
      body.paid ? 1 : 0,
      body.booth ?? null,
      body.remarks ?? null
    )
    .run();
  const item = await c.env.DB.prepare("SELECT * FROM sponsors WHERE id = ?").bind(id).first();
  return c.json({ item }, 201);
});

app.delete("/api/sponsors/:id", requireRole(["admin", "staff"]), async (c) => {
  const id = c.req.param("id");
  await c.env.DB.prepare("DELETE FROM sponsors WHERE id = ?").bind(id).run();
  return c.json({ ok: true });
});

app.patch("/api/sponsors/:id", requireRole(["admin", "staff"]), async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const existing = await c.env.DB.prepare("SELECT * FROM sponsors WHERE id = ?").bind(id).first<Record<string, unknown>>();
  if (!existing) throw new HTTPException(404, { message: "Sponsor not found." });

  let remarks = existing.remarks as string | null;
  let paid = Number(existing.paid) === 1 ? 1 : 0;

  if (body.status !== undefined) {
    const status = String(body.status).trim().toLowerCase();
    if (status === "collected") {
      remarks = "Collected";
      paid = 1;
    } else if (status === "uncollected") {
      remarks = "Uncollected";
      paid = 0;
    } else {
      throw new HTTPException(400, { message: 'Status must be "collected" or "uncollected".' });
    }
  } else {
    if (body.remarks !== undefined) remarks = String(body.remarks ?? "").trim() || null;
    if (body.paid !== undefined) paid = body.paid ? 1 : 0;
    if (body.collected !== undefined) {
      const collected = body.collected === true || body.collected === 1;
      remarks = collected ? "Collected" : "Uncollected";
      paid = collected ? 1 : 0;
    }
  }

  await c.env.DB.prepare(
    `UPDATE sponsors SET
      company = COALESCE(?, company),
      tier = COALESCE(?, tier),
      amount = COALESCE(?, amount),
      paid = ?,
      booth = COALESCE(?, booth),
      remarks = ?
    WHERE id = ?`
  )
    .bind(
      body.company !== undefined ? String(body.company) : null,
      body.tier !== undefined ? String(body.tier) : null,
      body.amount !== undefined ? asNumber(body.amount, 0) : null,
      paid,
      body.booth !== undefined ? (body.booth ? String(body.booth) : null) : null,
      remarks,
      id
    )
    .run();

  const item = await c.env.DB.prepare("SELECT * FROM sponsors WHERE id = ?").bind(id).first();
  return c.json({ item });
});

app.get("/api/events/:eventId/expenses", async (c) => {
  const eventId = c.req.param("eventId");
  const res = await c.env.DB.prepare("SELECT * FROM expenses WHERE event_id = ? ORDER BY created_at DESC").bind(eventId).all();
  return c.json({ items: res.results });
});

app.post("/api/events/:eventId/expenses", requireRole(["admin", "staff"]), async (c) => {
  const eventId = c.req.param("eventId");
  const body = await c.req.json();
  const id = crypto.randomUUID();
  await c.env.DB.prepare("INSERT INTO expenses (id, event_id, supplier, category, amount, expense_type, approved) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(id, eventId, body.supplier ?? "Unknown Supplier", body.category ?? "General", asNumber(body.amount, 0), body.expenseType ?? "fixed", body.approved ? 1 : 0)
    .run();
  const item = await c.env.DB.prepare("SELECT * FROM expenses WHERE id = ?").bind(id).first();
  return c.json({ item }, 201);
});

app.delete("/api/expenses/:id", requireRole(["admin", "staff"]), async (c) => {
  const id = c.req.param("id");
  await c.env.DB.prepare("DELETE FROM expenses WHERE id = ?").bind(id).run();
  return c.json({ ok: true });
});

app.patch("/api/expenses/:id", requireRole(["admin", "staff"]), async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const approvedBind = body.approved === undefined ? null : body.approved ? 1 : 0;
  await c.env.DB.prepare(
    `UPDATE expenses SET
      supplier = COALESCE(?, supplier),
      category = COALESCE(?, category),
      amount = COALESCE(?, amount),
      expense_type = COALESCE(?, expense_type),
      approved = COALESCE(?, approved)
    WHERE id = ?`
  )
    .bind(
      body.supplier !== undefined ? String(body.supplier) : null,
      body.category !== undefined ? String(body.category) : null,
      body.amount !== undefined ? asNumber(body.amount, 0) : null,
      body.expenseType !== undefined ? String(body.expenseType) : null,
      approvedBind,
      id
    )
    .run();
  const item = await c.env.DB.prepare("SELECT * FROM expenses WHERE id = ?").bind(id).first();
  return c.json({ item });
});

app.get("/api/events/:eventId/speakers", async (c) => {
  const eventId = c.req.param("eventId");
  const res = await c.env.DB.prepare("SELECT * FROM speakers WHERE event_id = ? ORDER BY created_at ASC").bind(eventId).all();
  return c.json({ items: res.results });
});

app.post("/api/events/:eventId/speakers", requireRole(["admin", "staff"]), async (c) => {
  const eventId = c.req.param("eventId");
  const body = await c.req.json();
  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    "INSERT INTO speakers (id, event_id, talk, name, topic, classification, honorarium) VALUES (?, ?, ?, ?, ?, ?, ?)"
  )
    .bind(
      id,
      eventId,
      body.talk ?? "Talk",
      body.name ?? "",
      body.topic ?? "",
      body.classification ?? "Others",
      asNumber(body.honorarium, 0)
    )
    .run();
  const item = await c.env.DB.prepare("SELECT * FROM speakers WHERE id = ?").bind(id).first();
  return c.json({ item }, 201);
});

app.patch("/api/speakers/:id", requireRole(["admin", "staff"]), async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  await c.env.DB.prepare(
    `UPDATE speakers SET
      talk = COALESCE(?, talk),
      name = COALESCE(?, name),
      topic = COALESCE(?, topic),
      classification = COALESCE(?, classification),
      honorarium = COALESCE(?, honorarium)
    WHERE id = ?`
  )
    .bind(body.talk ?? null, body.name ?? null, body.topic ?? null, body.classification ?? null, body.honorarium != null ? asNumber(body.honorarium, 0) : null, id)
    .run();
  const item = await c.env.DB.prepare("SELECT * FROM speakers WHERE id = ?").bind(id).first();
  return c.json({ item });
});

app.delete("/api/speakers/:id", requireRole(["admin", "staff"]), async (c) => {
  const id = c.req.param("id");
  await c.env.DB.prepare("DELETE FROM speakers WHERE id = ?").bind(id).run();
  return c.json({ ok: true });
});

app.get("/api/events/:eventId/program-sessions", async (c) => {
  const eventId = c.req.param("eventId");
  const res = await c.env.DB.prepare("SELECT * FROM program_sessions WHERE event_id = ? ORDER BY start_time ASC").bind(eventId).all();
  return c.json({ items: res.results });
});

app.post("/api/events/:eventId/program-sessions", requireRole(["admin", "staff"]), async (c) => {
  const eventId = c.req.param("eventId");
  const body = await c.req.json();
  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    "INSERT INTO program_sessions (id, event_id, title, speaker, location, start_time, end_time, status, assigned_to, to_finalize, notes, sponsor_slot, day_label) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  )
    .bind(
      id,
      eventId,
      body.title ?? "Untitled Session",
      body.speaker ?? "TBA",
      body.location ?? "TBA",
      body.startTime ?? null,
      body.endTime ?? null,
      body.status ?? "next",
      body.assignedTo ?? null,
      body.toFinalize ?? null,
      body.notes ?? null,
      body.sponsorSlot ?? null,
      body.dayLabel ?? null
    )
    .run();
  const item = await c.env.DB.prepare("SELECT * FROM program_sessions WHERE id = ?").bind(id).first();
  return c.json({ item }, 201);
});

app.get("/api/events/:eventId/invitations", requireRole(["admin", "staff"]), async (c) => {
  const eventId = c.req.param("eventId");
  const res = await c.env.DB.prepare("SELECT * FROM invitations WHERE event_id = ? ORDER BY created_at DESC").bind(eventId).all();
  return c.json({ items: res.results });
});

app.post("/api/events/:eventId/invitations", requireRole(["admin", "staff"]), async (c) => {
  const eventId = c.req.param("eventId");
  const body = await c.req.json();
  const id = crypto.randomUUID();
  const token = crypto.randomUUID();
  await c.env.DB.prepare(
    "INSERT INTO invitations (id, event_id, email, full_name, token, status, invitation_type, sent_at) VALUES (?, ?, ?, ?, ?, 'sent', ?, CURRENT_TIMESTAMP)"
  )
    .bind(id, eventId, body.email ?? "", body.fullName ?? null, token, body.invitationType ?? "standard")
    .run();
  const item = await c.env.DB.prepare("SELECT * FROM invitations WHERE id = ?").bind(id).first();
  return c.json({ item }, 201);
});

app.patch("/api/invitations/respond/:token", async (c) => {
  const token = c.req.param("token");
  const body = await c.req.json();
  const status = body.status === "declined" ? "declined" : "accepted";
  await c.env.DB.prepare("UPDATE invitations SET status = ?, last_opened_at = CURRENT_TIMESTAMP WHERE token = ?").bind(status, token).run();
  const invitation = await c.env.DB.prepare("SELECT * FROM invitations WHERE token = ?").bind(token).first<any>();
  if (status === "accepted" && invitation) {
    const regId = crypto.randomUUID();
    await c.env.DB.prepare(
      "INSERT INTO registrations (id, event_id, full_name, attendee_type, status, total_fee, paid_amount, payment_plan, updated_at) VALUES (?, ?, ?, ?, 'pre-registered', 0, 0, 'full', CURRENT_TIMESTAMP)"
    )
      .bind(regId, invitation.event_id, toNameCase(invitation.full_name ?? invitation.email), invitation.invitation_type ?? "Standard")
      .run();
  }
  return c.json({ ok: true, status });
});

const SIGNATURE_DATA_URL_MAX = 600_000;
const SUPPLIER_RECEIPT_IMAGES_MAX = 8;

function parseSupplierReceiptImages(stored: string | null | undefined): string[] {
  const s = String(stored ?? "").trim();
  if (!s) return [];
  if (s.startsWith("[")) {
    try {
      const parsed = JSON.parse(s) as unknown;
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((x): x is string => typeof x === "string" && x.startsWith("data:image/"));
    } catch {
      return [];
    }
  }
  if (s.startsWith("data:image/")) return [s];
  return [];
}

function serializeSupplierReceiptImages(urls: string[]): string | null {
  const clean = urls.filter(Boolean);
  if (clean.length === 0) return null;
  if (clean.length === 1) return clean[0]!;
  return JSON.stringify(clean);
}

function sanitizeSupplierReceiptImages(raw: unknown, label = "Receipt"): string | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (Array.isArray(raw)) {
    if (raw.length > SUPPLIER_RECEIPT_IMAGES_MAX) {
      throw new HTTPException(400, { message: `At most ${SUPPLIER_RECEIPT_IMAGES_MAX} receipt images allowed.` });
    }
    const urls = raw
      .map((item) => sanitizeImageDataUrl(item, label))
      .filter((u): u is string => Boolean(u));
    return serializeSupplierReceiptImages(urls);
  }
  const one = sanitizeImageDataUrl(raw, label);
  return one ? serializeSupplierReceiptImages([one]) : null;
}

function supplierReceiptHasImages(stored: string | null | undefined): boolean {
  return parseSupplierReceiptImages(stored).length > 0;
}

async function nextVoucherNumber(db: D1Database, eventId: string) {
  const d = new Date();
  const ymd = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
  const prefix = `EPV-${ymd}-`;
  const res = await db
    .prepare("SELECT voucher_number FROM supplier_payment_vouchers WHERE event_id = ? AND voucher_number LIKE ?")
    .bind(eventId, `${prefix}%`)
    .all<{ voucher_number: string }>();
  let maxSeq = 0;
  for (const r of res.results || []) {
    const m = String(r.voucher_number || "").match(/^EPV-(\d{8})-(\d{4})$/);
    if (m && m[1] === ymd) {
      const n = parseInt(m[2], 10);
      if (Number.isFinite(n)) maxSeq = Math.max(maxSeq, n);
    }
  }
  return `${prefix}${String(maxSeq + 1).padStart(4, "0")}`;
}

/** After inserts/deletes, compact EPV-YYYYMMDD-#### per day prefix for this event; sync payment_reference when it matched the old voucher number. */
async function resequenceSupplierVoucherNumbersForEvent(db: D1Database, eventId: string) {
  const res = await db
    .prepare(
      `SELECT id, voucher_number, payment_reference, created_at FROM supplier_payment_vouchers WHERE event_id = ? ORDER BY created_at ASC`
    )
    .bind(eventId)
    .all<{ id: string; voucher_number: string; payment_reference: string | null; created_at: string }>();
  const rows = (res.results || []) as { id: string; voucher_number: string; payment_reference: string | null; created_at: string }[];
  const groups = new Map<string, typeof rows>();
  for (const r of rows) {
    const m = String(r.voucher_number || "").match(/^EPV-(\d{8})-(\d{4})$/);
    if (!m) continue;
    const ymd = m[1];
    if (!groups.has(ymd)) groups.set(ymd, []);
    groups.get(ymd)!.push(r);
  }
  const now = new Date().toISOString();
  for (const [ymd, list] of groups) {
    list.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
    const snapshots = list.map((row) => {
      const oldVn = String(row.voucher_number || "");
      const oldRef = String(row.payment_reference ?? "").trim();
      return {
        id: row.id,
        oldVn,
        oldRef,
        refSynced: !oldRef || oldRef === oldVn,
      };
    });
    for (const s of snapshots) {
      await db.prepare("UPDATE supplier_payment_vouchers SET voucher_number = ?, updated_at = ? WHERE id = ?").bind(`EPV-RESEQ-${s.id}`, now, s.id).run();
    }
    for (let i = 0; i < snapshots.length; i++) {
      const s = snapshots[i];
      const newVn = `EPV-${ymd}-${String(i + 1).padStart(4, "0")}`;
      const newRef = s.refSynced ? newVn : s.oldRef || null;
      await db
        .prepare("UPDATE supplier_payment_vouchers SET voucher_number = ?, payment_reference = ?, updated_at = ? WHERE id = ?")
        .bind(newVn, newRef, now, s.id)
        .run();
    }
  }
}

function sanitizeImageDataUrl(raw: unknown, label = "Image") {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  if (!s.startsWith("data:image/")) throw new HTTPException(400, { message: `${label} must be a valid image.` });
  if (s.length > SIGNATURE_DATA_URL_MAX) throw new HTTPException(400, { message: `${label} is too large. Please use a smaller file.` });
  return s;
}

function sanitizeSignatureDataUrl(raw: unknown) {
  return sanitizeImageDataUrl(raw, "Signature");
}

function publicVoucherPayload(row: Record<string, unknown>) {
  return {
    id: row.id,
    voucherNumber: row.voucher_number,
    status: row.status,
    supplierName: row.supplier_name,
    amount: row.amount,
    currency: row.currency ?? "PHP",
    paymentMethod: row.payment_method,
    paymentReference: row.payment_reference,
    paymentDate: row.payment_date,
    description: row.description,
    confirmedReceipt: Boolean(row.confirmed_receipt),
    signerName: row.signer_name,
    signerTitle: row.signer_title,
    signedAt: row.signed_at,
    confirmedAt: row.confirmed_at,
    dateReceived: row.date_received,
    hasSignature: Boolean(row.signature_data_url),
    hasReceipt: supplierReceiptHasImages(row.supplier_receipt_data_url as string | null),
    supplierReceiptNumber: row.supplier_receipt_number ?? null,
    eventTitle: row.event_title ?? null,
  };
}

app.get("/api/events/:eventId/payment-vouchers", requireRole(["admin", "staff"]), async (c) => {
  const eventId = c.req.param("eventId");
  const res = await c.env.DB.prepare(
    `SELECT v.id, v.event_id, v.expense_id, v.token, v.voucher_number, v.status, v.supplier_name, v.payee_email,
            v.payee_contact, v.amount, v.currency, v.payment_method, v.payment_reference, v.payment_date,
            v.description, v.notes, v.signature_method, v.signer_name, v.signer_title, v.signed_at,
            v.confirmed_receipt, v.receipt_notes, v.date_received, v.supplier_receipt_number,
            v.created_by_email, v.sent_at, v.viewed_at, v.confirmed_at, v.receipt_uploaded_at,
            v.created_at, v.updated_at,
            CASE WHEN v.signature_data_url IS NOT NULL AND v.signature_data_url != '' THEN 1 ELSE 0 END AS has_signature,
            CASE WHEN v.supplier_receipt_data_url IS NOT NULL AND v.supplier_receipt_data_url != '' THEN 1 ELSE 0 END AS has_receipt
     FROM supplier_payment_vouchers v
     WHERE v.event_id = ?
     ORDER BY v.created_at DESC`
  )
    .bind(eventId)
    .all();
  return c.json({ items: res.results });
});

app.post("/api/events/:eventId/payment-vouchers", requireRole(["admin", "staff"]), async (c) => {
  const eventId = c.req.param("eventId") ?? "";
  if (!eventId) throw new HTTPException(400, { message: "eventId is required." });
  const body = await c.req.json();
  const actor = c.get("authUser");
  const supplierName = String(body.supplierName ?? body.supplier ?? "").trim();
  if (!supplierName) throw new HTTPException(400, { message: "Supplier name is required." });
  const amount = asNumber(body.amount, 0);
  if (amount <= 0) throw new HTTPException(400, { message: "Amount must be greater than zero." });

  let expenseId: string | null = body.expenseId ? String(body.expenseId) : null;
  if (expenseId) {
    const expense = await c.env.DB.prepare("SELECT id FROM expenses WHERE id = ? AND event_id = ?").bind(expenseId, eventId).first();
    if (!expense) throw new HTTPException(400, { message: "Linked expense not found for this event." });
  }

  const id = crypto.randomUUID();
  const token = crypto.randomUUID();
  const voucherNumber = await nextVoucherNumber(c.env.DB, eventId);
  const paymentReference = String(body.paymentReference ?? "").trim() || voucherNumber;
  await c.env.DB.prepare(
    `INSERT INTO supplier_payment_vouchers (
      id, event_id, expense_id, token, voucher_number, status, supplier_name, payee_email, payee_contact,
      amount, currency, payment_method, payment_reference, payment_date, description, notes,
      created_by_email, sent_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 'sent', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
  )
    .bind(
      id,
      eventId,
      expenseId,
      token,
      voucherNumber,
      supplierName,
      String(body.payeeEmail ?? "").trim() || null,
      String(body.payeeContact ?? "").trim() || null,
      amount,
      String(body.currency ?? "PHP").trim() || "PHP",
      String(body.paymentMethod ?? "").trim() || null,
      paymentReference,
      String(body.paymentDate ?? "").trim() || null,
      String(body.description ?? "").trim() || null,
      String(body.notes ?? "").trim() || null,
      actor?.email ?? null
    )
    .run();

  const item = await c.env.DB.prepare("SELECT * FROM supplier_payment_vouchers WHERE id = ?").bind(id).first();
  return c.json({ item, confirmUrl: `/supplier-voucher/${token}` }, 201);
});

app.get("/api/payment-vouchers/:id", requireRole(["admin", "staff"]), async (c) => {
  const id = c.req.param("id");
  const row = await c.env.DB.prepare(
    `SELECT v.*,
            CASE WHEN v.signature_data_url IS NOT NULL AND v.signature_data_url != '' THEN 1 ELSE 0 END AS has_signature
     FROM supplier_payment_vouchers v WHERE v.id = ?`
  )
    .bind(id)
    .first<Record<string, unknown>>();
  if (!row) throw new HTTPException(404, { message: "Voucher not found." });
  const { signature_data_url: _sig, ...rest } = row;
  return c.json({
    item: {
      ...rest,
      hasSignature: Boolean(row.has_signature),
    },
  });
});

app.patch("/api/payment-vouchers/:id", requireRole(["admin", "staff"]), async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const existing = await c.env.DB.prepare("SELECT * FROM supplier_payment_vouchers WHERE id = ?").bind(id).first<Record<string, unknown>>();
  if (!existing) throw new HTTPException(404, { message: "Voucher not found." });

  if (body.status === "void") {
    if (existing.status === "confirmed") throw new HTTPException(400, { message: "Cannot void a confirmed voucher." });
    await c.env.DB.prepare("UPDATE supplier_payment_vouchers SET status = 'void', updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(id).run();
    const item = await c.env.DB.prepare("SELECT * FROM supplier_payment_vouchers WHERE id = ?").bind(id).first();
    return c.json({ item });
  }

  const hasDetailUpdate =
    body.supplierName !== undefined ||
    body.amount !== undefined ||
    body.payeeEmail !== undefined ||
    body.payeeContact !== undefined ||
    body.paymentMethod !== undefined ||
    body.paymentReference !== undefined ||
    body.paymentDate !== undefined ||
    body.description !== undefined ||
    body.notes !== undefined ||
    body.expenseId !== undefined ||
    body.dateReceived !== undefined ||
    body.supplierReceiptNumber !== undefined ||
    body.supplierReceiptDataUrl !== undefined ||
    body.supplierReceiptDataUrls !== undefined;

  if (hasDetailUpdate) {
    assertAdminOnly(c);
    const actor = c.get("authUser");
    const supplierName =
      body.supplierName !== undefined ? String(body.supplierName ?? "").trim() : String(existing.supplier_name ?? "").trim();
    if (!supplierName) throw new HTTPException(400, { message: "Supplier name is required." });
    const amount = body.amount !== undefined ? asNumber(body.amount, 0) : asNumber(existing.amount, 0);
    if (amount <= 0) throw new HTTPException(400, { message: "Amount must be greater than zero." });

    let expenseId: string | null =
      body.expenseId !== undefined ? (body.expenseId ? String(body.expenseId) : null) : (existing.expense_id as string | null);
    if (expenseId) {
      const expense = await c.env.DB.prepare("SELECT id FROM expenses WHERE id = ? AND event_id = ?")
        .bind(expenseId, existing.event_id)
        .first();
      if (!expense) throw new HTTPException(400, { message: "Linked expense not found for this event." });
    }

    let dateReceived = existing.date_received as string | null;
    if (body.dateReceived !== undefined) {
      const dr = String(body.dateReceived ?? "").trim();
      if (dr && !/^\d{4}-\d{2}-\d{2}$/.test(dr)) {
        throw new HTTPException(400, { message: "Date received must be YYYY-MM-DD." });
      }
      dateReceived = dr || null;
    }

    let supplierReceiptDataUrl = existing.supplier_receipt_data_url as string | null;
    if (body.supplierReceiptDataUrls !== undefined) {
      supplierReceiptDataUrl = sanitizeSupplierReceiptImages(body.supplierReceiptDataUrls);
    } else if (body.supplierReceiptDataUrl !== undefined) {
      supplierReceiptDataUrl = sanitizeSupplierReceiptImages(body.supplierReceiptDataUrl);
    }
    const supplierReceiptNumber =
      body.supplierReceiptNumber !== undefined
        ? String(body.supplierReceiptNumber ?? "").trim() || null
        : (existing.supplier_receipt_number as string | null);
    const receiptUploadedAt =
      (body.supplierReceiptDataUrl !== undefined || body.supplierReceiptDataUrls !== undefined) && supplierReceiptDataUrl
        ? new Date().toISOString()
        : (existing.receipt_uploaded_at as string | null);

    await c.env.DB.prepare(
      `UPDATE supplier_payment_vouchers SET
        expense_id = ?,
        supplier_name = ?,
        payee_email = ?,
        payee_contact = ?,
        amount = ?,
        payment_method = ?,
        payment_reference = ?,
        payment_date = ?,
        description = ?,
        notes = ?,
        date_received = ?,
        supplier_receipt_data_url = ?,
        supplier_receipt_number = ?,
        receipt_uploaded_at = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`
    )
      .bind(
        expenseId,
        supplierName,
        body.payeeEmail !== undefined ? String(body.payeeEmail ?? "").trim() || null : existing.payee_email,
        body.payeeContact !== undefined ? String(body.payeeContact ?? "").trim() || null : existing.payee_contact,
        amount,
        body.paymentMethod !== undefined ? String(body.paymentMethod ?? "").trim() || null : existing.payment_method,
        body.paymentReference !== undefined ? String(body.paymentReference ?? "").trim() || null : existing.payment_reference,
        body.paymentDate !== undefined ? String(body.paymentDate ?? "").trim() || null : existing.payment_date,
        body.description !== undefined ? String(body.description ?? "").trim() || null : existing.description,
        body.notes !== undefined ? String(body.notes ?? "").trim() || null : existing.notes,
        dateReceived,
        supplierReceiptDataUrl,
        supplierReceiptNumber,
        receiptUploadedAt,
        id
      )
      .run();

    const item = await c.env.DB.prepare("SELECT * FROM supplier_payment_vouchers WHERE id = ?").bind(id).first();
    return c.json({ item, editedBy: actor?.email ?? null });
  }

  throw new HTTPException(400, { message: "Unsupported update." });
});

app.delete("/api/payment-vouchers/:id", requireRole(["admin", "staff"]), async (c) => {
  assertSuperuser(c);
  const id = c.req.param("id");
  const existing = await c.env.DB.prepare("SELECT id, event_id FROM supplier_payment_vouchers WHERE id = ?").bind(id).first<{ id: string; event_id: string }>();
  if (!existing?.event_id) throw new HTTPException(404, { message: "Voucher not found." });
  await c.env.DB.prepare("DELETE FROM supplier_payment_vouchers WHERE id = ?").bind(id).run();
  await resequenceSupplierVoucherNumbersForEvent(c.env.DB, existing.event_id);
  return c.json({ ok: true });
});

app.get("/api/payment-vouchers/public/:token", async (c) => {
  const token = c.req.param("token");
  const row = await c.env.DB.prepare(
    `SELECT v.*, e.title AS event_title
     FROM supplier_payment_vouchers v
     LEFT JOIN events e ON e.id = v.event_id
     WHERE v.token = ?`
  )
    .bind(token)
    .first<Record<string, unknown>>();
  if (!row) throw new HTTPException(404, { message: "Payment voucher not found or link has expired." });
  if (row.status === "void") throw new HTTPException(410, { message: "This payment voucher has been voided." });

  if (row.status === "sent") {
    await c.env.DB.prepare("UPDATE supplier_payment_vouchers SET status = 'viewed', viewed_at = COALESCE(viewed_at, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP WHERE token = ? AND status = 'sent'")
      .bind(token)
      .run();
    row.status = "viewed";
  }

  return c.json({ voucher: publicVoucherPayload(row) });
});

app.patch("/api/payment-vouchers/public/:token/confirm", async (c) => {
  const token = c.req.param("token");
  const body = await c.req.json();
  const row = await c.env.DB.prepare("SELECT * FROM supplier_payment_vouchers WHERE token = ?").bind(token).first<Record<string, unknown>>();
  if (!row) throw new HTTPException(404, { message: "Payment voucher not found." });
  if (row.status === "void") throw new HTTPException(410, { message: "This payment voucher has been voided." });
  if (row.status === "confirmed") throw new HTTPException(409, { message: "This payment has already been confirmed." });

  const confirmedReceipt = body.confirmedReceipt === true || body.confirmedReceipt === 1;
  if (!confirmedReceipt) throw new HTTPException(400, { message: "You must confirm receipt of payment." });

  const signerName = String(body.signerName ?? "").trim();
  if (!signerName) throw new HTTPException(400, { message: "Signer name is required." });

  const signatureMethod = String(body.signatureMethod ?? "draw").trim().toLowerCase();
  if (!["draw", "upload", "typed"].includes(signatureMethod)) {
    throw new HTTPException(400, { message: "Invalid signature method." });
  }

  let signatureDataUrl: string | null = null;
  if (signatureMethod === "typed") {
    signatureDataUrl = null;
  } else {
    signatureDataUrl = sanitizeSignatureDataUrl(body.signatureDataUrl);
    if (!signatureDataUrl) throw new HTTPException(400, { message: "Signature image is required." });
  }

  const receiptNotes = String(body.receiptNotes ?? "").trim() || null;
  const signerTitle = String(body.signerTitle ?? "").trim() || null;
  const supplierReceiptNumber = String(body.supplierReceiptNumber ?? "").trim() || null;
  let supplierReceiptDataUrl: string | null = null;
  if (body.receiptDataUrls !== undefined) {
    supplierReceiptDataUrl = sanitizeSupplierReceiptImages(body.receiptDataUrls);
  } else if (body.receiptDataUrl) {
    supplierReceiptDataUrl = sanitizeSupplierReceiptImages(body.receiptDataUrl);
  }
  const dateReceived = String(body.dateReceived ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateReceived)) {
    throw new HTTPException(400, { message: "Date received is required (YYYY-MM-DD)." });
  }
  const now = new Date().toISOString();

  await c.env.DB.prepare(
    `UPDATE supplier_payment_vouchers SET
      status = 'confirmed',
      confirmed_receipt = 1,
      signature_method = ?,
      signature_data_url = ?,
      signer_name = ?,
      signer_title = ?,
      receipt_notes = ?,
      date_received = ?,
      supplier_receipt_number = ?,
      supplier_receipt_data_url = ?,
      receipt_uploaded_at = ?,
      signed_at = ?,
      confirmed_at = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE token = ?`
  )
    .bind(
      signatureMethod,
      signatureDataUrl,
      signerName,
      signerTitle,
      receiptNotes,
      dateReceived,
      supplierReceiptNumber,
      supplierReceiptDataUrl,
      supplierReceiptDataUrl ? now : null,
      now,
      now,
      token
    )
    .run();

  const updated = await c.env.DB.prepare(
    `SELECT v.*, e.title AS event_title FROM supplier_payment_vouchers v LEFT JOIN events e ON e.id = v.event_id WHERE v.token = ?`
  )
    .bind(token)
    .first<Record<string, unknown>>();

  return c.json({ ok: true, voucher: publicVoucherPayload(updated ?? row) });
});

app.get("/api/events/:eventId/expense-report", requireRole(["admin", "staff"]), async (c) => {
  const eventId = c.req.param("eventId");
  const event = await c.env.DB.prepare("SELECT id, title, start_date, end_date, venue FROM events WHERE id = ?").bind(eventId).first<Record<string, unknown>>();
  if (!event) throw new HTTPException(404, { message: "Event not found." });

  const expenses = await c.env.DB.prepare(
    "SELECT id, supplier, category, amount, expense_type, approved, created_at FROM expenses WHERE event_id = ? ORDER BY category ASC, supplier ASC"
  )
    .bind(eventId)
    .all();

  const vouchers = await c.env.DB.prepare(
    `SELECT id, expense_id, voucher_number, payment_reference, status, supplier_name, amount, payment_method,
            payment_date, date_received, description, supplier_receipt_number, confirmed_at,
            CASE WHEN supplier_receipt_data_url IS NOT NULL AND supplier_receipt_data_url != '' THEN 1 ELSE 0 END AS has_receipt,
            CASE WHEN signature_data_url IS NOT NULL AND signature_data_url != '' THEN 1 ELSE 0 END AS has_signature
     FROM supplier_payment_vouchers WHERE event_id = ? ORDER BY voucher_number ASC`
  )
    .bind(eventId)
    .all();

  const expenseRows = expenses.results ?? [];
  const voucherRows = vouchers.results ?? [];
  const expenseTotal = expenseRows.reduce((s, r) => s + (Number((r as Record<string, unknown>).amount) || 0), 0);
  const confirmedVouchers = voucherRows.filter((r) => (r as Record<string, unknown>).status === "confirmed");
  const voucherPaidTotal = confirmedVouchers.reduce((s, r) => s + (Number((r as Record<string, unknown>).amount) || 0), 0);

  const byCategory = new Map<string, { budgeted: number; voucherPaid: number; count: number }>();
  for (const r of expenseRows) {
    const row = r as Record<string, unknown>;
    const cat = String(row.category || "Uncategorized");
    const prev = byCategory.get(cat) ?? { budgeted: 0, voucherPaid: 0, count: 0 };
    prev.budgeted += Number(row.amount) || 0;
    prev.count += 1;
    byCategory.set(cat, prev);
  }
  for (const v of confirmedVouchers) {
    const row = v as Record<string, unknown>;
    const linked = expenseRows.find((e) => (e as Record<string, unknown>).id === row.expense_id) as Record<string, unknown> | undefined;
    const cat = String(linked?.category || "Payments (unlinked)");
    const prev = byCategory.get(cat) ?? { budgeted: 0, voucherPaid: 0, count: 0 };
    prev.voucherPaid += Number(row.amount) || 0;
    byCategory.set(cat, prev);
  }

  return c.json({
    event: { id: event.id, title: event.title, startDate: event.start_date, endDate: event.end_date, venue: event.venue },
    expenses: expenseRows,
    vouchers: voucherRows,
    summary: {
      expenseLineCount: expenseRows.length,
      expenseLedgerTotal: expenseTotal,
      voucherCount: voucherRows.length,
      confirmedVoucherCount: confirmedVouchers.length,
      voucherPaidTotal,
      receiptsOnFile: voucherRows.filter((r) => Number((r as Record<string, unknown>).has_receipt) === 1).length,
      byCategory: [...byCategory.entries()].map(([category, v]) => ({ category, ...v })),
    },
    generatedAt: new Date().toISOString(),
  });
});

app.get("/api/payment-vouchers/:id/receipt", requireRole(["admin", "staff"]), async (c) => {
  const id = c.req.param("id");
  const row = await c.env.DB.prepare(
    "SELECT supplier_receipt_data_url, supplier_receipt_number, receipt_uploaded_at, voucher_number FROM supplier_payment_vouchers WHERE id = ?"
  )
    .bind(id)
    .first<Record<string, unknown>>();
  if (!row) throw new HTTPException(404, { message: "Voucher not found." });
  const receiptDataUrls = parseSupplierReceiptImages(row.supplier_receipt_data_url as string | null);
  return c.json({
    receiptDataUrls,
    receiptDataUrl: receiptDataUrls[0] ?? null,
    supplierReceiptNumber: row.supplier_receipt_number ?? null,
    receiptUploadedAt: row.receipt_uploaded_at ?? null,
    voucherNumber: row.voucher_number ?? null,
  });
});

app.get("/api/payment-vouchers/:id/signature", requireRole(["admin", "staff"]), async (c) => {
  const id = c.req.param("id");
  const row = await c.env.DB.prepare(
    `SELECT signature_data_url, signature_method, signer_name, signer_title, status,
            receipt_notes, date_received, confirmed_at, signed_at, voucher_number, supplier_name, amount
     FROM supplier_payment_vouchers WHERE id = ?`
  )
    .bind(id)
    .first<Record<string, unknown>>();
  if (!row) throw new HTTPException(404, { message: "Voucher not found." });
  return c.json({
    signatureDataUrl: row.signature_data_url ?? null,
    signatureMethod: row.signature_method ?? null,
    signerName: row.signer_name ?? null,
    signerTitle: row.signer_title ?? null,
    receiptNotes: row.receipt_notes ?? null,
    dateReceived: row.date_received ?? null,
    confirmedAt: row.confirmed_at ?? null,
    signedAt: row.signed_at ?? null,
    voucherNumber: row.voucher_number ?? null,
    supplierName: row.supplier_name ?? null,
    amount: row.amount ?? null,
    status: row.status,
  });
});

app.get("/api/events/:eventId/feedback/me", requireRole(["admin", "staff", "attendee"]), async (c) => {
  const eventId = c.req.param("eventId");
  const email = String(c.get("authUser")?.email || "").trim().toLowerCase();
  if (!email) throw new HTTPException(400, { message: "Signed-in email is required." });
  const event = await c.env.DB.prepare("SELECT id, venue FROM events WHERE id = ?").bind(eventId).first<{ id: string; venue?: string }>();
  if (!event) throw new HTTPException(404, { message: "Event not found." });
  const row = await c.env.DB.prepare("SELECT * FROM event_feedback WHERE event_id = ? AND respondent_email = ?")
    .bind(eventId, email)
    .first<Record<string, unknown>>();
  return c.json({ schema: feedbackSchemaPayload(event.venue), item: mapFeedbackRow(row) });
});

app.put("/api/events/:eventId/feedback/me", requireRole(["admin", "staff", "attendee"]), async (c) => {
  const eventId = c.req.param("eventId");
  const email = String(c.get("authUser")?.email || "").trim().toLowerCase();
  if (!email) throw new HTTPException(400, { message: "Signed-in email is required." });
  const event = await c.env.DB.prepare("SELECT id FROM events WHERE id = ?").bind(eventId).first();
  if (!event) throw new HTTPException(404, { message: "Event not found." });
  const body = (await c.req.json()) as Record<string, unknown>;
  const scores = parseFeedbackScores(body);
  const parsed = parseFeedbackResponses(body);
  const responsesJson = JSON.stringify({
    displayName: parsed.displayName,
    agency: parsed.agency,
    speakerImpact: parsed.speakerImpact,
    biggestTakeaway: parsed.biggestTakeaway,
    testimonial: parsed.testimonial,
  });
  const highlights = parsed.likedMost;
  const suggestions = parsed.suggestions;
  const profile = body.profile && typeof body.profile === "object" ? (body.profile as Record<string, unknown>) : {};
  const seededRegistrationId = String(body.seededRegistrationId ?? "").trim();
  const seededDelegateName = String(body.seededDelegateName ?? "").trim();
  const rowsRes = await c.env.DB.prepare("SELECT * FROM registrations WHERE event_id = ? ORDER BY created_at ASC").bind(eventId).all<any>();
  const candidate = findSyncCandidate((rowsRes.results || []) as any[], email, { seededRegistrationId, seededDelegateName, profile });
  const registrationId = candidate?.id ? String(candidate.id) : null;

  const existing = await c.env.DB.prepare("SELECT id FROM event_feedback WHERE event_id = ? AND respondent_email = ?")
    .bind(eventId, email)
    .first<{ id: string }>();
  const now = new Date().toISOString();
  const scoresJson = JSON.stringify(scores);
  if (existing?.id) {
    await c.env.DB
      .prepare(
        `UPDATE event_feedback SET
          scores_json = ?,
          responses_json = ?,
          highlights = ?,
          suggestions = ?,
          registration_id = COALESCE(?, registration_id),
          updated_at = ?
        WHERE id = ?`
      )
      .bind(scoresJson, responsesJson, highlights || null, suggestions || null, registrationId, now, existing.id)
      .run();
    const row = await c.env.DB.prepare("SELECT * FROM event_feedback WHERE id = ?").bind(existing.id).first<Record<string, unknown>>();
    return c.json({ ok: true, item: mapFeedbackRow(row) });
  }
  const id = crypto.randomUUID();
  await c.env.DB
    .prepare(
      `INSERT INTO event_feedback (id, event_id, registration_id, respondent_email, scores_json, responses_json, highlights, suggestions, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(id, eventId, registrationId, email, scoresJson, responsesJson, highlights || null, suggestions || null, now, now)
    .run();
  const row = await c.env.DB.prepare("SELECT * FROM event_feedback WHERE id = ?").bind(id).first<Record<string, unknown>>();
  return c.json({ ok: true, item: mapFeedbackRow(row) }, 201);
});

app.get("/api/events/:eventId/feedback/analytics", requireRole(["admin", "staff"]), async (c) => {
  const eventId = c.req.param("eventId");
  const event = await c.env.DB.prepare("SELECT id, title, start_date, end_date, venue FROM events WHERE id = ?").bind(eventId).first<Record<string, unknown>>();
  if (!event) throw new HTTPException(404, { message: "Event not found." });

  const res = await c.env.DB
    .prepare(
      "SELECT id, scores_json, responses_json, highlights, suggestions, created_at, updated_at FROM event_feedback WHERE event_id = ? ORDER BY updated_at DESC"
    )
    .bind(eventId)
    .all<Record<string, unknown>>();
  const rows = (res.results || []) as Record<string, unknown>[];
  const responseCount = rows.length;

  const distributions: Record<string, Record<number, number>> = {};
  for (const def of EVENT_FEEDBACK_RATING_SCHEMA) {
    distributions[def.key] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  }

  const parsedRows: {
    scores: Record<string, number>;
    suggestions: string;
    highlights: string;
    speakerImpact: string;
    biggestTakeaway: string;
    testimonial: string;
  }[] = [];
  let conferenceSum = 0;
  let conferenceN = 0;

  for (const r of rows) {
    const scores = parseMetadataJson(r.scores_json) as Record<string, number>;
    const responses = parseStoredFeedbackResponses(r);
    parsedRows.push({
      scores,
      suggestions: String(r.suggestions || ""),
      highlights: String(r.highlights || ""),
      speakerImpact: responses.speakerImpact,
      biggestTakeaway: responses.biggestTakeaway,
      testimonial: responses.testimonial,
    });
    for (const [key, v0] of Object.entries(scores)) {
      const v = Math.round(Number(v0));
      if (v < 1 || v > 5) continue;
      if (!distributions[key]) distributions[key] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      distributions[key][v] += 1;
      if (key === "conference_proper") {
        conferenceSum += v;
        conferenceN += 1;
      }
    }
  }

  const ratingKeys = new Set([...EVENT_FEEDBACK_RATING_SCHEMA.map((d) => d.key), ...Object.keys(distributions)]);
  const averages = [...ratingKeys].map((key) => {
    const dist = distributions[key] || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let sum = 0;
    let n = 0;
    for (let star = 1; star <= 5; star++) {
      const count = dist[star] || 0;
      sum += star * count;
      n += count;
    }
    const cur = EVENT_FEEDBACK_RATING_SCHEMA.find((d) => d.key === key);
    let label = cur?.label ?? feedbackLabelForKey(key);
    if (key === "hotel_venue" && event.venue) {
      label = `Hotel & venue (${event.venue})`;
    }
    return { key, label, step: cur?.step ?? 2, average: n ? Math.round((sum / n) * 100) / 100 : 0, count: n, legacy: !cur };
  });

  const overallAverage = conferenceN ? Math.round((conferenceSum / conferenceN) * 100) / 100 : 0;

  const recentSuggestions = rows
    .map((r) => String(r.suggestions || "").trim())
    .filter((t) => t.length > 0)
    .slice(0, 25)
    .map((t) => (t.length > 360 ? `${t.slice(0, 357)}…` : t));

  const recentTestimonials = rows
    .map((r) => parseStoredFeedbackResponses(r).testimonial.trim())
    .filter((t) => t.length > 0)
    .slice(0, 15)
    .map((t) => (t.length > 360 ? `${t.slice(0, 357)}…` : t));

  const suggestionInsights = buildFeedbackSuggestionInsights(responseCount, parsedRows);
  const filteredAverages = averages.filter((a) => a.count > 0).sort((a, b) => (a.legacy === b.legacy ? 0 : a.legacy ? 1 : -1));
  const executiveSummary = buildFeedbackExecutiveSummary(filteredAverages, responseCount, overallAverage);

  return c.json({
    event: { id: event.id, title: event.title, startDate: event.start_date, endDate: event.end_date, venue: event.venue },
    schema: feedbackSchemaPayload(event.venue as string | undefined),
    responseCount,
    overallAverage,
    overallLabel: "Conference proper (avg)",
    averages: filteredAverages,
    distributions,
    recentSuggestions,
    recentTestimonials,
    suggestionInsights,
    executiveSummary,
    evaluationSurveyUrl: "/evaluation",
    generatedAt: new Date().toISOString(),
  });
});

app.post("/api/events/:eventId/feedback/ai-strategy", requireRole(["admin", "staff"]), async (c) => {
  const eventId = c.req.param("eventId");
  const event = await c.env.DB.prepare("SELECT id, title, venue FROM events WHERE id = ?").bind(eventId).first<Record<string, unknown>>();
  if (!event) throw new HTTPException(404, { message: "Event not found." });

  const res = await c.env.DB.prepare(
    "SELECT scores_json, responses_json, highlights, suggestions FROM event_feedback WHERE event_id = ? ORDER BY updated_at DESC"
  )
    .bind(eventId)
    .all<Record<string, unknown>>();
  const rows = (res.results || []) as Record<string, unknown>[];
  const responseCount = rows.length;
  if (responseCount < 1) {
    throw new HTTPException(400, { message: "At least one feedback response is required before generating AI strategy." });
  }

  const distributions: Record<string, Record<number, number>> = {};
  for (const def of EVENT_FEEDBACK_RATING_SCHEMA) {
    distributions[def.key] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  }
  const parsedRows: {
    scores: Record<string, number>;
    suggestions: string;
    highlights: string;
    speakerImpact: string;
    biggestTakeaway: string;
    testimonial: string;
  }[] = [];
  let conferenceSum = 0;
  let conferenceN = 0;

  for (const r of rows) {
    const scores = parseMetadataJson(r.scores_json) as Record<string, number>;
    const responses = parseStoredFeedbackResponses(r);
    parsedRows.push({
      scores,
      suggestions: String(r.suggestions || ""),
      highlights: String(r.highlights || ""),
      speakerImpact: responses.speakerImpact,
      biggestTakeaway: responses.biggestTakeaway,
      testimonial: responses.testimonial,
    });
    for (const [key, v0] of Object.entries(scores)) {
      const v = Math.round(Number(v0));
      if (v < 1 || v > 5) continue;
      if (key === "conference_proper") {
        conferenceSum += v;
        conferenceN += 1;
      }
    }
  }

  const overallAverage = conferenceN ? Math.round((conferenceSum / conferenceN) * 100) / 100 : 0;
  const ratingKeys = new Set([...EVENT_FEEDBACK_RATING_SCHEMA.map((d) => d.key)]);
  const averages: FeedbackAverageRow[] = [...ratingKeys].map((key) => {
    let sum = 0;
    let n = 0;
    for (const row of parsedRows) {
      const v = Math.round(Number(row.scores[key]));
      if (v >= 1 && v <= 5) {
        sum += v;
        n += 1;
      }
    }
    const cur = EVENT_FEEDBACK_RATING_SCHEMA.find((d) => d.key === key);
    let label = cur?.label ?? feedbackLabelForKey(key);
    if (key === "hotel_venue" && event.venue) label = `Hotel & venue (${event.venue})`;
    return { key, label, average: n ? Math.round((sum / n) * 100) / 100 : 0, count: n, legacy: !cur };
  });
  const filteredAverages = averages.filter((a) => a.count > 0);
  const suggestionInsights = buildFeedbackSuggestionInsights(responseCount, parsedRows);
  const executiveSummary = buildFeedbackExecutiveSummary(filteredAverages, responseCount, overallAverage);
  const recentSuggestions = rows.map((r) => String(r.suggestions || "").trim()).filter((t) => t.length > 5);
  const recentTestimonials = rows.map((r) => parseStoredFeedbackResponses(r).testimonial.trim()).filter((t) => t.length > 5);
  const speakerSnippets = parsedRows.map((r) => r.speakerImpact).filter((t) => t.length > 10);

  const eventTitle = String(event.title || "PAMACON");
  const apiKey = String(c.env.GEMINI_API_KEY || "").trim();
  const model = String(c.env.GEMINI_MODEL || "gemini-2.0-flash").trim();

  if (apiKey) {
    try {
      const prompt = buildFeedbackAiPrompt(
        eventTitle,
        executiveSummary,
        filteredAverages,
        suggestionInsights,
        recentSuggestions,
        recentTestimonials
      );
      const report = await callGeminiFeedbackStrategy(apiKey, model, prompt);
      const actionItems = parseActionItemsFromAiReport(report);
      return c.json({
        source: "gemini",
        model,
        report,
        themeSuggestion: null,
        strengths: [],
        improvements: [],
        actionItems: actionItems.length ? actionItems : buildPamaconYearAheadPlan(eventTitle, executiveSummary, suggestionInsights, speakerSnippets).actionItems,
        executiveSummary,
        generatedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error("Gemini strategy generation failed:", err);
    }
  }

  const rules = buildPamaconYearAheadPlan(eventTitle, executiveSummary, suggestionInsights, speakerSnippets);
  return c.json({
    source: "rules",
    model: null,
    report: rules.narrative,
    themeSuggestion: rules.themeSuggestion,
    strengths: rules.strengths,
    improvements: rules.improvements,
    actionItems: rules.actionItems,
    executiveSummary,
    generatedAt: new Date().toISOString(),
  });
});

app.onError((err, c) => {
  console.error(err);
  if (err instanceof HTTPException) {
    return err.getResponse();
  }
  const message = err instanceof Error ? err.message : String(err);
  return c.json({ message: message || "Internal Server Error" }, 500);
});

export default app;
