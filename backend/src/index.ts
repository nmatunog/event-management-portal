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

app.onError((err, c) => {
  console.error(err);
  if (err instanceof HTTPException) {
    return err.getResponse();
  }
  const message = err instanceof Error ? err.message : String(err);
  return c.json({ message: message || "Internal Server Error" }, 500);
});

export default app;
