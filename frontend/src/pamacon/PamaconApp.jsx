import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Layout,
  Hotel,
  CreditCard,
  BarChart3,
  Handshake,
  Mic,
  Truck,
  TrendingUp,
  DollarSign,
  Users,
  Save,
  Edit3,
  Settings,
  Trash2,
  Search,
  Sparkles,
  Volume2,
  Tv,
  ArrowRightLeft,
  UserPlus,
  Bed,
  Menu,
  X,
  UtensilsCrossed,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Filter,
  Plus,
  ListPlus,
  FileText,
  ClipboardPaste,
  LogOut,
  UserRound,
} from "lucide-react";
import ParticipantPortal from "./ParticipantPortal";
import {
  createEvent,
  createExpense,
  createRegistration,
  createSpeaker,
  createSponsor,
  deleteUserRole,
  deleteExpense,
  deleteSpeaker,
  deleteSponsor,
  getEvents,
  getExpenses,
  getRegistrations,
  deleteRegistration,
  getUserRoles,
  getSpeakers,
  getSponsors,
  harmonizeRegistrations,
  patchEvent,
  patchRegistration,
  patchSpeaker,
  upsertUserRole,
} from "../lib/api";
import {
  DEFAULT_EXPENSE_BUDGET_MODULES,
  DEFAULT_PAMACON_CONFIG,
  DEFAULT_PROGRAM_MODULES,
  mergeConfigFromEvent,
  PAMACON_TITLE,
} from "./defaultConfig";
import { buildRoomAssignments, isExcludedFromRoomAssignments } from "./rooming";
import { formatPositionShort, positionBadgeClass, POSITION_CODES } from "./positionCodes";
import { PAMACON_SEED_EXPENSES } from "./seedExpenses";
import { inferSeedRole, modeToPaymentPlan, PAMACON_SEED_DELEGATES } from "./seedDelegates";
import { parseSeedListOcrRows } from "./parseSeedListOcrRows";
import ProfileModule from "../components/ProfileModule";

/** Survives React Strict Mode remount (useRef resets); blocks a second full seed while the DB is still empty. */
const delegateSeedStartedForEventId = new Set();

function parseMeta(row) {
  if (!row?.metadata_json) return {};
  try {
    return JSON.parse(row.metadata_json);
  } catch {
    return {};
  }
}

const SEED_DELEGATE_NAME_SET = new Set(
  PAMACON_SEED_DELEGATES.map((d) => String(d.name || "").trim().toLowerCase())
);

/** Seeded committee list rows (by metadata flag or known seed names). */
function isSeededDelegateRow(r) {
  if (!r) return false;
  if (
    r.seedSource === "pamacon-seed" ||
    r.seedSource === "pamacon-seed-ocr" ||
    r.seedSource === "pamacon-seed-text" ||
    r.seedSource === "pamacon-seed-manual"
  )
    return true;
  return SEED_DELEGATE_NAME_SET.has(String(r.name || "").trim().toLowerCase());
}

