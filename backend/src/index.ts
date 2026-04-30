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
    const verified = await jwtVerify(token, jwks, issuer ? { issuer } : undefined);
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

app.put("/api/admin/user-roles", requireRole(["admin"]), async (c) => {
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
  const body = await c.req.json();
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
      body.config ? JSON.stringify(body.config) : null,
      id
    )
    .run();
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
  const isSeedFlagged = String(meta.seedSource || "") === "pamacon-seed";
  const isNameMatchedSeed = Boolean(providedSeededName && rowName && providedSeededName === rowName);
  const isAlreadyClaimedBySameAttendee = Boolean(claimedBy && claimedBy === email);
  if (!isSeedFlagged && !isNameMatchedSeed && !isAlreadyClaimedBySameAttendee) {
    throw new HTTPException(400, { message: "Only seeded delegates can be claimed through this flow." });
  }

  if (claimedBy && claimedBy !== email) {
    throw new HTTPException(409, { message: "This seeded delegate has already been claimed." });
  }

  const nextMeta = {
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
    applyText("shirtSize");
    applyText("shirtSizeOther");
    applyText("arrivalCebu");
    applyText("departureCebu");
    applyText("extraOtherRequest");
    if (p.age !== undefined && p.age !== null) nextMeta.age = String(p.age).trim();
    if (p.extraIslandHopping !== undefined) nextMeta.extraIslandHopping = Boolean(p.extraIslandHopping);
    if (p.extraCityTour !== undefined) nextMeta.extraCityTour = Boolean(p.extraCityTour);
    if (p.extraMountainTour !== undefined) nextMeta.extraMountainTour = Boolean(p.extraMountainTour);
    if (p.extraSafari !== undefined) nextMeta.extraSafari = Boolean(p.extraSafari);
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
    if (joined) nextFullName = joined;
  }

  await c.env.DB.prepare("UPDATE registrations SET metadata_json = ?, attendee_type = COALESCE(?, attendee_type), full_name = COALESCE(?, full_name) WHERE id = ?")
    .bind(JSON.stringify(nextMeta), nextAttendeeType, nextFullName, id)
    .run();
  const item = await c.env.DB.prepare("SELECT * FROM registrations WHERE id = ?").bind(id).first();
  return c.json({ item });
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
    `INSERT INTO registrations (id, event_id, full_name, attendee_type, status, total_fee, paid_amount, payment_plan, metadata_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      eventId,
      body.fullName ?? "Unnamed",
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
      metadata_json = COALESCE(?, metadata_json)
    WHERE id = ?`
  )
    .bind(
      body.fullName ?? null,
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
  await c.env.DB.prepare("UPDATE registrations SET status = 'checked-in', checked_in_at = CURRENT_TIMESTAMP WHERE id = ?").bind(id).run();
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

  await c.env.DB.prepare("UPDATE registrations SET paid_amount = ?, status = CASE WHEN ? >= total_fee THEN 'registered' ELSE status END WHERE id = ?")
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
      "INSERT INTO registrations (id, event_id, full_name, attendee_type, status, total_fee, paid_amount, payment_plan) VALUES (?, ?, ?, ?, 'pre-registered', 0, 0, 'full')"
    )
      .bind(regId, invitation.event_id, invitation.full_name ?? invitation.email, invitation.invitation_type ?? "Standard")
      .run();
  }
  return c.json({ ok: true, status });
});

export default app;