function delegateFromApi(row) {
  const meta = parseMeta(row);
  const nameParts = String(row.full_name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const inferredLast = String(meta.lastName || (nameParts.length ? nameParts[nameParts.length - 1] : "")).trim();
  const inferredFirst = String(meta.firstName || (nameParts.length ? nameParts[0] : "")).trim();
  const inferredMiddle =
    String(meta.middleName || "")
      .trim() ||
    (nameParts.length > 2 ? nameParts.slice(1, -1).join(" ") : "");
  const normalizedGenderRaw = String(meta.gender || "").trim().toLowerCase();
  const normalizedGender =
    normalizedGenderRaw === "male"
      ? "Male"
      : normalizedGenderRaw === "female"
      ? "Female"
      : normalizedGenderRaw === "other" || normalizedGenderRaw === "unspecified"
      ? "Unspecified"
      : "Unspecified";
  const roleSource = String(meta.positionCode || row.attendee_type || "").trim();
  const mode = row.payment_plan === "installment" ? "Installment" : row.payment_plan === "partial" ? "Partial" : "Full";
  return {
    id: row.id,
    name: row.full_name,
    firstName: inferredFirst,
    middleName: inferredMiddle,
    lastName: inferredLast,
    role: formatPositionShort(roleSource),
    gender: normalizedGender,
    totalFee: Number(row.total_fee || 0),
    paid: Number(row.paid_amount || 0),
    mode,
    status: row.status || "pre-registered",
    remarks: typeof meta.remarks === "string" ? meta.remarks : "",
    solo: Boolean(meta.solo),
    manualPairId: meta.manualPairId || null,
    metaBase: { ...meta },
    seedSource: meta.seedSource || "",
    staffClaimEmail: meta.staffClaimEmail || "",
    staffClaimAt: meta.staffClaimAt || "",
    attendeeClaimEmail: meta.attendeeClaimEmail || "",
    attendeeClaimedAt: meta.attendeeClaimedAt || "",
    nickname: meta.nickname || "",
    shirtSize: meta.shirtSize || "",
    tshirtClaimed: Boolean(meta.tshirtClaimed),
    conferenceKitClaimed: Boolean(meta.conferenceKitClaimed),
  };
}

const SetupInput = ({ label, ...props }) => (
  <div className="space-y-2">
    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 leading-none">{label}</label>
    <input
      {...props}
      className="w-full bg-white border-2 border-slate-100 rounded-2xl px-5 py-3 text-sm font-black text-slate-700 focus:outline-none focus:border-red-400 transition-all shadow-sm"
    />
  </div>
);

function AdminHomeOverview({
  config,
  totalExp,
  collections,
  regCount,
  sponsorRev,
  projection,
  onNavigate,
}) {
  const gap = projection - collections;
  const surplus = collections - totalExp;
  const sponsorPct = collections > 0 ? Math.round((sponsorRev / collections) * 100) : 0;
  const delegateBaselineFee = 8000;
  const delegateRevenueNeeded = Math.max(0, (Number(totalExp) || 0) - (Number(sponsorRev) || 0));
  const breakEvenDelegates = Math.ceil(delegateRevenueNeeded / delegateBaselineFee);
  const delegatesToGo = Math.max(0, breakEvenDelegates - (Number(regCount) || 0));

  const shortcuts = [
    { id: "registration", title: "Delegates", desc: "Payments & roles", icon: Users, group: "People" },
    { id: "accommodation", title: "Rooming", desc: "Pairs & solo rooms", icon: Hotel, group: "People" },
    { id: "sponsorship", title: "Sponsorship", desc: "Partners & tiers", icon: Handshake, group: "Partners" },
    { id: "speakers", title: "Speakers", desc: "Honoraria & slots", icon: Mic, group: "Partners" },
    { id: "suppliers", title: "Suppliers", desc: "Vendor spend", icon: Truck, group: "Partners" },
    { id: "expenses", title: "Budget", desc: "Limits vs actuals", icon: BarChart3, group: "Finance" },
  ];

  return (
    <div className="space-y-10">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatBox label="Total realized" value={`₱${((collections || 0) / 1000).toFixed(1)}k`} sub={`Sponsors ₱${((sponsorRev || 0) / 1000).toFixed(1)}k`} icon={PesoIcon} color="red" />
        <StatBox label="Delegates on file" value={regCount} sub={`Goal ${config.targetRegistrants}`} icon={Users} color="blue" />
        <StatBox label="Revenue projection" value={`₱${((projection || 0) / 1000).toFixed(0)}k`} sub="Target × 8k + sponsors" icon={TrendingUp} color="emerald" />
        <StatBox label="Spend outlook" value={`₱${((totalExp || 0) / 1000).toFixed(1)}k`} sub="Recorded expenses" icon={BarChart3} color="rose" />
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Financial snapshot</h3>
        <p className="text-sm text-slate-500 mt-1">Core numbers the committee usually asks for first.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mt-8">
          <div className="rounded-2xl bg-slate-50 border border-slate-100 p-6">
            <p className="text-xs font-medium text-slate-500">Gap to projection</p>
            <p className="text-2xl font-semibold text-red-600 mt-2 tabular-nums">₱{gap.toLocaleString()}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 border border-slate-100 p-6">
            <p className="text-xs font-medium text-slate-500">Surplus vs commitments</p>
            <p className="text-2xl font-semibold text-emerald-600 mt-2 tabular-nums">₱{surplus.toLocaleString()}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 border border-slate-100 p-6">
            <p className="text-xs font-medium text-slate-500">Share from sponsors</p>
            <p className="text-2xl font-semibold text-indigo-600 mt-2 tabular-nums">{sponsorPct}%</p>
          </div>
          <div className="rounded-2xl bg-slate-50 border border-slate-100 p-6">
            <p className="text-xs font-medium text-slate-500">Break-even delegates</p>
            <p className="text-2xl font-semibold text-slate-900 mt-2 tabular-nums">{breakEvenDelegates.toLocaleString()}</p>
            <p className="text-xs text-slate-500 mt-2">
              {breakEvenDelegates === 0
                ? "Sponsors currently cover projected expenses."
                : `${delegatesToGo.toLocaleString()} more needed at ₱${delegateBaselineFee.toLocaleString()}/delegate baseline.`}
            </p>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-slate-900 mb-2">Where to go next</h3>
        <p className="text-sm text-slate-500 mb-6">Pick one area — each screen has a single job.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {shortcuts.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onNavigate(s.id)}
              className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-red-200 hover:bg-red-50/30"
            >
              <div className="shrink-0 w-11 h-11 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
                <s.icon size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{s.group}</p>
                <p className="font-semibold text-slate-900 mt-0.5">{s.title}</p>
                <p className="text-sm text-slate-500 mt-1">{s.desc}</p>
              </div>
              <ChevronRight className="shrink-0 text-slate-300 mt-1" size={18} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const PesoIcon = ({ size = 22 }) => (
  <span
    style={{ fontSize: `${size}px`, lineHeight: 1 }}
    className="font-black select-none"
    aria-hidden="true"
  >
    ₱
  </span>
);

const StatBox = ({ label, value, sub, icon: Icon, color }) => {
  const tone = { red: "bg-red-50 text-red-600", blue: "bg-blue-50 text-blue-600", emerald: "bg-emerald-50 text-emerald-600", rose: "bg-rose-50 text-rose-600" }[color] || "bg-slate-50 text-slate-600";
  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm group hover:border-red-100 transition-all">
      <div className={`w-11 h-11 ${tone} rounded-xl flex items-center justify-center mb-4`}>
        <Icon size={22} />
      </div>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="text-2xl font-semibold text-slate-900 mt-2 tabular-nums tracking-tight">{value}</p>
      <p className="text-xs text-slate-400 mt-2">{sub}</p>
    </div>
  );
};

const SECTION_COPY = {
  dashboard: { title: "Overview", subtitle: "Key metrics and shortcuts" },
  registration: { title: "Delegates", subtitle: "Convention registration list" },
  accommodation: { title: "Room assignments", subtitle: "Pairing and solo occupancy" },
  program: { title: "Program modules", subtitle: "Agenda blocks, timings, and assignments" },
  sponsorship: { title: "Sponsorship", subtitle: "Partners and commitments" },
  speakers: { title: "Speakers & talent", subtitle: "Talks and honoraria" },
  suppliers: { title: "Suppliers & contractors", subtitle: "Vendor spend by category" },
  payments: { title: "Payments & rules", subtitle: "Installments and revenue bridge" },
  expenses: { title: "Budget vs actual", subtitle: "Expense lines against limits" },
  setup: { title: "Event setup", subtitle: "Targets, rates, and projections" },
  profile: { title: "View profile", subtitle: "Personal account information" },
};

const NAV_GROUPS = [
  {
    label: "Start here",
    items: [{ id: "dashboard", label: "Overview", icon: Layout }],
  },
  {
    label: "People & rooms",
    items: [
      { id: "registration", label: "Delegates", icon: Users },
      { id: "accommodation", label: "Rooming", icon: Hotel },
    ],
  },
  {
    label: "Partners & program",
    items: [
      { id: "program", label: "Program", icon: Layout },
      { id: "sponsorship", label: "Sponsorship", icon: Handshake },
      { id: "speakers", label: "Speakers", icon: Mic },
      { id: "suppliers", label: "Suppliers", icon: Truck },
    ],
  },
  {
    label: "Finance",
    items: [
      { id: "payments", label: "Payments", icon: CreditCard },
      { id: "expenses", label: "Budget", icon: BarChart3 },
    ],
  },
  {
    label: "Configuration",
    items: [
      { id: "setup", label: "Event setup", icon: Settings },
      { id: "profile", label: "View profile", icon: Users },
    ],
  },
];

export default function PamaconApp({ canEdit, authEmail, authRole, isSuperuser = false, profile, onSaveProfile, profileSaving, onApiInfo, onApiError, onLogout }) {
  const [activeTab, setActiveTab] = useState("dashboard");
  /** When `attendee`, committee users preview the same portal delegates see. */
  const [committeePortalView, setCommitteePortalView] = useState("admin");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [eventId, setEventId] = useState(null);
  const [config, setConfig] = useState(DEFAULT_PAMACON_CONFIG);
  const [registrants, setRegistrants] = useState([]);
  const [sponsors, setSponsors] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [speakers, setSpeakers] = useState([]);
  const [eventRecord, setEventRecord] = useState(null);
  const isAdmin = authRole === "admin";

  const reloadAll = useCallback(async () => {
    if (!eventId) return;
    try {
      const [regRes, spRes, exRes, spkRes] = await Promise.all([
        getRegistrations(eventId),
        getSponsors(eventId),
        getExpenses(eventId),
        getSpeakers(eventId),
      ]);
      setRegistrants((regRes.items || []).map(delegateFromApi));
      setSponsors(
        (spRes.items || []).map((s) => ({
          id: s.id,
          company: s.company,
          tier: s.tier,
          amount: Number(s.amount || 0),
          remarks: s.remarks || "Uncollected",
        }))
      );
      setSuppliers(
        (exRes.items || []).map((e) => ({
          id: e.id,
          company: e.supplier,
          category: e.category,
          amount: Number(e.amount || 0),
        }))
      );
      setSpeakers(
        (spkRes.items || []).map((s) => ({
          id: s.id,
          talk: s.talk || "",
          name: s.name || "",
          topic: s.topic || "",
          classification: s.classification || "Others",
          honorarium: Number(s.honorarium || 0),
        }))
      );
    } catch (e) {
      onApiError?.(e, "Failed to load PAMACON data.");
    }
  }, [eventId, onApiError]);

  const persistSeededListScreenshot = useCallback(
    async (dataUrl) => {
      if (!eventId || !isSuperuser) return;
      const nextConfig = { ...config, seededListScreenshotDataUrl: String(dataUrl ?? "") };
      try {
        await patchEvent(eventId, {
          attendeeGoal: config.targetRegistrants,
          config: nextConfig,
        });
        setConfig(nextConfig);
        onApiInfo?.("Reference list screenshot saved.");
      } catch (e) {
        onApiError?.(e, "Could not save reference screenshot.");
      }
    },
    [eventId, isSuperuser, config, onApiInfo, onApiError]
  );

  const importSeedListParsedRows = useCallback(
    async (parsed, seedSource) => {
      if (!eventId || !isSuperuser || !parsed?.length) return { added: 0, skipped: 0, lineCount: 0 };
      const { items } = await getRegistrations(eventId);
      const existingNames = new Set(
        (items || []).map((r) => String(r.full_name || "").trim().toLowerCase()).filter(Boolean)
      );

      let added = 0;
      let skipped = 0;
      for (const row of parsed) {
        const fullName = String(row.fullName || "").trim();
        if (!fullName) continue;
        const key = fullName.toLowerCase();
        if (existingNames.has(key)) {
          skipped += 1;
          continue;
        }
        const parts = fullName.split(/\s+/).filter(Boolean);
        const firstName = parts[0] || "";
        const lastName = String(row.lastName || parts[parts.length - 1] || "").trim();
        const middleName = parts.length > 2 ? parts.slice(1, -1).join(" ") : "";
        const role = inferSeedRole(row.paid);
        const totalFee = row.mode === "Installment" ? 8550 : row.paid;

        await createRegistration(eventId, {
          fullName,
          attendeeType: role,
          status: "registered",
          totalFee,
          paidAmount: row.paid,
          paymentPlan: modeToPaymentPlan(row.mode),
          metadata: {
            seedSource,
            firstName,
            middleName,
            lastName,
            gender: row.gender || "Unspecified",
            solo: Boolean(row.solo),
            manualPairId: null,
            remarks: row.remarks ?? "",
          },
        });
        existingNames.add(key);
        added += 1;
      }

      await reloadAll();
      return { added, skipped, lineCount: parsed.length };
    },
    [eventId, isSuperuser, reloadAll]
  );

  const importSeedListFromText = useCallback(
    async (rawText) => {
      if (!eventId || !isSuperuser) return;
      try {
        const normalized = String(rawText || "")
          .replace(/^\uFEFF/, "")
          .replace(/\r\n/g, "\n");
        const parsed = parseSeedListOcrRows(normalized);
        if (parsed.length === 0) {
          onApiInfo?.(
            "No participant lines were found in that text. Use one person per line (e.g. “49. Jane Doe - 2.85k (1/3)” or “Jane Doe 8.5k”).",
            "warn"
          );
          return;
        }
        const { added, skipped, lineCount } = await importSeedListParsedRows(parsed, "pamacon-seed-text");
        onApiInfo?.(
          `List import: ${added} delegate(s) added, ${skipped} already on file (${lineCount} line(s) from text). Review the table for accuracy.`,
          "ok"
        );
      } catch (e) {
        onApiError?.(e, "Could not import delegates from pasted or uploaded text.");
        await reloadAll();
      }
    },
    [eventId, isSuperuser, importSeedListParsedRows, onApiInfo, onApiError, reloadAll]
  );

  const processReferenceScreenshot = useCallback(
    async (file, dataUrl) => {
      if (!eventId || !isSuperuser || !file) return;
      const nextConfig = { ...config, seededListScreenshotDataUrl: String(dataUrl ?? "") };
      try {
        await patchEvent(eventId, {
          attendeeGoal: config.targetRegistrants,
          config: nextConfig,
        });
        setConfig(nextConfig);
        onApiInfo?.("Image saved. Reading names from the screenshot (OCR)…", "ok");

        const { createWorker } = await import("tesseract.js");
        const worker = await createWorker("eng");
        let text = "";
        try {
          await worker.setParameters({ tessedit_pageseg_mode: "6" });
          const result = await worker.recognize(file);
          text = result?.data?.text || "";
        } finally {
          await worker.terminate();
        }

        const parsed = parseSeedListOcrRows(text);
        if (parsed.length === 0) {
          onApiInfo?.(
            "No participant lines were detected from the image. Try a clearer crop, paste the list as text instead, or add delegates manually.",
            "warn"
          );
          await reloadAll();
          return;
        }

        const { added, skipped, lineCount } = await importSeedListParsedRows(parsed, "pamacon-seed-ocr");
        onApiInfo?.(
          `List import: ${added} delegate(s) added, ${skipped} already on file (${lineCount} line(s) from image). OCR may misread names—please review the table.`,
          "ok"
        );
      } catch (e) {
        onApiError?.(e, "Could not save reference image or import delegates from the screenshot.");
        await reloadAll();
      }
    },
    [eventId, isSuperuser, config, onApiInfo, onApiError, reloadAll, importSeedListParsedRows]
  );

  const runHarmonizationSync = useCallback(async () => {
    if (!eventId || !canEdit || !isAdmin) return;
    try {
      const res = await harmonizeRegistrations(eventId);
      await reloadAll();
      const merged = Number(res?.merged || 0);
      const removed = Number(res?.removed || 0);
      if (!merged && !removed) {
        onApiInfo?.("Harmonization sync complete. No duplicates found.", "ok");
        return;
      }
      onApiInfo?.(`Harmonization sync complete: ${merged} duplicate group(s) merged, ${removed} duplicate row(s) removed.`, "ok");
    } catch (e) {
      onApiError?.(e, "Could not run harmonization sync.");
    }
  }, [eventId, canEdit, isAdmin, reloadAll, onApiInfo, onApiError]);

  const toggleDelegateStaffClaim = useCallback(
    async (r) => {
      if (!canEdit || !isSeededDelegateRow(r)) return;
      const base = { ...(r.metaBase || {}) };
      const me = String(authEmail || "").trim().toLowerCase();
      const cur = String(base.staffClaimEmail || "").trim().toLowerCase();
      if (cur && cur === me) {
        delete base.staffClaimEmail;
        delete base.staffClaimAt;
      } else if (cur && cur !== me) {
        onApiInfo?.(`This seed delegate is already claimed by ${base.staffClaimEmail}.`, "warn");
        return;
      } else {
        base.staffClaimEmail = authEmail;
        base.staffClaimAt = new Date().toISOString();
      }
      try {
        await patchRegistration(r.id, { metadata: base });
        await reloadAll();
        onApiInfo?.(cur === me ? "Released your claim on this delegate." : "You claimed this delegate for follow-up.");
      } catch (e) {
        onApiError?.(e, "Could not update committee claim.");
      }
    },
    [authEmail, canEdit, reloadAll, onApiInfo, onApiError]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const pinned = import.meta.env.VITE_PAMACON_EVENT_ID;
        const { items } = await getEvents();
        let ev = items.find((x) => x.title?.includes("PAMACON 2026"));
        if (pinned) ev = items.find((x) => x.id === pinned) || ev;
        if (!ev && canEdit) {
          const created = await createEvent({
            title: PAMACON_TITLE,
            venue: "Waterfront Cebu Hotel and Casino",
            startDate: "2026-05-13",
            endDate: "2026-05-15",
            organizer: "PAMACON Committee",
            attendeeGoal: DEFAULT_PAMACON_CONFIG.targetRegistrants,
            budgetGoal: 0,
            config: DEFAULT_PAMACON_CONFIG,
          });
          ev = created.item;
        }
        if (cancelled) return;
        if (!ev) {
          setEventId(null);
          setEventRecord(null);
          setConfig(DEFAULT_PAMACON_CONFIG);
          return;
        }
        setEventId(ev.id);
        setEventRecord(ev);
        setConfig(mergeConfigFromEvent(ev));
      } catch (e) {
        onApiError?.(e, "Could not initialize PAMACON 2026 workspace.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [onApiError, canEdit]);

  useEffect(() => {
    reloadAll();
  }, [reloadAll]);

  const sponsorRevenueTotal = useMemo(() => sponsors.reduce((s, x) => s + (Number(x.amount) || 0), 0), [sponsors]);
  const delegateRevenueActual = useMemo(() => registrants.reduce((s, x) => s + (Number(x.paid) || 0), 0), [registrants]);
  const totalRevenueProjection = useMemo(
    () => Number(config.targetRegistrants) * 8000 + sponsorRevenueTotal,
    [config.targetRegistrants, sponsorRevenueTotal]
  );
  const totalRealizedRevenueValue = useMemo(
    () => sponsorRevenueTotal + delegateRevenueActual,
    [sponsorRevenueTotal, delegateRevenueActual]
  );
  const totalSupplierSpend = useMemo(() => suppliers.reduce((s, x) => s + (Number(x.amount) || 0), 0), [suppliers]);
  const totalSpeakerHonorarium = useMemo(() => speakers.reduce((s, x) => s + (Number(x.honorarium) || 0), 0), [speakers]);
  const hasSpeakerExpenseRows = useMemo(
    () => suppliers.some((x) => String(x.category || "").trim().toLowerCase() === "speakers & talent"),
    [suppliers]
  );
  const totalExpenditure = useMemo(() => {
    // Spend outlook should reflect recorded expense rows. Add speaker module only when speakers are not already tracked as expenses.
    return totalSupplierSpend + (hasSpeakerExpenseRows ? 0 : totalSpeakerHonorarium);
  }, [totalSupplierSpend, totalSpeakerHonorarium, hasSpeakerExpenseRows]);

  const updateRegistrantRecord = async (u) => {
    const prev = u.metaBase && typeof u.metaBase === "object" ? { ...u.metaBase } : {};
    const meta = {
      ...prev,
      firstName: u.firstName ?? "",
      middleName: u.middleName ?? "",
      lastName: u.lastName ?? "",
      nickname: u.nickname ?? prev.nickname ?? "",
      shirtSize: u.shirtSize ?? prev.shirtSize ?? "",
      tshirtClaimed: Boolean(u.tshirtClaimed ?? prev.tshirtClaimed),
      conferenceKitClaimed: Boolean(u.conferenceKitClaimed ?? prev.conferenceKitClaimed),
      gender: u.gender ?? "Unspecified",
      solo: u.solo,
      manualPairId: u.manualPairId,
      remarks: u.remarks ?? "",
    };
    await patchRegistration(u.id, {
      fullName: u.name,
      attendeeType: u.role,
      status: u.status,
      totalFee: u.totalFee,
      paidAmount: u.paid,
      paymentPlan: modeToPaymentPlan(u.mode),
      metadata: meta,
    });
    await reloadAll();
  };

  const createRegistrantRecord = async (u) => {
    if (!eventId) return;
    await createRegistration(eventId, {
      fullName: u.name,
      attendeeType: u.role,
      status: u.status ?? "pre-registered",
      totalFee: u.totalFee,
      paidAmount: u.paid,
      paymentPlan: modeToPaymentPlan(u.mode),
      metadata: {
        firstName: u.firstName ?? "",
        middleName: u.middleName ?? "",
        lastName: u.lastName ?? "",
        nickname: u.nickname ?? "",
        shirtSize: u.shirtSize ?? "",
        tshirtClaimed: Boolean(u.tshirtClaimed),
        conferenceKitClaimed: Boolean(u.conferenceKitClaimed),
        gender: u.gender ?? "Unspecified",
        solo: Boolean(u.solo),
        manualPairId: null,
        remarks: u.remarks ?? "",
      },
    });
    await reloadAll();
  };

  const addRegistrantToSeededList = useCallback(
    async (r) => {
      if (!canEdit || !r?.id || isSeededDelegateRow(r)) return;
      const prev = r.metaBase && typeof r.metaBase === "object" ? { ...r.metaBase } : {};
      const meta = {
        ...prev,
        firstName: r.firstName ?? "",
        middleName: r.middleName ?? "",
        lastName: r.lastName ?? "",
        nickname: r.nickname ?? prev.nickname ?? "",
        shirtSize: r.shirtSize ?? prev.shirtSize ?? "",
        tshirtClaimed: Boolean(r.tshirtClaimed ?? prev.tshirtClaimed),
        conferenceKitClaimed: Boolean(r.conferenceKitClaimed ?? prev.conferenceKitClaimed),
        gender: r.gender ?? "Unspecified",
        solo: r.solo,
        manualPairId: r.manualPairId,
        remarks: r.remarks ?? "",
        seedSource: "pamacon-seed-manual",
      };
      try {
        await patchRegistration(r.id, {
          fullName: r.name,
          attendeeType: r.role,
          status: r.status,
          totalFee: r.totalFee,
          paidAmount: r.paid,
          paymentPlan: modeToPaymentPlan(r.mode),
          metadata: meta,
        });
        await reloadAll();
        onApiInfo?.(
          `${String(r.name || "Delegate").trim()} added to the seeded list. They now appear in the seed claim workflow.`,
          "ok"
        );
      } catch (e) {
        onApiError?.(e, "Could not add this delegate to the seeded list.");
      }
    },
    [canEdit, reloadAll, onApiInfo, onApiError]
  );

  const removeRegistrantRecord = async (id) => {
    await deleteRegistration(id);
    await reloadAll();
  };

  const removeAllRegistrantRecords = async () => {
    if (!eventId || !canEdit || !isAdmin) return;
    let items = [];
    try {
      const res = await getRegistrations(eventId);
      items = res.items || [];
    } catch (e) {
      onApiError?.(e, "Could not load registrations.");
      return;
    }
    const n = items.length;
    if (n === 0) return;
    if (!window.confirm(`Remove all ${n} delegates from this event? This cannot be undone.`)) return;
    if (!window.confirm("Delete every registration row now?")) return;
    try {
      for (const row of items) {
        await deleteRegistration(row.id);
      }
      await reloadAll();
    } catch (e) {
      onApiError?.(e, "Could not remove all delegates.");
      await reloadAll();
    }
  };

  const seedExpenseRecords = async () => {
    if (!eventId || !canEdit) return;
    if (!window.confirm("Seed the expense list from the latest committee sheet?")) return;
    try {
      const existingKeys = new Set(
        suppliers.map((x) => `${String(x.company || "").trim().toLowerCase()}|${Number(x.amount) || 0}`)
      );
      for (const row of PAMACON_SEED_EXPENSES) {
        const key = `${String(row.supplier || "").trim().toLowerCase()}|${Number(row.amount) || 0}`;
        if (existingKeys.has(key)) continue;
        await createExpense(eventId, {
          supplier: row.supplier,
          category: row.category,
          amount: row.amount,
          expenseType: "fixed",
          approved: true,
        });
        existingKeys.add(key);
      }
      await reloadAll();
    } catch (e) {
      onApiError?.(e, "Failed to seed expenses.");
    }
  };

  const toggleSoloOccupancy = async (id) => {
    const r = registrants.find((x) => x.id === id);
    if (!r) return;
    await updateRegistrantRecord({ ...r, solo: !r.solo, manualPairId: null });
  };

  const pairManualDelegates = async (idA, idB) => {
    const rA = registrants.find((r) => r.id === idA);
    const rB = registrants.find((r) => r.id === idB);
    if (!rA || !rB || rA.id === rB.id) return;
    if (isExcludedFromRoomAssignments(rA) || isExcludedFromRoomAssignments(rB)) {
      onApiInfo?.("One or both delegates are marked as not taking a room (remarks); they are not included in rooming.", "warn");
      return;
    }

    const mergeRowMeta = (row, patch) => ({
      ...(row?.metaBase && typeof row.metaBase === "object" ? { ...row.metaBase } : {}),
      ...patch,
    });

    // Break any previous preferred pair links for both delegates and their current partners.
    const touchedIds = new Set([rA.id, rB.id, rA.manualPairId, rB.manualPairId].filter(Boolean));
    const updates = [];
    for (const id of touchedIds) {
      const row = registrants.find((x) => x.id === id);
      if (!row) continue;
      updates.push(
        patchRegistration(row.id, {
          metadata: mergeRowMeta(row, {
            lastName: row.lastName ?? "",
            gender: row.gender ?? "Unspecified",
            solo: false,
            manualPairId: null,
            remarks: row.remarks ?? "",
          }),
        })
      );
    }
    await Promise.all(updates);

    // Set new preferred roommate pair.
    await Promise.all([
      patchRegistration(rA.id, {
        metadata: mergeRowMeta(rA, {
          lastName: rA.lastName ?? "",
          gender: rA.gender ?? "Unspecified",
          solo: false,
          manualPairId: rB.id,
          remarks: rA.remarks ?? "",
        }),
      }),
      patchRegistration(rB.id, {
        metadata: mergeRowMeta(rB, {
          lastName: rB.lastName ?? "",
          gender: rB.gender ?? "Unspecified",
          solo: false,
          manualPairId: rA.id,
          remarks: rB.remarks ?? "",
        }),
      }),
    ]);
    await reloadAll();
  };

  const seedIfEmpty = async () => {
    if (!eventId || !canEdit) return;
    if (registrants.length > 0) return;
    if (delegateSeedStartedForEventId.has(eventId)) return;
    delegateSeedStartedForEventId.add(eventId);
    try {
      const existing = await getRegistrations(eventId);
      const existingItems = existing.items || [];
      if (existingItems.length > 0) {
        await reloadAll();
        return;
      }
      const existingNames = new Set(existingItems.map((r) => String(r.full_name || "").trim().toLowerCase()));
      for (const d of PAMACON_SEED_DELEGATES) {
        const fullName = String(d.name || "").trim();
        if (!fullName) continue;
        const key = fullName.toLowerCase();
        if (existingNames.has(key)) continue;
        await createRegistration(eventId, {
          fullName,
          attendeeType: d.role,
          status: "registered",
          totalFee: d.mode === "Installment" ? 8550 : d.paid,
          paidAmount: d.paid,
          paymentPlan: modeToPaymentPlan(d.mode),
          metadata: {
            seedSource: "pamacon-seed",
            lastName: d.lastName,
            gender: d.gender,
            solo: Boolean(d.solo),
            manualPairId: null,
            remarks: d.remarks ?? "",
          },
        });
        existingNames.add(key);
      }
      await reloadAll();
      const { items } = await getRegistrations(eventId);
      const mae = items.find((r) => r.full_name.includes("Mae Ann"));
      const henry = items.find((r) => r.full_name.includes("Henry Evangelista"));
      if (mae && henry) {
        const mMeta = parseMeta(mae);
        const hMeta = parseMeta(henry);
        await patchRegistration(mae.id, {
          metadata: { ...mMeta, manualPairId: henry.id },
        });
        await patchRegistration(henry.id, {
          metadata: { ...hMeta, manualPairId: mae.id },
        });
        await reloadAll();
      }
    } catch (e) {
      delegateSeedStartedForEventId.delete(eventId);
      onApiError?.(e, "Seeding delegates failed.");
    }
  };

  useEffect(() => {
    if (eventId && canEdit && registrants.length === 0) seedIfEmpty();
  }, [eventId, registrants.length, canEdit]);

  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-100 text-slate-600">
        <div className="h-10 w-10 border-2 border-red-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-medium">Loading PAMACON…</p>
      </div>
    );
  }

  if (!canEdit) {
    return (
      <ParticipantPortal
        config={config}
        eventRow={eventRecord}
        authEmail={authEmail}
        profile={profile}
        onSaveProfile={onSaveProfile}
        profileSaving={profileSaving}
        onLogout={onLogout}
      />
    );
  }

  if (committeePortalView === "attendee") {
    return (
      <div className="relative h-screen overflow-hidden flex flex-col bg-slate-100">
        <div className="shrink-0 z-[150] flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-white border-b border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 min-w-0">
            <UserRound className="text-red-600 shrink-0" size={20} aria-hidden />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-900">Attendee portal preview</p>
              <p className="text-[11px] text-slate-500 truncate">Same experience delegates see after sign-in</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setCommitteePortalView("admin")}
            className="shrink-0 inline-flex items-center gap-2 min-h-[40px] rounded-xl bg-red-600 text-white px-4 py-2 text-sm font-semibold hover:bg-red-700"
          >
            Return to admin workspace
          </button>
        </div>
        <div className="flex-1 overflow-y-auto min-h-0">
          <ParticipantPortal
            config={config}
            eventRow={eventRecord}
            authEmail={authEmail}
            profile={profile}
            onSaveProfile={onSaveProfile}
            profileSaving={profileSaving}
            onLogout={onLogout}
          />
        </div>
      </div>
    );
  }

  const section = SECTION_COPY[activeTab] || SECTION_COPY.dashboard;
  const roleLabel = authRole === "admin" ? "Admin" : authRole === "staff" ? "Working Team" : "Viewer";
  const hasCompleteProfile =
    Boolean(String(profile?.firstName || "").trim()) &&
    Boolean(String(profile?.lastName || "").trim()) &&
    Boolean(String(profile?.middleName || "").trim()) &&
    Boolean(String(profile?.mobileNumber || "").trim()) &&
    Boolean(String(profile?.positionCode || "").trim());
  const signedInLabel = hasCompleteProfile
    ? `${String(profile?.firstName || "").trim()} ${String(profile?.lastName || "").trim()}`
    : authEmail || "Unknown user";

  return (
    <div className="flex flex-col md:flex-row h-screen bg-slate-100 text-slate-900 font-sans overflow-hidden">
      <nav
        className={`fixed inset-0 z-40 bg-slate-50 md:relative md:flex md:w-[280px] flex-col border-r border-slate-200/90 transform transition-transform duration-300 ease-in-out ${
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <div className="p-6 flex items-center justify-between md:justify-start gap-4 border-b border-slate-200/80 bg-white/80">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl overflow-hidden bg-white border border-slate-200 flex items-center justify-center shrink-0 shadow-sm">
              <img src="/branding/pama-symbol.png" alt="PAMA logo" className="w-full h-full object-contain" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-semibold text-slate-900 leading-tight truncate">PAMACON 2026</h1>
              <p className="text-[10px] font-medium text-slate-500 mt-0.5 truncate">AIA PAMA</p>
            </div>
          </div>
          <button type="button" className="md:hidden p-2 rounded-xl hover:bg-slate-200/80 shrink-0" onClick={() => setIsMobileMenuOpen(false)}>
            <X size={22} />
          </button>
        </div>
        <div className="flex-1 px-3 py-4 space-y-6 overflow-y-auto custom-scrollbar">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{group.label}</p>
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(item.id);
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm transition-colors ${
                      activeTab === item.id ? "bg-white text-red-700 font-semibold shadow-sm border border-red-100" : "text-slate-600 hover:bg-white/80"
                    }`}
                  >
                    <item.icon size={18} className="shrink-0 opacity-80" />
                    <span className="truncate">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="p-4 text-xs text-slate-500 border-t border-slate-200/80 bg-white/50 truncate">{authEmail}</div>
      </nav>

      {isMobileMenuOpen && (
        <button type="button" className="fixed inset-0 z-30 bg-black/40 md:hidden" aria-label="Close menu" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="min-h-[4rem] md:min-h-[4.5rem] bg-white/95 border-b border-slate-200/90 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 md:px-8 py-3 md:py-0 md:h-[4.25rem] sticky top-0 z-10 backdrop-blur-sm">
          <div className="flex items-start sm:items-center gap-3 min-w-0">
            <button type="button" className="md:hidden p-2 rounded-xl hover:bg-slate-100 shrink-0" onClick={() => setIsMobileMenuOpen(true)}>
              <Menu size={22} />
            </button>
            <div className="min-w-0">
              <p className="text-xs text-slate-500 font-medium">Admin</p>
              <h2 className="text-lg md:text-xl font-semibold text-slate-900 tracking-tight truncate">{section.title}</h2>
              <p className="text-sm text-slate-500 mt-0.5 line-clamp-2">{section.subtitle}</p>
            </div>
          </div>
          <div className="self-start sm:self-center flex flex-wrap items-center gap-2">
            <div className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50">
              <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">Signed in</p>
              <p className="text-xs font-semibold text-slate-700 truncate max-w-[260px]">{signedInLabel}</p>
              <p className="text-[11px] text-slate-500">{roleLabel}</p>
            </div>
            <button
              type="button"
              onClick={() => setCommitteePortalView("attendee")}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-red-700 bg-red-50 border border-red-100 hover:bg-red-100 transition-colors"
            >
              <UserRound size={18} />
              Attendee portal
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("setup")}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              <Settings size={18} />
              Setup
            </button>
            <button
              type="button"
              onClick={onLogout}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700 shadow-sm transition-colors"
            >
              <LogOut size={17} />
              Logout
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
          <div className="max-w-6xl mx-auto space-y-10 pb-16">
            {activeTab === "dashboard" && (
              <AdminHomeOverview
                config={config}
                totalExp={totalExpenditure}
                collections={totalRealizedRevenueValue}
                regCount={registrants.length}
                sponsorRev={sponsorRevenueTotal}
                projection={totalRevenueProjection}
                onNavigate={setActiveTab}
              />
            )}
            {activeTab === "registration" && (
              <RegistrantsLedger
                eventId={eventId}
                registrants={registrants}
                canEdit={canEdit}
                isAdmin={isAdmin}
                isSuperuser={isSuperuser}
                seededListScreenshotDataUrl={config?.seededListScreenshotDataUrl || ""}
                onPersistSeededListScreenshot={persistSeededListScreenshot}
                onProcessReferenceScreenshot={processReferenceScreenshot}
                onImportSeedListFromText={importSeedListFromText}
                onRunHarmonizationSync={runHarmonizationSync}
                authEmail={authEmail}
                onToggleStaffClaim={toggleDelegateStaffClaim}
                onUpdate={updateRegistrantRecord}
                onCreate={createRegistrantRecord}
                onDelete={removeRegistrantRecord}
                onDeleteAll={removeAllRegistrantRecords}
                onAddToSeededList={addRegistrantToSeededList}
                onInfo={onApiInfo}
                onApiError={onApiError}
              />
            )}
            {activeTab === "accommodation" && (
              <AccommodationView config={config} registrants={registrants} onPair={pairManualDelegates} onToggleSolo={toggleSoloOccupancy} canEdit={canEdit} />
            )}
            {activeTab === "program" && (
              <ProgramModulesView config={config} setConfig={setConfig} eventId={eventId} canEdit={canEdit} onError={onApiError} />
            )}
            {activeTab === "sponsorship" && (
              <SponsorshipHub
                sponsors={sponsors}
                totalRevenue={sponsorRevenueTotal}
                eventId={eventId}
                canEdit={canEdit}
                onReload={reloadAll}
                onError={onApiError}
              />
            )}
            {activeTab === "speakers" && (
              <SpeakersHub speakers={speakers} totalHonorarium={totalSpeakerHonorarium} eventId={eventId} canEdit={canEdit} onReload={reloadAll} onError={onApiError} />
            )}
            {activeTab === "suppliers" && (
              <SuppliersHub
                suppliers={suppliers}
                totalSpend={totalSupplierSpend}
                eventId={eventId}
                canEdit={canEdit}
                onReload={reloadAll}
                onError={onApiError}
                onSeedExpenses={seedExpenseRecords}
              />
            )}
            {activeTab === "payments" && <PaymentsHub config={config} realized={totalRealizedRevenueValue} projection={totalRevenueProjection} />}
            {activeTab === "expenses" && <ExpenseDashboard config={config} suppliers={suppliers} />}
            {activeTab === "setup" && (
              <SetupView
                config={config}
                setConfig={setConfig}
                eventId={eventId}
                canEdit={canEdit}
                isAdmin={isAdmin}
                isSuperuser={isSuperuser}
                onSaved={reloadAll}
                onError={onApiError}
                onInfo={onApiInfo}
                profile={profile}
                onSaveProfile={onSaveProfile}
                profileSaving={profileSaving}
              />
            )}
            {activeTab === "profile" && <ProfileModule profile={profile} onSave={onSaveProfile} saving={profileSaving} title="View Profile / Edit Profile" />}
          </div>
        </div>
      </main>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 20px; }
      `}</style>
    </div>
  );
}

const STATUS_OPTIONS = ["pre-registered", "registered", "checked-in"];

function emptyDelegateDraft() {
  return {
    isNew: true,
    id: null,
    name: "",
    firstName: "",
    middleName: "",
    lastName: "",
    role: "UM",
    gender: "Unspecified",
    totalFee: 8000,
    paid: 0,
    mode: "Full",
    status: "pre-registered",
    remarks: "",
    solo: false,
    manualPairId: null,
    metaBase: {},
  };
}

function RegistrantsLedger({
  eventId,
  registrants,
  canEdit,
  isAdmin,
  isSuperuser,
  seededListScreenshotDataUrl = "",
  onPersistSeededListScreenshot,
  onProcessReferenceScreenshot,
  onImportSeedListFromText,
  onRunHarmonizationSync,
  authEmail,
  onToggleStaffClaim,
  onUpdate,
  onCreate,
  onDelete,
  onDeleteAll,
  onAddToSeededList,
  onInfo,
  onApiError,
}) {
  const myEmail = String(authEmail || "").trim().toLowerCase();
  const superUserEmails = useMemo(
    () =>
      new Set(
        String(import.meta.env.VITE_SUPERUSER_EMAILS || "")
          .split(",")
          .map((x) => x.trim().toLowerCase())
          .filter(Boolean)
      ),
    []
  );
  const [editing, setEditing] = useState(null);
  const [sort, setSort] = useState({ key: "name", dir: "asc" });
  const [committeeRoles, setCommitteeRoles] = useState([]);
  const [committeeRolesLoading, setCommitteeRolesLoading] = useState(false);
  const [claimFilter, setClaimFilter] = useState("all");
  const [fName, setFName] = useState("");
  const [fRole, setFRole] = useState("");
  const [fFeeMin, setFFeeMin] = useState("");
  const [fFeeMax, setFFeeMax] = useState("");
  const [fPaidMin, setFPaidMin] = useState("");
  const [fPaidMax, setFPaidMax] = useState("");
  const [fMode, setFMode] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [fRemarks, setFRemarks] = useState("");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showMoreColumns, setShowMoreColumns] = useState(false);
  const [showDangerZone, setShowDangerZone] = useState(false);
  const [refScreenshotModalOpen, setRefScreenshotModalOpen] = useState(false);
  const [savingRefScreenshot, setSavingRefScreenshot] = useState(false);
  const [seedListPasteText, setSeedListPasteText] = useState("");
  const [importingSeedText, setImportingSeedText] = useState(false);
  const [harmonizingSeedRows, setHarmonizingSeedRows] = useState(false);
  const tableMinWidthClass = showMoreColumns ? "min-w-[1280px]" : isAdmin ? "min-w-[980px]" : "min-w-[860px]";

  useEffect(() => {
    if (!isAdmin) return undefined;
    let cancelled = false;
    setCommitteeRolesLoading(true);
    getUserRoles()
      .then((res) => {
        if (!cancelled) setCommitteeRoles(res.items || []);
      })
      .catch((e) => {
        if (!cancelled) onApiError?.(e, "Could not load portal roles.");
      })
      .finally(() => {
        if (!cancelled) setCommitteeRolesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isAdmin, onApiError]);

  const committeeRoleByEmail = useMemo(() => {
    const map = new Map();
    for (const row of committeeRoles) {
      const em = String(row.email || "").trim().toLowerCase();
      if (em) map.set(em, String(row.role || "attendee"));
    }
    return map;
  }, [committeeRoles]);

  const handlePortalRoleChange = async (row, nextRole) => {
    const email = String(row.attendeeClaimEmail || "").trim().toLowerCase();
    if (!email || !isSuperuser) return;
    const prev = committeeRoleByEmail.get(email) || "attendee";
    if (prev === nextRole) return;
    if (email === myEmail && prev === "admin" && nextRole !== "admin") {
      if (!window.confirm("You are changing your own account away from Admin. Continue?")) return;
    }
    try {
      await upsertUserRole({ email, role: nextRole });
      const res = await getUserRoles();
      setCommitteeRoles(res.items || []);
      onInfo?.(`Portal role updated for ${email}.`);
    } catch (e) {
      onApiError?.(e, "Could not update portal role.");
    }
  };

  const toggleSort = (key) => {
    setSort((s) => ({
      key,
      dir: s.key === key && s.dir === "asc" ? "desc" : "asc",
    }));
  };

  const SortBtn = ({ col, label }) => {
    const active = sort.key === col;
    return (
      <button
        type="button"
        onClick={() => toggleSort(col)}
        className={`inline-flex items-center gap-1 font-semibold uppercase tracking-wide hover:text-red-600 ${active ? "text-red-600" : "text-slate-500"}`}
      >
        {label}
        {active ? sort.dir === "asc" ? <ChevronUp size={14} /> : <ChevronDown size={14} /> : <span className="inline-flex flex-col opacity-40 leading-none"><ChevronUp size={10} /><ChevronDown size={10} /></span>}
      </button>
    );
  };

  const filtered = useMemo(() => {
    return registrants.filter((r) => {
      const seeded = isSeededDelegateRow(r);
      const claimEmail = String(r.staffClaimEmail || "").trim().toLowerCase();
      const attendeeClaimEmail = String(r.attendeeClaimEmail || "").trim().toLowerCase();
      const hasAnyClaim = Boolean(claimEmail || attendeeClaimEmail);
      if (claimFilter === "seed-unclaimed" && (!seeded || hasAnyClaim)) return false;
      if (claimFilter === "seed-claimed-by-me" && (!seeded || !claimEmail || claimEmail !== myEmail)) return false;
      if (claimFilter === "seed-claimed-any" && (!seeded || !hasAnyClaim)) return false;
      if (fName && !r.name.toLowerCase().includes(fName.toLowerCase())) return false;
      if (fRole && !r.role.toLowerCase().includes(fRole.toLowerCase())) return false;
      const fee = Number(r.totalFee) || 0;
      if (fFeeMin !== "" && !Number.isNaN(Number(fFeeMin)) && fee < Number(fFeeMin)) return false;
      if (fFeeMax !== "" && !Number.isNaN(Number(fFeeMax)) && fee > Number(fFeeMax)) return false;
      const p = Number(r.paid) || 0;
      if (fPaidMin !== "" && !Number.isNaN(Number(fPaidMin)) && p < Number(fPaidMin)) return false;
      if (fPaidMax !== "" && !Number.isNaN(Number(fPaidMax)) && p > Number(fPaidMax)) return false;
      if (fMode && r.mode !== fMode) return false;
      if (fStatus && r.status !== fStatus) return false;
      if (fRemarks && !(r.remarks || "").toLowerCase().includes(fRemarks.toLowerCase())) return false;
      return true;
    });
  }, [registrants, claimFilter, myEmail, fName, fRole, fFeeMin, fFeeMax, fPaidMin, fPaidMax, fMode, fStatus, fRemarks]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const mult = sort.dir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      switch (sort.key) {
        case "name":
          return mult * a.name.localeCompare(b.name);
        case "role":
          return mult * a.role.localeCompare(b.role);
        case "totalFee":
          return mult * ((Number(a.totalFee) || 0) - (Number(b.totalFee) || 0));
        case "paid":
          return mult * ((Number(a.paid) || 0) - (Number(b.paid) || 0));
        case "mode":
          return mult * a.mode.localeCompare(b.mode);
        case "status":
          return mult * (a.status || "").localeCompare(b.status || "");
        case "remarks":
          return mult * (a.remarks || "").localeCompare(b.remarks || "");
        default:
          return 0;
      }
    });
    return arr;
  }, [filtered, sort]);

  const feesTotalFiltered = useMemo(() => filtered.reduce((sum, r) => sum + (Number(r.totalFee) || 0), 0), [filtered]);
  const collectedTotalFiltered = useMemo(() => filtered.reduce((sum, r) => sum + (Number(r.paid) || 0), 0), [filtered]);

  const clearFilters = () => {
    setClaimFilter("all");
    setFName("");
    setFRole("");
    setFFeeMin("");
    setFFeeMax("");
    setFPaidMin("");
    setFPaidMax("");
    setFMode("");
    setFStatus("");
    setFRemarks("");
  };

  const toggleClaimField = async (row, field) => {
    try {
      await onUpdate({
        ...row,
        [field]: !Boolean(row[field]),
      });
      onInfo?.(`${field === "tshirtClaimed" ? "T-shirt" : "Conference kit"} claim updated.`);
    } catch (e) {
      onApiError?.(e, "Could not update claim status.");
    }
  };

  const shirtSummary = useMemo(() => {
    const counts = {};
    let total = 0;
    for (const r of registrants) {
      const size = String(r.shirtSize || "").trim().toUpperCase();
      if (!size) continue;
      counts[size] = (counts[size] || 0) + 1;
      total += 1;
    }
    const ordered = Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0]));
    return { ordered, total };
  }, [registrants]);

  const claimTrackerRows = useMemo(
    () => registrants.filter((r) => r.tshirtClaimed || r.conferenceKitClaimed || r.shirtSize),
    [registrants]
  );

  const downloadMasterlist = () => {
    const headers = [
      "Full Name",
      "Nickname",
      "Position",
      "Gender",
      "Shirt Size",
      "Tshirt Claimed",
      "Conference Kit Claimed",
      "Payment Mode",
      "Paid Amount",
      "Status",
    ];
    const esc = (v) => `"${String(v ?? "").replaceAll("\"", "\"\"")}"`;
    const rows = sorted.map((r) =>
      [
        r.name,
        r.nickname || "",
        formatPositionShort(r.role),
        r.gender || "",
        r.shirtSize || "",
        r.tshirtClaimed ? "Yes" : "No",
        r.conferenceKitClaimed ? "Yes" : "No",
        r.mode || "",
        Number(r.paid || 0),
        r.status || "",
      ].map(esc).join(",")
    );
    const csv = [headers.map(esc).join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `pamacon-masterlist-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  const claimSummary = useMemo(() => {
    const seeded = registrants.filter((r) => isSeededDelegateRow(r));
    const claimed = seeded.filter((r) => String(r.staffClaimEmail || "").trim() || String(r.attendeeClaimEmail || "").trim());
    const mine = seeded.filter((r) => String(r.staffClaimEmail || "").trim().toLowerCase() === myEmail);
    return {
      seeded: seeded.length,
      unclaimed: Math.max(0, seeded.length - claimed.length),
      mine: mine.length,
    };
  }, [registrants, myEmail]);

  const handleCommit = async () => {
    if (!editing) return;
    const { isNew, ...row } = editing;
    const firstName = String(row.firstName || "").trim();
    const middleName = String(row.middleName || "").trim();
    const lastName = String(row.lastName || "").trim();
    const fullName = [firstName, middleName, lastName].filter(Boolean).join(" ").trim();
    const normalized = {
      ...row,
      firstName,
      middleName,
      lastName,
      name: fullName || String(row.name || "").trim(),
    };
    try {
      if (isNew) await onCreate(normalized);
      else await onUpdate(normalized);
      setEditing(null);
      onInfo?.(isNew ? "Delegate added successfully." : "Delegate saved successfully.");
    } catch (e) {
      onApiError?.(e, isNew ? "Could not add delegate." : "Could not save delegate.");
    }
  };

  const handleDelete = async (r) => {
    if (!window.confirm(`Remove ${r.name} from the list? This cannot be undone.`)) return;
    try {
      await onDelete(r.id);
      onInfo?.("Delegate removed.");
    } catch (e) {
      onApiError?.(e, "Could not delete delegate.");
    }
  };

  const handleDeleteEditing = async () => {
    if (!editing || editing.isNew || !editing.id) return;
    if (!window.confirm(`Remove ${editing.name} from the list? This cannot be undone.`)) return;
    try {
      await onDelete(editing.id);
      setEditing(null);
      onInfo?.("Delegate removed.");
    } catch (e) {
      onApiError?.(e, "Could not delete delegate.");
    }
  };

  const handleReferenceScreenshotFile = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    const canProcess = typeof onProcessReferenceScreenshot === "function";
    const canPersistOnly = typeof onPersistSeededListScreenshot === "function";
    if (!file || !isSuperuser || (!canProcess && !canPersistOnly)) return;
    setSavingRefScreenshot(true);
    const reader = new FileReader();
    reader.onload = () => {
      void (async () => {
        try {
          if (typeof reader.result !== "string") return;
          if (canProcess) await onProcessReferenceScreenshot(file, reader.result);
          else await onPersistSeededListScreenshot(reader.result);
        } catch (e) {
          onApiError?.(e, "Reference screenshot upload failed.");
        } finally {
          setSavingRefScreenshot(false);
        }
      })();
    };
    reader.onerror = () => setSavingRefScreenshot(false);
    reader.readAsDataURL(file);
  };

  const handleRemoveReferenceScreenshot = () => {
    if (!isSuperuser || typeof onPersistSeededListScreenshot !== "function") return;
    void onPersistSeededListScreenshot("");
  };

  let cumulative = 0;

  return (
    <div className="space-y-6 pb-20">
      {refScreenshotModalOpen && isSuperuser && seededListScreenshotDataUrl ? (
        <div
          className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-900/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Uploaded reference list image"
          onClick={() => setRefScreenshotModalOpen(false)}
        >
          <div
            className="relative max-h-[92vh] w-full max-w-5xl overflow-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setRefScreenshotModalOpen(false)}
              className="absolute right-3 top-3 z-10 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              Close
            </button>
            <img
              src={seededListScreenshotDataUrl}
              alt="Uploaded reference list for seeded participants"
              className="mx-auto mt-10 max-h-[80vh] w-auto max-w-full object-contain"
            />
          </div>
        </div>
      ) : null}
      {editing && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-[40px] shadow-2xl p-10 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-semibold text-slate-900">{editing.isNew ? "Add delegate" : "Edit delegate"}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <SetupInput
                label="First name"
                value={editing.firstName || ""}
                onChange={(e) => setEditing({ ...editing, firstName: e.target.value })}
              />
              <SetupInput
                label="Last name"
                value={editing.lastName || ""}
                onChange={(e) => setEditing({ ...editing, lastName: e.target.value })}
              />
            </div>
            <SetupInput
              label="Middle name"
              value={editing.middleName || ""}
              onChange={(e) => setEditing({ ...editing, middleName: e.target.value })}
            />
            <SetupInput
              label="Full name (auto)"
              value={[editing.firstName, editing.middleName, editing.lastName].filter(Boolean).join(" ").trim()}
              readOnly
            />
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Position</label>
              <select
                className="w-full bg-white border-2 border-slate-100 rounded-2xl px-5 py-3 text-sm font-bold text-slate-700 focus:outline-none focus:border-red-400"
                value={formatPositionShort(editing.role)}
                onChange={(e) => setEditing({ ...editing, role: e.target.value })}
              >
                {POSITION_CODES.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Gender (rooming)</label>
              <select
                className="w-full bg-white border-2 border-slate-100 rounded-2xl px-5 py-3 text-sm font-bold text-slate-700 focus:outline-none focus:border-red-400"
                value={editing.gender || "Unspecified"}
                onChange={(e) => setEditing({ ...editing, gender: e.target.value })}
              >
                <option value="Unspecified">Unspecified</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Registration status</label>
              <select
                className="w-full bg-white border-2 border-slate-100 rounded-2xl px-5 py-3 text-sm font-bold text-slate-700 focus:outline-none focus:border-red-400"
                value={editing.status || "pre-registered"}
                onChange={(e) => setEditing({ ...editing, status: e.target.value })}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <SetupInput label="Registration fee (₱)" type="number" value={editing.totalFee} onChange={(e) => setEditing({ ...editing, totalFee: Number(e.target.value) })} />
            <SetupInput label="Amount collected / paid (₱)" type="number" value={editing.paid} onChange={(e) => setEditing({ ...editing, paid: Number(e.target.value) })} />
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Payment mode</label>
              <select
                className="w-full bg-white border-2 border-slate-100 rounded-2xl px-5 py-3 text-sm font-bold text-slate-700 focus:outline-none focus:border-red-400"
                value={editing.mode}
                onChange={(e) => setEditing({ ...editing, mode: e.target.value })}
              >
                <option value="Full">Full</option>
                <option value="Partial">Partial</option>
                <option value="Installment">Installment</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Remarks</label>
              <textarea
                value={editing.remarks || ""}
                onChange={(e) => setEditing({ ...editing, remarks: e.target.value })}
                rows={3}
                className="w-full bg-white border-2 border-slate-100 rounded-2xl px-5 py-3 text-sm text-slate-700 focus:outline-none focus:border-red-400 resize-y min-h-[80px]"
                placeholder="Internal notes…"
              />
            </div>
            <div className="flex flex-col gap-3 mt-6">
              {!editing.isNew && (
                <button
                  type="button"
                  disabled={!canEdit}
                  onClick={handleDeleteEditing}
                  className="w-full py-3 rounded-2xl border border-rose-200 text-rose-700 text-sm font-semibold hover:bg-rose-50 flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  <Trash2 size={16} /> Remove delegate
                </button>
              )}
              <div className="flex gap-4">
                <button type="button" onClick={() => setEditing(null)} className="flex-1 py-3 text-slate-500 font-medium text-sm">
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!canEdit}
                  onClick={handleCommit}
                  className="flex-1 py-3 bg-red-600 text-white rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  <Save size={16} /> {editing.isNew ? "Add delegate" : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {isSuperuser ? (
        <div className="rounded-3xl border-2 border-dashed border-amber-300/90 bg-gradient-to-br from-amber-50/90 to-white p-6 sm:p-8 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-800">Superuser · Bulk list import</p>
          <h3 className="mt-2 text-lg font-semibold text-slate-900">Import seeded participant list</h3>
          <p className="mt-2 text-sm text-slate-600 max-w-4xl leading-relaxed">
            Add delegates in bulk from a <strong>screenshot</strong> (OCR), or paste / upload the same kind of <strong>text list</strong> (one person per line: optional line number, name, amounts like{" "}
            <strong>2.85k</strong> or <strong>8.5k</strong>, optional <strong>(1/3)</strong> for installments). Names already on file are skipped. Always review the table afterward.
          </p>
          <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2 xl:items-stretch">
            <div className="flex flex-col gap-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">From image (OCR)</p>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-stretch">
                <label className="flex min-h-[140px] flex-1 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-white px-4 py-6 text-center transition-colors hover:border-amber-400 hover:bg-amber-50/30">
                  <span className="text-sm font-semibold text-slate-700">
                    {savingRefScreenshot ? "Saving & scanning (OCR may take a minute)…" : "Click to choose image"}
                  </span>
                  <span className="mt-1 text-xs text-slate-500">PNG, JPG, WebP — saved to event config and scanned for new delegates</span>
                  <input
                    type="file"
                    accept="image/*"
                    disabled={savingRefScreenshot || importingSeedText}
                    onChange={handleReferenceScreenshotFile}
                    className="sr-only"
                  />
                </label>
                <div className="flex w-full max-w-sm flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:max-w-[220px] sm:shrink-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Current upload</p>
                  {seededListScreenshotDataUrl ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setRefScreenshotModalOpen(true)}
                        className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 text-left"
                      >
                        <img
                          src={seededListScreenshotDataUrl}
                          alt="Reference list thumbnail"
                          className="h-36 w-full object-contain"
                        />
                      </button>
                      <p className="text-xs text-slate-500">Tap thumbnail to view full size.</p>
                      <button
                        type="button"
                        disabled={savingRefScreenshot}
                        onClick={handleRemoveReferenceScreenshot}
                        className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800 hover:bg-rose-100 disabled:opacity-50"
                      >
                        Remove image
                      </button>
                    </>
                  ) : (
                    <p className="text-sm text-slate-500">No image uploaded yet.</p>
                  )}
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 text-slate-800">
                <ClipboardPaste className="shrink-0 text-amber-800" size={20} aria-hidden />
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Paste or text file</p>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Paste from Excel or a messenger thread, or choose a <strong>.txt</strong> / <strong>.csv</strong> export (UTF-8). Tab-separated columns are flattened to spaces before parsing.
              </p>
              <textarea
                value={seedListPasteText}
                onChange={(e) => setSeedListPasteText(e.target.value)}
                rows={8}
                placeholder={"e.g.\n49. Jane Doe - 2.85k (1/3)\n50. John Smith 8.5k"}
                disabled={importingSeedText || savingRefScreenshot}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-200 disabled:opacity-50 resize-y min-h-[140px]"
              />
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                <button
                  type="button"
                  disabled={
                    importingSeedText ||
                    savingRefScreenshot ||
                    typeof onImportSeedListFromText !== "function" ||
                    !String(seedListPasteText || "").trim()
                  }
                  onClick={() => {
                    if (typeof onImportSeedListFromText !== "function") return;
                    setImportingSeedText(true);
                    void (async () => {
                      try {
                        await onImportSeedListFromText(seedListPasteText);
                      } catch (err) {
                        onApiError?.(err, "Could not import list from pasted text.");
                      } finally {
                        setImportingSeedText(false);
                      }
                    })();
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-amber-800 disabled:opacity-45 disabled:pointer-events-none"
                >
                  {importingSeedText ? "Importing…" : "Import from pasted text"}
                </button>
                <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-45">
                  <FileText size={18} className="text-slate-500 shrink-0" aria-hidden />
                  <span>{importingSeedText ? "Reading file…" : "Choose .txt / .csv"}</span>
                  <input
                    type="file"
                    accept=".txt,.csv,text/plain"
                    disabled={importingSeedText || savingRefScreenshot || typeof onImportSeedListFromText !== "function"}
                    onChange={(ev) => {
                      const file = ev.target.files?.[0];
                      ev.target.value = "";
                      if (!file || typeof onImportSeedListFromText !== "function") return;
                      setImportingSeedText(true);
                      const reader = new FileReader();
                      reader.onload = () => {
                        void (async () => {
                          try {
                            const t = typeof reader.result === "string" ? reader.result : "";
                            await onImportSeedListFromText(t);
                          } catch (err) {
                            onApiError?.(err, "Could not read or import that file.");
                          } finally {
                            setImportingSeedText(false);
                          }
                        })();
                      };
                      reader.onerror = () => {
                        setImportingSeedText(false);
                        onApiError?.(new Error("File read failed"), "Could not read the selected file.");
                      };
                      reader.readAsText(file);
                    }}
                    className="sr-only"
                  />
                </label>
                <button
                  type="button"
                  disabled={!isAdmin || harmonizingSeedRows || typeof onRunHarmonizationSync !== "function"}
                  onClick={() => {
                    if (typeof onRunHarmonizationSync !== "function") return;
                    setHarmonizingSeedRows(true);
                    void (async () => {
                      try {
                        await onRunHarmonizationSync();
                      } finally {
                        setHarmonizingSeedRows(false);
                      }
                    })();
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-45 disabled:pointer-events-none"
                >
                  {harmonizingSeedRows ? "Harmonizing…" : "Run harmonization sync"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-6 md:p-8 border-b border-slate-100 bg-slate-50/50 flex flex-col gap-4">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Conference Delegates</h3>
              <p className="text-sm text-slate-500 mt-1 max-w-xl">
                <strong>Registration fees</strong> is the sum of each row’s listed fee. <strong>Collected</strong> is the sum of amounts actually paid—they differ when someone is on partial or installment plans.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Claim workflow</span>
                <button
                  type="button"
                  onClick={() => setClaimFilter("seed-unclaimed")}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold border ${
                    claimFilter === "seed-unclaimed" ? "border-red-300 bg-red-50 text-red-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  Unclaimed seeds: {claimSummary.unclaimed}
                </button>
                <button
                  type="button"
                  onClick={() => setClaimFilter("seed-claimed-by-me")}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold border ${
                    claimFilter === "seed-claimed-by-me" ? "border-violet-300 bg-violet-50 text-violet-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  Claimed by me: {claimSummary.mine}
                </button>
                <button
                  type="button"
                  onClick={() => setClaimFilter("all")}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold border ${
                    claimFilter === "all" ? "border-slate-300 bg-slate-100 text-slate-800" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  Show all delegates
                </button>
              </div>
            </div>
            <div className="flex flex-wrap items-stretch gap-3">
              <div className="rounded-xl bg-white border border-slate-200 px-4 py-2.5 min-w-[140px]">
                <p className="text-[10px] font-semibold uppercase text-slate-400">Registration fees (filtered)</p>
                <p className="text-lg font-semibold text-slate-900 tabular-nums">₱{feesTotalFiltered.toLocaleString()}</p>
              </div>
              <div className="rounded-xl bg-white border border-emerald-200/80 px-4 py-2.5 min-w-[140px]">
                <p className="text-[10px] font-semibold uppercase text-emerald-700/80">Collected / paid (filtered)</p>
                <p className="text-lg font-semibold text-emerald-800 tabular-nums">₱{collectedTotalFiltered.toLocaleString()}</p>
              </div>
              {canEdit && eventId && (
                <>
                  <button
                    type="button"
                    onClick={() => setEditing(emptyDelegateDraft())}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 shadow-sm"
                  >
                    <Plus size={18} /> Add delegate
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={downloadMasterlist}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Download masterlist
              </button>
              <button
                type="button"
                onClick={() => setShowAdvancedFilters((s) => !s)}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                <Filter size={16} />
                {showAdvancedFilters ? "Hide advanced filters" : "Show advanced filters"}
              </button>
              <button
                type="button"
                onClick={() => setShowMoreColumns((s) => !s)}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                {showMoreColumns ? "Compact table" : "Show more columns"}
              </button>
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                <Filter size={16} />
                Clear filters
              </button>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className={`w-full text-left ${tableMinWidthClass}`}>
            <colgroup>
              <col className="w-[240px]" />
              <col className="w-[110px]" />
              {isAdmin ? <col className="w-[140px]" /> : null}
              <col className="w-[130px]" />
              <col className="w-[130px]" />
              <col className="w-[100px]" />
              <col className="w-[140px]" />
              {showMoreColumns && (
                <>
                  <col className="w-[120px]" />
                  <col className="w-[170px]" />
                  <col className="w-[170px]" />
                </>
              )}
              <col className="w-[120px]" />
            </colgroup>
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3.5 align-bottom">
                  <SortBtn col="name" label="Name" />
                </th>
                <th className="px-4 py-3.5 align-bottom">
                  <SortBtn col="role" label="Position" />
                </th>
                {isAdmin ? (
                  <th className="px-4 py-3.5 align-bottom text-left">
                    <span className="inline-flex flex-col gap-0.5">
                      <span className="inline-flex items-center gap-1 font-semibold uppercase tracking-wide text-slate-500">Portal role</span>
                      {!isSuperuser ? (
                        <span className="normal-case font-normal text-[10px] text-slate-400">Superuser assigns Staff / Admin</span>
                      ) : null}
                    </span>
                  </th>
                ) : null}
                <th className="px-4 py-3.5 text-right align-bottom">
                  <SortBtn col="totalFee" label="Reg. fee" />
                </th>
                <th className="px-4 py-3.5 text-right align-bottom">
                  <SortBtn col="paid" label="Collected" />
                </th>
                <th className="px-4 py-3.5 align-bottom">
                  <SortBtn col="mode" label="Mode" />
                </th>
                <th className="px-4 py-3.5 align-bottom">
                  T-shirt claim
                </th>
                {showMoreColumns && (
                  <>
                    <th className="px-4 py-3.5 align-bottom">
                      <SortBtn col="status" label="Status" />
                    </th>
                    <th className="px-4 py-3.5 align-bottom">
                      <SortBtn col="remarks" label="Remarks" />
                    </th>
                    <th className="px-4 py-3.5 text-right align-bottom">
                      <span className="text-slate-500 uppercase tracking-wide font-semibold">Running collected</span>
                    </th>
                  </>
                )}
                <th className="px-4 py-3.5 text-center align-bottom w-[120px] sticky right-0 z-10 bg-slate-50 border-l border-slate-100 shadow-[-4px_0_8px_-4px_rgba(15,23,42,0.08)]">
                  Actions
                </th>
              </tr>
              <tr className="bg-white border-b border-slate-100 text-xs">
                <th className="px-4 py-2.5 font-normal">
                  <input
                    value={fName}
                    onChange={(e) => setFName(e.target.value)}
                    placeholder="Contains…"
                    className="w-full min-w-[100px] rounded-lg border border-slate-200 px-2.5 py-2 text-slate-700"
                  />
                </th>
                <th className="px-4 py-2.5 font-normal">
                  {showAdvancedFilters ? (
                    <input
                      value={fRole}
                      onChange={(e) => setFRole(e.target.value)}
                      placeholder="Contains…"
                      className="w-full min-w-[100px] rounded-lg border border-slate-200 px-2.5 py-2 text-slate-700"
                    />
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </th>
                {isAdmin ? (
                  <th className="px-4 py-2.5 font-normal">
                    <span className="text-slate-300">—</span>
                  </th>
                ) : null}
                <th className="px-4 py-2.5 font-normal">
                  {showAdvancedFilters ? (
                    <div className="flex gap-1 justify-end">
                      <input
                        type="number"
                        value={fFeeMin}
                        onChange={(e) => setFFeeMin(e.target.value)}
                        placeholder="Min"
                        className="w-16 rounded-lg border border-slate-200 px-1 py-1.5 text-slate-700 text-right text-xs"
                      />
                      <input
                        type="number"
                        value={fFeeMax}
                        onChange={(e) => setFFeeMax(e.target.value)}
                        placeholder="Max"
                        className="w-16 rounded-lg border border-slate-200 px-1 py-1.5 text-slate-700 text-right text-xs"
                      />
                    </div>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </th>
                <th className="px-4 py-2.5 font-normal">
                  {showAdvancedFilters ? (
                    <div className="flex gap-1 justify-end">
                      <input
                        type="number"
                        value={fPaidMin}
                        onChange={(e) => setFPaidMin(e.target.value)}
                        placeholder="Min"
                        className="w-16 rounded-lg border border-slate-200 px-1 py-1.5 text-slate-700 text-right text-xs"
                      />
                      <input
                        type="number"
                        value={fPaidMax}
                        onChange={(e) => setFPaidMax(e.target.value)}
                        placeholder="Max"
                        className="w-16 rounded-lg border border-slate-200 px-1 py-1.5 text-slate-700 text-right text-xs"
                      />
                    </div>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </th>
                <th className="px-4 py-2.5 font-normal">
                  {showAdvancedFilters ? (
                    <select
                      value={fMode}
                      onChange={(e) => setFMode(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-slate-700 text-xs"
                    >
                      <option value="">All modes</option>
                      <option value="Full">Full</option>
                      <option value="Partial">Partial</option>
                      <option value="Installment">Installment</option>
                    </select>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </th>
                <th className="px-4 py-2.5 font-normal">
                  <span className="text-slate-300">—</span>
                </th>
                {showMoreColumns && (
                  <>
                    <th className="px-4 py-2.5 font-normal">
                      {showAdvancedFilters ? (
                        <select
                          value={fStatus}
                          onChange={(e) => setFStatus(e.target.value)}
                          className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-slate-700 text-xs"
                        >
                          <option value="">All statuses</option>
                          {STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </th>
                    <th className="px-4 py-2.5 font-normal">
                      {showAdvancedFilters ? (
                        <input
                          value={fRemarks}
                          onChange={(e) => setFRemarks(e.target.value)}
                          placeholder="Contains…"
                          className="w-full min-w-[80px] rounded-lg border border-slate-200 px-2 py-1.5 text-slate-700"
                        />
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </th>
                    <th className="px-4 py-2.5" />
                  </>
                )}
                <th className="px-4 py-2.5 sticky right-0 z-10 bg-white border-l border-slate-100" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {sorted.map((r) => {
                cumulative += Number(r.paid) || 0;
                return (
                  <tr key={r.id} className="group hover:bg-slate-50/80">
                    <td className="px-4 py-4 text-slate-800">
                      <div className="font-semibold">{r.name}</div>
                      {r.nickname && <div className="text-xs text-slate-500 mt-1">Nickname: {r.nickname}</div>}
                      {isSeededDelegateRow(r) && (
                        <div className="mt-2 flex flex-col gap-1.5">
                          {r.attendeeClaimEmail ? (
                            <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-2 py-1 inline-flex flex-wrap items-center gap-1 w-fit max-w-full">
                              Claimed by attendee {r.attendeeClaimEmail}
                            </span>
                          ) : r.staffClaimEmail ? (
                            <span className="text-[10px] font-medium text-violet-700 bg-violet-50 border border-violet-100 rounded-lg px-2 py-1 inline-flex flex-wrap items-center gap-1 w-fit max-w-full">
                              Claimed by {r.staffClaimEmail}
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium text-slate-500">Seed list · unclaimed</span>
                          )}
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => onToggleStaffClaim?.(r)}
                              className="text-left w-fit text-[11px] font-bold text-red-700 hover:underline disabled:opacity-40"
                              disabled={Boolean(r.attendeeClaimEmail || (r.staffClaimEmail && String(r.staffClaimEmail).toLowerCase() !== String(authEmail || "").toLowerCase()))}
                            >
                              {r.attendeeClaimEmail
                                ? "Already claimed by attendee"
                                : r.staffClaimEmail && String(r.staffClaimEmail).toLowerCase() === String(authEmail || "").toLowerCase()
                                ? "Release my claim"
                                : r.staffClaimEmail
                                ? "Claimed by another"
                                : "Claim for follow-up"}
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <span className={`text-[10px] font-bold px-2 py-1 rounded border ${positionBadgeClass(r.role)}`}>{formatPositionShort(r.role)}</span>
                    </td>
                    {isAdmin ? (
                      <td className="px-4 py-4 align-top">
                        {(() => {
                          const claimEmail = String(r.attendeeClaimEmail || "").trim().toLowerCase();
                          if (!claimEmail) {
                            return <span className="text-xs text-slate-400">After attendee claim</span>;
                          }
                          if (superUserEmails.has(claimEmail)) {
                            return <span className="text-xs font-semibold text-amber-800">Admin (env)</span>;
                          }
                          const current = committeeRoleByEmail.get(claimEmail) || "attendee";
                          if (!isSuperuser) {
                            return (
                              <span className="text-xs font-semibold text-slate-700">
                                {current === "staff" ? "Working Team" : current === "admin" ? "Admin" : "Viewer"}
                              </span>
                            );
                          }
                          return (
                            <select
                              value={current}
                              disabled={committeeRolesLoading}
                              onChange={(e) => handlePortalRoleChange(r, e.target.value)}
                              className="w-full max-w-[9.5rem] rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-800 disabled:opacity-50"
                              aria-label={`Portal role for ${claimEmail}`}
                            >
                              <option value="attendee">Viewer</option>
                              <option value="staff">Staff</option>
                              <option value="admin">Admin</option>
                            </select>
                          );
                        })()}
                      </td>
                    ) : null}
                    <td className="px-4 py-4 text-right font-medium text-slate-800 tabular-nums">₱{(Number(r.totalFee) || 0).toLocaleString()}</td>
                    <td className="px-4 py-4 text-right font-semibold text-slate-800 tabular-nums">₱{(Number(r.paid) || 0).toLocaleString()}</td>
                    <td className="px-4 py-4">
                      <span className="text-xs font-medium text-slate-700">{r.mode}</span>
                    </td>
                    <td className="px-4 py-4">
                      <button
                        type="button"
                        disabled={!canEdit}
                        onClick={() => toggleClaimField(r, "tshirtClaimed")}
                        className={`rounded-lg px-2.5 py-1 text-xs font-semibold border ${
                          r.tshirtClaimed ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {r.tshirtClaimed ? "Claimed" : "Pending"}
                      </button>
                    </td>
                    {showMoreColumns && (
                      <>
                        <td className="px-4 py-4 text-xs text-slate-600">{r.status}</td>
                        <td className="px-4 py-4 text-slate-600 max-w-[160px] truncate" title={r.remarks || ""}>
                          {r.remarks || "—"}
                        </td>
                        <td className="px-4 py-4 text-right text-slate-700 tabular-nums font-medium">₱{cumulative.toLocaleString()}</td>
                      </>
                    )}
                    <td className="px-4 py-4 text-center sticky right-0 z-[1] bg-white border-l border-slate-100 shadow-[-4px_0_8px_-4px_rgba(15,23,42,0.06)] group-hover:bg-slate-50/80">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          disabled={!canEdit}
                          onClick={() =>
                            setEditing({
                              isNew: false,
                              ...r,
                              remarks: r.remarks || "",
                            })
                          }
                          className="p-2 text-slate-400 hover:text-red-600 transition-colors disabled:opacity-30 rounded-lg hover:bg-red-50"
                          title="Edit"
                        >
                          <Edit3 size={18} />
                        </button>
                        {!isSeededDelegateRow(r) && typeof onAddToSeededList === "function" ? (
                          <button
                            type="button"
                            disabled={!canEdit}
                            onClick={() => void onAddToSeededList(r)}
                            className="p-2 text-slate-400 hover:text-amber-700 transition-colors disabled:opacity-30 rounded-lg hover:bg-amber-50"
                            title="Add to seeded list (enables committee / attendee seed claim workflow)"
                            aria-label="Add to seeded list"
                          >
                            <ListPlus size={18} />
                          </button>
                        ) : null}
                        <button
                          type="button"
                          disabled={!canEdit}
                          onClick={() => handleDelete(r)}
                          className="p-2 text-slate-400 hover:text-rose-600 transition-colors disabled:opacity-30 rounded-lg hover:bg-rose-50"
                          title="Remove delegate"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100/90 border-t-2 border-slate-200 font-semibold text-slate-900">
                <td colSpan={isAdmin ? 3 : 2} className="px-4 py-3.5 text-sm">
                  Totals (filtered)
                </td>
                <td className="px-4 py-3.5 text-right tabular-nums">₱{feesTotalFiltered.toLocaleString()}</td>
                <td className="px-4 py-3.5 text-right tabular-nums text-emerald-800">₱{collectedTotalFiltered.toLocaleString()}</td>
                <td colSpan={showMoreColumns ? 5 : 2} className="px-4 py-3.5 text-xs text-slate-500 font-normal">
                  Running collected accumulates paid amounts in the current row order. It equals the collected total when sorted so rows match that sequence.
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-sm space-y-4">
        <h4 className="text-base font-semibold text-slate-900">T-shirt and Conference Kit Claim</h4>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-500">
                <th className="py-2 text-left">Delegate</th>
                <th className="py-2 text-left">Shirt size</th>
                <th className="py-2 text-left">T-shirt</th>
                <th className="py-2 text-left">Conference kit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {claimTrackerRows.map((r) => (
                <tr key={`claims-${r.id}`}>
                  <td className="py-2.5 pr-3 text-slate-800">
                    <span className="font-medium">{r.name}</span>
                    {r.nickname ? <span className="ml-2 text-xs text-slate-500">({r.nickname})</span> : null}
                  </td>
                  <td className="py-2.5 pr-3 text-slate-600">{r.shirtSize || "—"}</td>
                  <td className="py-2.5 pr-3">
                    <button
                      type="button"
                      disabled={!canEdit}
                      onClick={() => toggleClaimField(r, "tshirtClaimed")}
                      className={`rounded-lg px-2.5 py-1 text-xs font-semibold border ${
                        r.tshirtClaimed ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {r.tshirtClaimed ? "Claimed" : "Mark claimed"}
                    </button>
                  </td>
                  <td className="py-2.5 pr-3">
                    <button
                      type="button"
                      disabled={!canEdit}
                      onClick={() => toggleClaimField(r, "conferenceKitClaimed")}
                      className={`rounded-lg px-2.5 py-1 text-xs font-semibold border ${
                        r.conferenceKitClaimed ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {r.conferenceKitClaimed ? "Claimed" : "Mark claimed"}
                    </button>
                  </td>
                </tr>
              ))}
              {claimTrackerRows.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-3 text-slate-500">
                    No claimable delegate data yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">T-shirt size summary (ordering)</p>
          <div className="flex flex-wrap gap-2">
            {shirtSummary.ordered.map(([size, count]) => (
              <span key={size} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">
                {size}: {count}
              </span>
            ))}
            <span className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-bold text-red-700">
              Total shirts: {shirtSummary.total}
            </span>
          </div>
        </div>
      </div>
      {isAdmin && canEdit && registrants.length > 0 && (
        <div className="bg-white rounded-3xl border border-rose-200 p-5 shadow-sm">
          <button
            type="button"
            onClick={() => setShowDangerZone((s) => !s)}
            className="text-sm font-semibold text-rose-700 hover:text-rose-800"
          >
            {showDangerZone ? "Hide danger zone" : "Show danger zone"}
          </button>
          {showDangerZone && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4">
              <p className="text-sm text-rose-800">Permanent action: delete all delegate records for this event.</p>
              <button
                type="button"
                onClick={() => onDeleteAll?.()}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-rose-300 bg-white text-rose-800 text-sm font-semibold hover:bg-rose-100"
              >
                <Trash2 size={18} /> Clear all delegates
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AccommodationView({ config, registrants, onPair, onToggleSolo, canEdit }) {
  const [target, setTarget] = useState(null);
  const [search, setSearch] = useState("");
  const [randomized, setRandomized] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const list = useMemo(() => buildRoomAssignments(registrants, config, { autoPair: randomized }), [registrants, config, randomized]);
  const availablePartners = useMemo(() => {
    if (!target) return [];
    return registrants
      .filter((r) => !isExcludedFromRoomAssignments(r) && !r.solo && r.id !== target.id && !r.manualPairId)
      .sort((a, b) => {
        const aScore = a.gender === target.gender ? 0 : 1;
        const bScore = b.gender === target.gender ? 0 : 1;
        const aBusy = a.manualPairId ? 1 : 0;
        const bBusy = b.manualPairId ? 1 : 0;
        if (aBusy !== bBusy) return aBusy - bBusy;
        if (aScore !== bScore) return aScore - bScore;
        return a.name.localeCompare(b.name);
      })
      .filter((r) => r.name.toLowerCase().includes(search.toLowerCase()));
  }, [registrants, target, search]);
  const visibleRooms = useMemo(() => {
    if (statusFilter === "all") return list;
    return list.filter((r) => r.status === statusFilter);
  }, [list, statusFilter]);
  const roomSummary = useMemo(
    () => ({
      needsPairing: list.filter((r) => r.status === "Needs Pairing").length,
      solo: list.filter((r) => r.status === "Solo").length,
      paired: list.filter((r) => r.status === "Paired").length,
    }),
    [list]
  );
  const suggestedMovements = useMemo(() => {
    const unpaired = list.filter((x) => x.status === "Needs Pairing").map((x) => x.a);
    return unpaired.map((u) => {
      const candidates = registrants
        .filter((r) => !isExcludedFromRoomAssignments(r) && r.id !== u.id && !r.solo && r.gender === u.gender)
        .sort((a, b) => Number(Boolean(a.manualPairId)) - Number(Boolean(b.manualPairId)) || a.name.localeCompare(b.name))
        .slice(0, 2);
      return { unpaired: u, candidates };
    });
  }, [list, registrants]);

  return (
    <div className="space-y-6 pb-20">
      {target && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[70vh]">
            <div className="p-8 border-b bg-slate-50 flex justify-between items-center">
              <h3 className="font-black uppercase tracking-tight text-slate-800 leading-none">Manual Pairing</h3>
              <button type="button" onClick={() => setTarget(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="p-4 bg-white border-b">
              <div className="relative">
                <Search className="absolute left-3 top-3 text-slate-300" size={18} />
                <input
                  type="text"
                  placeholder="Search delegate..."
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border rounded-2xl focus:outline-none focus:border-red-400 shadow-sm"
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <p className="mt-2 text-xs text-slate-500">Suggested order: available delegates first, same-gender matches prioritized.</p>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
              {availablePartners.map((r) => (
                  <button
                    type="button"
                    key={r.id}
                    disabled={!canEdit}
                    onClick={() => {
                      onPair(target.id, r.id);
                      setTarget(null);
                    }}
                    className="w-full text-left p-4 rounded-3xl hover:bg-red-50 border border-transparent hover:border-red-100 transition-all group text-slate-800 disabled:opacity-40"
                  >
                    <p className="font-black text-sm">{r.name}</p>
                    <p className="text-[10px] text-slate-500 mt-1">
                      {formatPositionShort(r.role)} · {r.gender || "Unspecified"}
                    </p>
                  </button>
                ))}
              {availablePartners.length === 0 && <p className="text-sm text-slate-500">No available partners found.</p>}
            </div>
          </div>
        </div>
      )}
      <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm space-y-4">
        <h3 className="text-lg font-semibold text-slate-900">Roommate Assignment Flow</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-2xl border border-slate-200 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Step 1</p>
            <p className="text-sm font-semibold text-slate-800 mt-1">Set preferred roommates</p>
            <p className="text-xs text-slate-500 mt-1">Pair family, relatives, or agency/unit mates first.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Step 2</p>
            <p className="text-sm font-semibold text-slate-800 mt-1">Randomize remaining</p>
            <p className="text-xs text-slate-500 mt-1">Random pairing uses male-only and female-only pools.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Step 3</p>
            <p className="text-sm font-semibold text-slate-800 mt-1">Move pairings manually</p>
            <p className="text-xs text-slate-500 mt-1">Adjust pairings after randomization and resolve unpaired delegates.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={!canEdit}
            onClick={() => setRandomized(true)}
            className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-black disabled:opacity-40"
          >
            Randomize remaining delegates
          </button>
          <button
            type="button"
            disabled={!canEdit}
            onClick={() => setRandomized(false)}
            className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            Reset to preferred-pair view
          </button>
        </div>
      </div>
      <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Rooming view</span>
          {[
            { id: "all", label: `All (${list.length})` },
            { id: "Needs Pairing", label: `Needs Pairing (${roomSummary.needsPairing})` },
            { id: "Solo", label: `Solo (${roomSummary.solo})` },
            { id: "Paired", label: `Paired (${roomSummary.paired})` },
          ].map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setStatusFilter(opt.id)}
              className={`px-3 py-1.5 rounded-lg text-sm border ${
                statusFilter === opt.id ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      {randomized && roomSummary.needsPairing > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-3xl p-5 shadow-sm">
          <p className="text-sm font-semibold text-amber-900">Unpaired delegates still need action</p>
          <div className="mt-3 space-y-2">
            {suggestedMovements.map((s) => (
              <p key={s.unpaired.id} className="text-sm text-amber-900/90">
                <strong>{s.unpaired.name}</strong> ({s.unpaired.gender || "Unspecified"}) - Suggested moves:{" "}
                {s.candidates.length > 0 ? s.candidates.map((c) => c.name).join(", ") : "No same-gender candidate available"}
              </p>
            ))}
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {visibleRooms.map((r) => (
          <div
            key={r.id}
            className={`p-8 rounded-[40px] border-2 bg-white transition-all shadow-sm ${
              r.status === "Needs Pairing"
                ? "border-amber-300 ring-4 ring-amber-50"
                : r.status === "Solo"
                ? "border-red-300 ring-4 ring-red-50"
                : "border-slate-100 hover:border-slate-200"
            }`}
          >
            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-3">
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner ${
                    r.status === "Needs Pairing" ? "bg-amber-100 text-amber-700" : r.status === "Solo" ? "bg-red-600 text-white" : "bg-slate-100 text-slate-400"
                  }`}
                >
                  <Bed size={24} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-slate-400">Room Number: TBD</p>
                  <p className="text-xs font-black text-slate-800 mt-1 uppercase leading-none">{r.status}</p>
                </div>
              </div>
              <button
                type="button"
                disabled={!canEdit}
                onClick={() => onToggleSolo(r.a.id)}
                className={`px-4 py-2 rounded-xl border text-[9px] font-black uppercase transition-all shadow-sm ${
                  r.status === "Solo" ? "bg-red-100 text-red-700 border-red-200" : "text-slate-500 border-slate-200 hover:border-red-400 hover:text-red-600"
                } disabled:opacity-40`}
              >
                {r.status === "Solo" ? "Set Shared" : "Set Solo"}
              </button>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-4 bg-slate-50/80 rounded-3xl border border-slate-100 group">
                <div className="flex flex-col">
                  <span className="text-sm font-black text-slate-800 leading-none">{r.a.name}</span>
                    <span className="text-[9px] uppercase font-bold text-slate-400 mt-1 tracking-widest leading-none">
                      {formatPositionShort(r.a.role)} · {r.a.gender || "Unspecified"}
                    </span>
                </div>
                <button type="button" disabled={!canEdit} onClick={() => setTarget(r.a)} className="p-2 text-slate-200 hover:text-red-600 transition-colors disabled:opacity-30">
                  <ArrowRightLeft size={16} />
                </button>
              </div>
              {r.b ? (
                <div className="flex justify-between items-center p-4 bg-slate-50/80 rounded-3xl border border-slate-100">
                  <div className="flex flex-col">
                    <span className="text-sm font-black text-slate-800 leading-none">{r.b.name}</span>
                    <span className="text-[9px] uppercase font-bold text-slate-400 mt-1 tracking-widest leading-none">
                      {formatPositionShort(r.b.role)} · {r.b.gender || "Unspecified"}
                    </span>
                  </div>
                  <button type="button" disabled={!canEdit} onClick={() => setTarget(r.b)} className="p-2 text-slate-300 hover:text-red-600 transition-colors disabled:opacity-30">
                    <ArrowRightLeft size={16} />
                  </button>
                </div>
              ) : (
                !r.a.solo && (
                  <button
                    type="button"
                    disabled={!canEdit}
                    onClick={() => setTarget(r.a)}
                    className="w-full p-6 border-2 border-dashed border-amber-200 text-amber-600 rounded-[32px] text-[10px] font-black uppercase tracking-widest bg-white hover:bg-amber-50 transition-all flex items-center justify-center gap-2 shadow-inner disabled:opacity-40"
                  >
                    <UserPlus size={16} /> Assign Partner
                  </button>
                )
              )}
            </div>
            <div className="mt-8 pt-6 border-t border-slate-50 flex justify-between items-center text-[11px] font-bold">
              <span className="text-slate-300 uppercase tracking-widest leading-none">Room Impact</span>
              <span className="text-slate-800 text-lg font-black tracking-tighter leading-none">₱{(Number(r.price) || 0).toLocaleString()}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SponsorshipHub({ sponsors, totalRevenue, eventId, canEdit, onReload, onError }) {
  const [newS, setNewS] = useState({ company: "", tier: "Gold", amount: 0, remarks: "Uncollected" });
  const [isAdding, setIsAdding] = useState(false);

  const saveNew = async () => {
    if (!newS.company || !eventId) return;
    try {
      await createSponsor(eventId, {
        company: newS.company,
        tier: newS.tier,
        amount: newS.amount,
        remarks: newS.remarks,
        paid: newS.remarks === "Collected",
      });
      setNewS({ company: "", tier: "Gold", amount: 0, remarks: "Uncollected" });
      setIsAdding(false);
      await onReload();
    } catch (e) {
      onError?.(e, "Failed to add sponsor.");
    }
  };

  const remove = async (id) => {
    try {
      await deleteSponsor(id);
      await onReload();
    } catch (e) {
      onError?.(e, "Failed to delete sponsor.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-8 rounded-[40px] border flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center text-red-600 shadow-inner">
            <Handshake size={32} />
          </div>
          <div>
            <h3 className="text-xl font-black uppercase text-slate-800">Sponsorship Revenue</h3>
            <p className="text-2xl font-black text-red-600">₱{(Number(totalRevenue) || 0).toLocaleString()}</p>
          </div>
        </div>
        <button
          type="button"
          disabled={!canEdit}
          onClick={() => setIsAdding(!isAdding)}
          className="bg-slate-900 text-white px-8 py-3 rounded-2xl font-black text-xs uppercase shadow-lg transition-all hover:bg-black disabled:opacity-40"
        >
          {isAdding ? "Cancel" : "Add Partner"}
        </button>
      </div>

      {isAdding && (
        <div className="bg-white p-8 rounded-[40px] border-2 border-red-100 shadow-xl grid grid-cols-1 md:grid-cols-4 gap-6">
          <SetupInput label="Company Name" value={newS.company} onChange={(e) => setNewS({ ...newS, company: e.target.value })} />
          <div className="space-y-2">
            <label className="block text-[10px] font-black text-slate-400 uppercase">Tier</label>
            <select
              className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-3 text-sm font-black appearance-none"
              value={newS.tier}
              onChange={(e) => setNewS({ ...newS, tier: e.target.value })}
            >
              <option>Diamond</option>
              <option>Platinum</option>
              <option>Gold</option>
              <option>Silver</option>
            </select>
          </div>
          <SetupInput label="Amount (₱)" type="number" value={newS.amount} onChange={(e) => setNewS({ ...newS, amount: Number(e.target.value) })} />
          <div className="space-y-2">
            <label className="block text-[10px] font-black text-slate-400 uppercase">Status</label>
            <select
              className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-3 text-sm font-black appearance-none"
              value={newS.remarks}
              onChange={(e) => setNewS({ ...newS, remarks: e.target.value })}
            >
              <option value="Uncollected">Uncollected</option>
              <option value="Collected">Collected</option>
            </select>
          </div>
          <div className="md:col-span-4 flex justify-end">
            <button type="button" onClick={saveNew} className="h-[54px] bg-red-600 text-white px-8 rounded-2xl font-black text-xs uppercase flex items-center justify-center gap-2 hover:bg-red-700 shadow-md">
              <Save size={16} /> Commit Partner
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
        {sponsors.map((s) => (
          <div key={s.id} className="bg-white p-8 rounded-[40px] border shadow-sm group relative hover:border-red-200 transition-all">
            <button
              type="button"
              disabled={!canEdit}
              className="absolute top-8 right-8 opacity-0 group-hover:opacity-100 text-slate-200 hover:text-red-500 disabled:opacity-0"
              onClick={() => remove(s.id)}
            >
              <Trash2 size={18} />
            </button>
            <h4 className="text-xl font-black uppercase text-slate-800 tracking-tighter leading-tight min-h-[3rem]">{s.company}</h4>
            <div className="flex items-center gap-2 mt-4">
              <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-red-50 text-red-600 rounded border border-red-100">{s.tier}</span>
              <span
                className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border ${
                  s.remarks === "Collected" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                }`}
              >
                {s.remarks}
              </span>
            </div>
            <div className="pt-6 mt-6 border-t border-slate-50 flex justify-between items-center">
              <span className="text-[10px] font-black text-slate-400">Total Contribution</span>
              <span className="text-2xl font-black">₱{(Number(s.amount) || 0).toLocaleString()}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SuppliersHub({ suppliers, totalSpend, eventId, canEdit, onReload, onError, onSeedExpenses }) {
  const [newV, setNewV] = useState({ company: "", category: "Decor", amount: 0 });
  const [isAdding, setIsAdding] = useState(false);
  const categories = [
    "Accommodation & Banquets",
    "Speakers & Talent",
    "Lights and Sounds",
    "Decor",
    "Program Materials",
    "Supplies",
    "Miscellaneous",
    "Band/Entertainment",
    "LED Wall",
    "Others",
  ];

  const handleAdd = async () => {
    if (!newV.company || !eventId) return;
    try {
      await createExpense(eventId, {
        supplier: newV.company,
        category: newV.category,
        amount: newV.amount,
        expenseType: "fixed",
        approved: true,
      });
      setNewV({ company: "", category: "Decor", amount: 0 });
      setIsAdding(false);
      await onReload();
    } catch (e) {
      onError?.(e, "Failed to add supplier.");
    }
  };

  const remove = async (id) => {
    try {
      await deleteExpense(id);
      await onReload();
    } catch (e) {
      onError?.(e, "Failed to delete expense.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-8 rounded-[40px] border shadow-sm flex justify-between items-center">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 shadow-inner">
            <Truck size={32} />
          </div>
          <div>
            <h3 className="text-xl font-black uppercase text-slate-800">Contractor Hub</h3>
            <p className="text-2xl font-black text-blue-600">₱{(Number(totalSpend) || 0).toLocaleString()}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={!canEdit || !eventId}
            onClick={() => onSeedExpenses?.()}
            className="border border-blue-200 bg-blue-50 text-blue-700 px-6 py-3 rounded-2xl font-black text-xs uppercase hover:bg-blue-100 transition-all disabled:opacity-40"
          >
            Seed expense list
          </button>
          <button
            type="button"
            disabled={!canEdit}
            onClick={() => setIsAdding(!isAdding)}
            className="bg-slate-900 text-white px-8 py-3 rounded-2xl font-black text-xs uppercase shadow-lg hover:bg-black transition-all disabled:opacity-40"
          >
            {isAdding ? "Cancel" : "Add Supplier"}
          </button>
        </div>
      </div>
      {isAdding && (
        <div className="bg-white p-8 rounded-[40px] border-2 border-blue-100 shadow-xl grid grid-cols-1 md:grid-cols-3 gap-6">
          <SetupInput label="Vendor Name" value={newV.company} onChange={(e) => setNewV({ ...newV, company: e.target.value })} />
          <div className="space-y-2">
            <label className="block text-[10px] font-black text-slate-400 uppercase">Category</label>
            <select
              className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-3.5 text-sm font-black appearance-none"
              value={newV.category}
              onChange={(e) => setNewV({ ...newV, category: e.target.value })}
            >
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end gap-4">
            <SetupInput label="Fee (₱)" type="number" value={newV.amount} onChange={(e) => setNewV({ ...newV, amount: Number(e.target.value) })} />
            <button type="button" onClick={handleAdd} className="h-[54px] bg-blue-600 text-white px-8 rounded-2xl font-black text-xs uppercase flex items-center justify-center gap-2 hover:bg-blue-700 shadow-md">
              <Save size={16} /> Save
            </button>
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
        {suppliers.map((s) => (
          <div key={s.id} className="bg-white p-8 rounded-[40px] border shadow-sm group relative hover:border-blue-200 transition-all">
            <button
              type="button"
              disabled={!canEdit}
              className="absolute top-8 right-8 opacity-0 group-hover:opacity-100 text-slate-200 hover:text-red-500 transition-all disabled:opacity-0"
              onClick={() => remove(s.id)}
            >
              <Trash2 size={18} />
            </button>
            <h4 className="text-xl font-black uppercase text-slate-800 tracking-tighter leading-tight min-h-[3rem]">{s.company}</h4>
            <span className="text-[9px] font-black uppercase px-2 py-1 bg-slate-50 border border-slate-100 rounded-md text-slate-500 mt-2 inline-block">{s.category}</span>
            <div className="pt-6 mt-6 border-t border-slate-50 flex justify-between items-center">
              <span className="text-2xl font-black text-slate-800">₱{(Number(s.amount) || 0).toLocaleString()}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SpeakersHub({ speakers, eventId, canEdit, onReload, onError, totalHonorarium }) {
  const [editing, setEditing] = useState(null);
  const cats = ["Best Practice Sharer", "Panel", "Keynote Speaker", "Workshop", "Others"];

  const addSlot = async () => {
    if (!eventId) return;
    try {
      await createSpeaker(eventId, {
        talk: `Talk ${speakers.length + 1}`,
        name: "",
        topic: "",
        classification: "Others",
        honorarium: 0,
      });
      await onReload();
    } catch (e) {
      onError?.(e, "Failed to add speaker slot.");
    }
  };

  const handleSave = async () => {
    if (!editing) return;
    try {
      await patchSpeaker(editing.id, editing);
      setEditing(null);
      await onReload();
    } catch (e) {
      onError?.(e, "Failed to save speaker.");
    }
  };

  const remove = async (id) => {
    try {
      await deleteSpeaker(id);
      await onReload();
    } catch (e) {
      onError?.(e, "Failed to delete speaker.");
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="bg-white p-8 rounded-[40px] border flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center text-red-600 shadow-inner">
            <Mic size={32} />
          </div>
          <div>
            <h3 className="text-xl font-black uppercase text-slate-800">Speakers & Talent</h3>
            <p className="text-2xl font-black text-red-600">₱{(Number(totalHonorarium) || 0).toLocaleString()}</p>
          </div>
        </div>
        <button type="button" disabled={!canEdit} onClick={addSlot} className="bg-slate-900 text-white px-8 py-3 rounded-2xl font-black text-xs uppercase shadow-lg hover:bg-black transition-all disabled:opacity-40">
          Add talk Slot
        </button>
      </div>

      {editing && (
        <div className="bg-white p-10 rounded-[40px] border-2 border-red-100 shadow-xl space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <SetupInput label="Name" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            <SetupInput label="Topic" value={editing.topic} onChange={(e) => setEditing({ ...editing, topic: e.target.value })} />
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase">Class</label>
              <select
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-3.5 text-sm font-black appearance-none"
                value={editing.classification}
                onChange={(e) => setEditing({ ...editing, classification: e.target.value })}
              >
                {cats.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end gap-4">
              <SetupInput label="Honorarium (₱)" type="number" value={editing.honorarium} onChange={(e) => setEditing({ ...editing, honorarium: Number(e.target.value) })} />
              <button type="button" onClick={handleSave} className="h-[54px] bg-red-600 text-white px-8 rounded-2xl font-black text-xs uppercase flex items-center justify-center gap-2 hover:bg-red-700 shadow-md">
                <Save size={16} /> Save Speaker
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {speakers.map((s) => (
          <div key={s.id} className="bg-white p-8 rounded-[40px] border shadow-sm group relative hover:border-red-100 transition-all">
            <div className="flex justify-between mb-4">
              <span className="text-[10px] font-black text-red-500 uppercase">{s.talk}</span>
              <div className="flex gap-2 opacity-0 group-hover:opacity-100">
                <button type="button" disabled={!canEdit} onClick={() => setEditing(s)} className="text-slate-300 hover:text-red-600 transition-all disabled:opacity-30">
                  <Edit3 size={18} />
                </button>
                <button type="button" disabled={!canEdit} onClick={() => remove(s.id)} className="text-slate-300 hover:text-red-600 transition-all disabled:opacity-30">
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
            <h4 className="text-xl font-black uppercase text-slate-800 tracking-tighter leading-tight min-h-[3rem]">{s.name || "UNASSIGNED"}</h4>
            <p className="text-sm font-bold text-slate-400 mt-1 uppercase italic leading-none">{s.classification}</p>
            <div className="pt-6 mt-6 border-t border-slate-50 flex justify-between items-center">
              <span className="text-2xl font-black text-slate-800">₱{(Number(s.honorarium) || 0).toLocaleString()}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PaymentsHub({ config, realized, projection }) {
  const gap = projection - realized;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-10 pb-20">
      <div className="bg-white p-10 rounded-[50px] border shadow-sm flex flex-col justify-between min-h-[300px]">
        <div>
          <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 mb-8 shadow-inner">
            <CreditCard size={32} />
          </div>
          <h3 className="text-2xl font-black uppercase tracking-tight text-slate-800 leading-none">Installment Rules</h3>
          <p className="text-6xl font-black tracking-tighter text-slate-800 mt-4 leading-none">₱{(Number(config.umInstallment) || 0).toLocaleString()}</p>
        </div>
        <p className="text-[10px] font-black text-slate-400 mt-8 uppercase tracking-widest leading-none">Base Fixed UM Monthly Rate</p>
      </div>
      <div className="bg-red-600 p-10 rounded-[50px] text-white shadow-2xl flex flex-col justify-between min-h-[300px]">
        <div>
          <h3 className="text-2xl font-black uppercase tracking-tight text-white/60 leading-none">Revenue Bridge</h3>
          <p className="text-6xl font-black tracking-tighter mt-4 leading-none">₱{(Number(gap) || 0).toLocaleString()}</p>
        </div>
        <p className="text-[10px] font-black opacity-40 mt-10 uppercase tracking-widest italic leading-none">Projection Target: ₱{(projection / 1000).toFixed(0)}k</p>
      </div>
    </div>
  );
}

function ExpenseDashboard({ config, suppliers }) {
  const modules = Array.isArray(config.expenseBudgetModules) && config.expenseBudgetModules.length > 0 ? config.expenseBudgetModules : DEFAULT_EXPENSE_BUDGET_MODULES;
  const normalizeCategory = (row) => {
    const raw = String(row?.category || "").trim();
    if (raw !== "Others") return raw;
    const name = String(row?.company || "").toLowerCase();
    if (name.includes("waterfront hotel") || name === "drinks" || name === "rooms") return "Accommodation & Banquets";
    if (name.includes("speaker honorarium") || name.includes("tokens to speakers")) return "Speakers & Talent";
    if (name.includes("certificate")) return "Program Materials";
    if (name.includes("graphic artist")) return "Decor";
    if (name.includes("supplies")) return "Supplies";
    if (name === "tip") return "Miscellaneous";
    return raw;
  };
  const sumByCategories = (cats) => {
    const set = new Set((cats || []).map((x) => String(x || "").trim()));
    return suppliers
      .filter((s) => set.has(normalizeCategory(s)))
      .reduce((sum, x) => sum + (Number(x.amount) || 0), 0);
  };
  const iconForLabel = (label) => {
    const l = String(label || "").toLowerCase();
    if (l.includes("banquet") || l.includes("accommodation")) return UtensilsCrossed;
    if (l.includes("speaker") || l.includes("talent")) return Mic;
    if (l.includes("light") || l.includes("sound")) return Volume2;
    if (l.includes("decor") || l.includes("creative")) return Sparkles;
    if (l.includes("led")) return Tv;
    return Truck;
  };
  const BudgetBar = ({ l, b, s, i: IconComp }) => {
    const r = b > 0 ? (s / b) * 100 : 0;
    return (
      <div className="space-y-4 group">
        <div className="flex justify-between items-end">
          <div className="flex items-center gap-3">
            {IconComp && (
              <div className="p-2 bg-slate-50 rounded-lg">
                <IconComp size={16} />
              </div>
            )}
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 leading-none">{l}</p>
              <p className="text-xl font-black text-slate-800 mt-1 tracking-tighter">₱{(Number(s) || 0).toLocaleString()}</p>
            </div>
          </div>
          <span className="text-[10px] font-bold text-slate-400 uppercase italic leading-none">Limit: ₱{(Number(b) || 0).toLocaleString()}</span>
        </div>
        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden shadow-inner relative">
          <div className="bg-red-600 h-full transition-all duration-1000" style={{ width: `${Math.min(r, 100)}%` }} />
        </div>
      </div>
    );
  };
  return (
    <div className="bg-white rounded-[50px] border p-12 space-y-12 shadow-sm relative overflow-hidden pb-20">
      <div className="relative z-10">
        <h3 className="text-3xl font-black uppercase tracking-tight text-slate-800">Expense Dashboard</h3>
        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1 italic">Budget modules from editable array mapping</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-24 gap-y-12 relative z-10">
        {modules.map((m, idx) => (
          <BudgetBar
            key={`${m.label}-${idx}`}
            l={m.label}
            b={Number(m.budget) || 0}
            s={sumByCategories(m.categories)}
            i={iconForLabel(m.label)}
          />
        ))}
      </div>
    </div>
  );
}

function emptyProgramRow(day = "Day 2 - May 14") {
  return { day, time: "", program: "", assigned: "" };
}

function ProgramModulesView({ config, setConfig, eventId, canEdit, onError }) {
  const [rows, setRows] = useState(() =>
    Array.isArray(config.programModules) && config.programModules.length > 0 ? config.programModules : DEFAULT_PROGRAM_MODULES
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setRows(Array.isArray(config.programModules) && config.programModules.length > 0 ? config.programModules : DEFAULT_PROGRAM_MODULES);
  }, [config.programModules]);

  const updateRow = (idx, key, value) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [key]: value } : r)));
  };

  const removeRow = (idx) => {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const addRow = (day) => {
    setRows((prev) => [...prev, emptyProgramRow(day)]);
  };

  const handleSave = async () => {
    if (!eventId || !canEdit) return;
    const cleaned = rows
      .map((r) => ({
        day: String(r.day || "").trim(),
        time: String(r.time || "").trim(),
        program: String(r.program || "").trim(),
        assigned: String(r.assigned || "").trim(),
      }))
      .filter((r) => r.day || r.time || r.program || r.assigned);
    try {
      setSaving(true);
      const nextConfig = { ...config, programModules: cleaned };
      await patchEvent(eventId, {
        attendeeGoal: config.targetRegistrants,
        config: nextConfig,
      });
      setConfig(nextConfig);
      setSaved(true);
      setTimeout(() => setSaved(false), 1600);
    } catch (e) {
      onError?.(e, "Failed to save program modules.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="bg-white p-8 rounded-[40px] border shadow-sm flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h3 className="text-xl font-black uppercase text-slate-800">Program Modules</h3>
          <p className="text-sm text-slate-500 mt-1">Editable agenda array for Day 1 and Day 2 blocks.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" disabled={!canEdit} onClick={() => addRow("Day 1 - May 13")} className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40">
            + Day 1 row
          </button>
          <button type="button" disabled={!canEdit} onClick={() => addRow("Day 2 - May 14")} className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40">
            + Day 2 row
          </button>
          <button
            type="button"
            disabled={!canEdit || saving}
            onClick={handleSave}
            className={`px-5 py-2.5 rounded-xl text-sm font-semibold text-white ${saved ? "bg-emerald-600" : "bg-red-600 hover:bg-red-700"} disabled:opacity-40`}
          >
            {saving ? "Saving..." : saved ? "Saved" : "Save program"}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-[32px] border shadow-sm overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead className="bg-slate-50 border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left">Day</th>
              <th className="px-4 py-3 text-left">Time</th>
              <th className="px-4 py-3 text-left">Program</th>
              <th className="px-4 py-3 text-left">Assigned</th>
              <th className="px-4 py-3 text-center w-24">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r, idx) => (
              <tr key={idx} className="hover:bg-slate-50/60">
                <td className="px-4 py-3">
                  <select
                    value={r.day || ""}
                    disabled={!canEdit}
                    onChange={(e) => updateRow(idx, "day", e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 disabled:opacity-50"
                  >
                    <option value="Day 1 - May 13">Day 1 - May 13</option>
                    <option value="Day 2 - May 14">Day 2 - May 14</option>
                  </select>
                </td>
                <td className="px-4 py-3">
                  <input value={r.time || ""} disabled={!canEdit} onChange={(e) => updateRow(idx, "time", e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 disabled:opacity-50" />
                </td>
                <td className="px-4 py-3">
                  <input value={r.program || ""} disabled={!canEdit} onChange={(e) => updateRow(idx, "program", e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 disabled:opacity-50" />
                </td>
                <td className="px-4 py-3">
                  <input value={r.assigned || ""} disabled={!canEdit} onChange={(e) => updateRow(idx, "assigned", e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 disabled:opacity-50" />
                </td>
                <td className="px-4 py-3 text-center">
                  <button type="button" disabled={!canEdit} onClick={() => removeRow(idx)} className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-30">
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SetupView({ config, setConfig, eventId, canEdit, isAdmin, isSuperuser, onSaved, onError, onInfo, profile, onSaveProfile, profileSaving }) {
  const [local, setLocal] = useState(config);
  const [saved, setSaved] = useState(false);
  const [userRoles, setUserRoles] = useState([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [roleForm, setRoleForm] = useState({ email: "", role: "attendee" });
  const [setupTab, setSetupTab] = useState("general");
  const [selectedPosterSlot, setSelectedPosterSlot] = useState(0);

  useEffect(() => {
    setLocal(config);
  }, [config]);

  useEffect(() => {
    if (!canEdit || !isAdmin) return;
    let cancelled = false;
    setRolesLoading(true);
    getUserRoles()
      .then((res) => {
        if (!cancelled) setUserRoles(res.items || []);
      })
      .catch((e) => {
        if (!cancelled) onError?.(e, "Failed to load account roles.");
      })
      .finally(() => {
        if (!cancelled) setRolesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [canEdit, isAdmin, onError]);

  const handleSave = async () => {
    if (!eventId || !canEdit) return;
    try {
      await patchEvent(eventId, {
        attendeeGoal: local.targetRegistrants,
        config: local,
      });
      setConfig(local);
      setSaved(true);
      onInfo?.("Configuration saved.");
      setTimeout(() => setSaved(false), 2000);
      await onSaved();
    } catch (e) {
      onError?.(e, "Failed to save configuration.");
    }
  };

  const expenseModules =
    Array.isArray(local.expenseBudgetModules) && local.expenseBudgetModules.length > 0
      ? local.expenseBudgetModules
      : DEFAULT_EXPENSE_BUDGET_MODULES;

  const updateExpenseModule = (idx, key, value) => {
    const next = expenseModules.map((m, i) => (i === idx ? { ...m, [key]: value } : m));
    setLocal({ ...local, expenseBudgetModules: next });
  };

  const updateExpenseModuleCategories = (idx, csv) => {
    const cats = String(csv || "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    updateExpenseModule(idx, "categories", cats);
  };

  const addExpenseModule = () => {
    setLocal({
      ...local,
      expenseBudgetModules: [
        ...expenseModules,
        { label: "New Module", budget: 0, categories: ["Others"] },
      ],
    });
  };

  const removeExpenseModule = (idx) => {
    setLocal({
      ...local,
      expenseBudgetModules: expenseModules.filter((_, i) => i !== idx),
    });
  };

  const handleSaveRole = async () => {
    if (!canEdit || !isSuperuser) return;
    const email = String(roleForm.email || "").trim().toLowerCase();
    if (!email) return;
    try {
      await upsertUserRole({ email, role: roleForm.role });
      const res = await getUserRoles();
      setUserRoles(res.items || []);
      setRoleForm({ email: "", role: "attendee" });
      onInfo?.("Role saved.");
    } catch (e) {
      onError?.(e, "Failed to save account role.");
    }
  };

  const handleDeleteRole = async (email) => {
    if (!canEdit || !isSuperuser) return;
    if (!window.confirm(`Remove role override for ${email}?`)) return;
    try {
      await deleteUserRole(email);
      const res = await getUserRoles();
      setUserRoles(res.items || []);
      onInfo?.("Role override removed.");
    } catch (e) {
      onError?.(e, "Failed to remove role override.");
    }
  };

  const portalConfig = {
    youtubeUrl: "",
    quoteRequestEmail: "",
    posterDisplayCount: 3,
    posterImageUrls: ["", "", "", "", "", ""],
    ...(local.attendeePortal || {}),
  };
  const posterUrls = [...(portalConfig.posterImageUrls || []), "", "", "", "", "", ""].slice(0, 6);
  const updatePortalConfig = (patch) => {
    setLocal({
      ...local,
      attendeePortal: {
        ...portalConfig,
        ...patch,
      },
    });
  };
  const updatePosterSlot = (slotIdx, value) => {
    const next = [...posterUrls];
    next[slotIdx] = String(value || "").trim();
    updatePortalConfig({ posterImageUrls: next });
  };
  const handlePosterFileUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        updatePosterSlot(selectedPosterSlot, reader.result);
      }
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  return (
    <div className="bg-white rounded-[50px] border p-12 pb-24 shadow-sm relative">
      <div className="flex justify-between items-center mb-12 relative z-10">
        <h3 className="text-2xl font-black uppercase tracking-tight text-slate-800 leading-none">System Administration</h3>
        <button
          type="button"
          disabled={!canEdit}
          onClick={handleSave}
          className={`px-10 py-3.5 rounded-2xl font-black text-xs uppercase shadow-xl transition-all ${
            saved ? "bg-emerald-500 text-white shadow-emerald-100" : "bg-red-600 text-white shadow-red-100"
          } disabled:opacity-40`}
        >
          {saved ? "Committed" : "Commit Configuration"}
        </button>
      </div>
      <div className="mb-8 flex flex-wrap gap-2">
        {[
          { id: "general", label: "General" },
          { id: "budget", label: "Budget" },
          ...(isAdmin ? [{ id: "roles", label: "Roles" }] : []),
          { id: "profile", label: "Profile" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSetupTab(tab.id)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold border ${
              setupTab === tab.id ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {setupTab === "general" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-16 relative z-10">
          <div className="space-y-8">
            <h4 className="text-[10px] font-black uppercase text-red-600 border-b pb-4 tracking-[0.2em] leading-none">Operational Metrics</h4>
            <SetupInput
              label="Target Participant Count"
              type="number"
              value={local.targetRegistrants}
              onChange={(e) => setLocal({ ...local, targetRegistrants: Number(e.target.value) })}
            />
            <SetupInput label="Standard Room Rate" type="number" value={local.roomRate} onChange={(e) => setLocal({ ...local, roomRate: Number(e.target.value) })} />
            <SetupInput label="Solo Upgrade Fee" type="number" value={local.soloUpgrade} onChange={(e) => setLocal({ ...local, soloUpgrade: Number(e.target.value) })} />
            <SetupInput label="UM Installment Base" type="number" value={local.umInstallment} onChange={(e) => setLocal({ ...local, umInstallment: Number(e.target.value) })} />
          </div>
          <div className="space-y-8">
            <h4 className="text-[10px] font-black uppercase text-blue-600 border-b pb-4 tracking-[0.2em] leading-none">Budgetary Projections</h4>
            <SetupInput
              label="Banquet Projection"
              type="number"
              value={local.projections.hotelFunction}
              onChange={(e) => setLocal({ ...local, projections: { ...local.projections, hotelFunction: Number(e.target.value) } })}
            />
            <SetupInput
              label="Room Block Projection"
              type="number"
              value={local.projections.rooms}
              onChange={(e) => setLocal({ ...local, projections: { ...local.projections, rooms: Number(e.target.value) } })}
            />
            <SetupInput
              label="Honorarium Fund Max"
              type="number"
              value={local.projections.speakerHonorarium}
              onChange={(e) => setLocal({ ...local, projections: { ...local.projections, speakerHonorarium: Number(e.target.value) } })}
            />
            <div className="space-y-4 rounded-2xl border border-slate-200 p-4 bg-slate-50/50">
              <h5 className="text-[10px] font-black uppercase text-slate-600 tracking-[0.2em] leading-none">Attendee Portal Posters</h5>
              <label className="block space-y-1">
                <span className="text-xs font-semibold text-slate-600">No. of posters to display (1-6)</span>
                <input
                  type="number"
                  min={1}
                  max={6}
                  disabled={!canEdit}
                  value={Number(portalConfig.posterDisplayCount) || 3}
                  onChange={(e) =>
                    updatePortalConfig({
                      posterDisplayCount: Math.max(1, Math.min(6, Number(e.target.value) || 3)),
                    })
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 disabled:opacity-50"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-semibold text-slate-600">Select slot to update</span>
                <select
                  disabled={!canEdit}
                  value={selectedPosterSlot}
                  onChange={(e) => setSelectedPosterSlot(Number(e.target.value) || 0)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 disabled:opacity-50"
                >
                  {posterUrls.map((_, idx) => (
                    <option key={idx} value={idx}>
                      Slot {idx + 1}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-semibold text-slate-600">Poster URL for selected slot</span>
                <input
                  disabled={!canEdit}
                  value={posterUrls[selectedPosterSlot] || ""}
                  onChange={(e) => updatePosterSlot(selectedPosterSlot, e.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 disabled:opacity-50"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-semibold text-slate-600">Upload placeholder/image to selected slot</span>
                <input
                  type="file"
                  accept="image/*"
                  disabled={!canEdit}
                  onChange={handlePosterFileUpload}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold disabled:opacity-50"
                />
              </label>
              <div className="grid grid-cols-3 gap-2">
                {posterUrls.map((src, idx) => (
                  <button
                    type="button"
                    key={idx}
                    onClick={() => setSelectedPosterSlot(idx)}
                    className={`rounded-xl border p-2 text-left ${selectedPosterSlot === idx ? "border-red-300 bg-red-50" : "border-slate-200 bg-white"}`}
                  >
                    <p className="text-[11px] font-semibold text-slate-600">Slot {idx + 1}</p>
                    <p className="text-[10px] text-slate-500 truncate">{src ? "Configured" : "Empty"}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      {setupTab === "budget" && <div className="mt-2 relative z-10 space-y-5">
        <div className="flex items-center justify-between gap-4">
          <h4 className="text-[10px] font-black uppercase text-slate-600 border-b pb-3 tracking-[0.2em] leading-none flex-1">
            Expense Budget Modules (Editable Array)
          </h4>
          <button
            type="button"
            disabled={!canEdit}
            onClick={addExpenseModule}
            className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            + Add module
          </button>
        </div>
        <div className="overflow-x-auto border border-slate-200 rounded-2xl">
          <table className="w-full min-w-[880px]">
            <thead className="bg-slate-50 border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left">Label</th>
                <th className="px-4 py-3 text-right">Budget</th>
                <th className="px-4 py-3 text-left">Categories (comma-separated)</th>
                <th className="px-4 py-3 text-center w-24">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {expenseModules.map((m, idx) => (
                <tr key={`${m.label}-${idx}`} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3">
                    <input
                      value={m.label || ""}
                      disabled={!canEdit}
                      onChange={(e) => updateExpenseModule(idx, "label", e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 disabled:opacity-50"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      value={Number(m.budget) || 0}
                      disabled={!canEdit}
                      onChange={(e) => updateExpenseModule(idx, "budget", Number(e.target.value))}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 text-right disabled:opacity-50"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      value={(m.categories || []).join(", ")}
                      disabled={!canEdit}
                      onChange={(e) => updateExpenseModuleCategories(idx, e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 disabled:opacity-50"
                    />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      type="button"
                      disabled={!canEdit}
                      onClick={() => removeExpenseModule(idx)}
                      className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-30"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>}
      {setupTab === "roles" && isAdmin && <div className="mt-2 relative z-10 space-y-5">
        <h4 className="text-[10px] font-black uppercase text-slate-600 border-b pb-3 tracking-[0.2em] leading-none">
          Account Roles (Viewer/Working Team/Admin)
        </h4>
        {!isSuperuser ? (
          <p className="text-sm text-slate-600 rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3">
            Only a <strong>superuser</strong> (email listed in <code className="text-xs">VITE_SUPERUSER_EMAILS</code> / worker{" "}
            <code className="text-xs">SUPERUSER_EMAILS</code>) can promote accounts to <strong>Working Team</strong> or <strong>Admin</strong>. You can review the list
            below; ask a superuser to make changes.
          </p>
        ) : null}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_180px_120px] gap-3">
          <input
            value={roleForm.email}
            disabled={!canEdit || !isSuperuser}
            onChange={(e) => setRoleForm((s) => ({ ...s, email: e.target.value }))}
            placeholder="user@email.com"
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 disabled:opacity-50"
          />
          <select
            value={roleForm.role}
            disabled={!canEdit || !isSuperuser}
            onChange={(e) => setRoleForm((s) => ({ ...s, role: e.target.value }))}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 disabled:opacity-50"
          >
            <option value="attendee">Viewer</option>
            <option value="staff">Working Team</option>
            <option value="admin">Admin</option>
          </select>
          <button
            type="button"
            disabled={!canEdit || !isSuperuser}
            onClick={handleSaveRole}
            className="rounded-xl bg-slate-900 text-white text-sm font-semibold px-3 py-2 disabled:opacity-40"
          >
            Save role
          </button>
        </div>
        <div className="border border-slate-200 rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">Role</th>
                <th className="px-4 py-3 text-center w-24">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rolesLoading && (
                <tr>
                  <td className="px-4 py-3 text-sm text-slate-500" colSpan={3}>
                    Loading roles...
                  </td>
                </tr>
              )}
              {!rolesLoading &&
                userRoles.map((r) => (
                  <tr key={r.email}>
                    <td className="px-4 py-3 text-sm text-slate-700">{r.email}</td>
                    <td className="px-4 py-3 text-sm text-slate-700 capitalize">{r.role === "attendee" ? "Viewer" : r.role === "staff" ? "Working Team" : r.role}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        disabled={!canEdit || !isSuperuser}
                        onClick={() => handleDeleteRole(r.email)}
                        className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-30"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              {!rolesLoading && userRoles.length === 0 && (
                <tr>
                  <td className="px-4 py-3 text-sm text-slate-500" colSpan={3}>
                    No role overrides yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>}
      {setupTab === "profile" && (
        <div className="mt-2 relative z-10">
          <ProfileModule profile={profile} onSave={onSaveProfile} saving={profileSaving} title="View Profile / Edit Profile" />
        </div>
      )}
    </div>
  );
}
