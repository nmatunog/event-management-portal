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
  UserCheck,
  Download,
  FileSignature,
  CheckCircle2,
  MessageSquare,
} from "lucide-react";
import ParticipantPortal from "./ParticipantPortal";
import PaymentVouchersHub from "./PaymentVouchersHub";
import SupplierVouchersPanel from "./SupplierVouchersPanel";
import EventExpenseReport from "./EventExpenseReport";
import EventFeedbackHub from "./EventFeedbackHub";
import {
  createEvent,
  createExpense,
  createRegistration,
  createSpeaker,
  createSponsor,
  deleteUserRole,
  deleteExpense,
  patchExpense,
  deleteSpeaker,
  deleteSponsor,
  patchSponsor,
  getEvents,
  getExpenses,
  getRegistrations,
  getRegistration,
  deleteRegistration,
  getUserRoles,
  getSpeakers,
  getSponsors,
  harmonizeRegistrations,
  patchEvent,
  patchRegistration,
  patchSpeaker,
  checkInRegistration,
  upsertUserRole,
} from "../lib/api";
import {
  ATTENDEE_POSTER_MAX,
  DEFAULT_EXPENSE_BUDGET_MODULES,
  DEFAULT_PAMACON_CONFIG,
  DEFAULT_PROGRAM_MODULES,
  mergeConfigFromEvent,
  PAMACON_TITLE,
} from "./defaultConfig";
import { buildRoomAssignments, isExcludedFromRoomAssignments } from "./rooming";
import { formatPositionShort, positionBadgeClass, POSITION_CODES } from "./positionCodes";
import { PAMACON_SEED_EXPENSES } from "./seedExpenses";
import {
  DEFAULT_EXPENSE_CATEGORY,
  EXPENSE_CATEGORY_GROUPS,
  groupExpensesByCategory,
  normalizeExpenseCategory,
} from "./expenseCategories";
import SpeakerMaterialsSetup from "./SpeakerMaterialsSetup";
import { inferSeedRole, modeToPaymentPlan, PAMACON_SEED_DELEGATES } from "./seedDelegates";
import { parseSeedListOcrRows } from "./parseSeedListOcrRows";
import ProfileModule from "../components/ProfileModule";
import DelegateOnsiteDesk from "./DelegateOnsiteDesk";
import DelegateWorkingTeamPanel from "./DelegateWorkingTeamPanel";
import { PORTAL_ROLE_OPTIONS, portalRoleLabel, resolveDelegatePortalEmail } from "./delegatePortalAccess";
import {
  isDelegatePhaseCheckedIn,
  normalizeCheckInPhase,
  onsiteMasterlistHeaders,
  onsiteMasterlistRow,
} from "./delegateOnsite";
import {
  DELEGATE_SHIRT_SIZE_SELECT,
  effectiveShirtOrderBucket,
  formatShirtSizeCell,
  isParticipantShirtEditOpenNow,
  participantShirtDeadlineLabel,
} from "./shirtOrderingPolicy";

/** Survives React Strict Mode remount (useRef resets); blocks a second full seed while the DB is still empty. */
const delegateSeedStartedForEventId = new Set();

/** Re-encode raster image data URLs as JPEG so Setup posters / reference shots stay under D1 `config_json` limits. */
function reencodeImageDataUrlAsJpeg(dataUrl, maxSide, quality) {
  return new Promise((resolve) => {
    const s = String(dataUrl || "");
    if (!s.startsWith("data:image/") || s.startsWith("data:image/svg")) {
      resolve(s);
      return;
    }
    const img = new Image();
    img.onload = () => {
      try {
        let w = img.naturalWidth;
        let h = img.naturalHeight;
        if (!w || !h) {
          resolve(s);
          return;
        }
        const scale = Math.min(1, maxSide / Math.max(w, h));
        w = Math.round(w * scale);
        h = Math.round(h * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(s);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        const out = canvas.toDataURL("image/jpeg", quality);
        resolve(out.length && out.length < s.length ? out : s);
      } catch {
        resolve(s);
      }
    };
    img.onerror = () => resolve(s);
    img.src = s;
  });
}

function csvEscapeCell(value) {
  const s = String(value ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadCsv(filename, header, rows) {
  const lines = [
    header.map(csvEscapeCell).join(","),
    ...rows.map((r) => (Array.isArray(r) ? r : []).map(csvEscapeCell).join(",")),
  ];
  const blob = new Blob([`\uFEFF${lines.join("\n")}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

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
    aiaAgentCode: meta.aiaAgentCode || "",
    mobileNumber: meta.mobileNumber || meta.attendeeClaimMobile || "",
    roomNumber: meta.roomNumber || "",
    checkedInAt: row.checked_in_at || "",
    venueArrivalCheckInAt: meta.venueArrivalCheckInAt || meta.onsiteRegisteredAt || "",
    venueArrivalCheckInBy: meta.venueArrivalCheckInBy || meta.onsiteRegisteredBy || "",
    hallEntryCheckInAt: meta.hallEntryCheckInAt || "",
    hallEntryCheckInBy: meta.hallEntryCheckInBy || "",
    onsiteRegisteredAt: meta.onsiteRegisteredAt || meta.venueArrivalCheckInAt || "",
    onsiteRegisteredBy: meta.onsiteRegisteredBy || meta.venueArrivalCheckInBy || "",
    shirtSize: meta.shirtSize || "",
    shirtSizeOther: meta.shirtSizeOther || "",
    committeeShirtSize: meta.committeeShirtSize || "",
    committeeShirtSizeOther: meta.committeeShirtSizeOther || "",
    tshirtClaimed: Boolean(meta.tshirtClaimed),
    conferenceKitClaimed: Boolean(meta.conferenceKitClaimed),
    paymentProofScreenshotDataUrl: meta.paymentProofScreenshotDataUrl || "",
    hasPaymentProof: Boolean(row.has_payment_proof ?? meta.paymentProofScreenshotDataUrl),
    paymentProofUploadedAt: meta.paymentProofUploadedAt || "",
    paymentValidationStatus: String(meta.paymentValidationStatus || "pending"),
    paymentValidatedAt: meta.paymentValidatedAt || "",
    paymentValidatedBy: meta.paymentValidatedBy || "",
    activityRegistrationConfirmed: Boolean(meta.activityRegistrationConfirmed),
    activityPaymentMethod: String(meta.activityPaymentMethod || ""),
    activityPaymentReference: String(meta.activityPaymentReference || ""),
    activityPaymentAmount: String(meta.activityPaymentAmount || ""),
    activityPaymentSenderNumber: String(meta.activityPaymentSenderNumber || ""),
    activityPaymentProofScreenshotDataUrl: String(meta.activityPaymentProofScreenshotDataUrl || ""),
    hasActivityPaymentProof: Boolean(row.has_activity_payment_proof ?? meta.activityPaymentProofScreenshotDataUrl),
    activityPaymentProofUploadedAt: String(meta.activityPaymentProofUploadedAt || ""),
    activityPaymentConfirmedAt: String(meta.activityPaymentConfirmedAt || ""),
    activityPaymentStatus: String(meta.activityPaymentStatus || "pending"),
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
    { id: "feedback", title: "Event evaluation", desc: "Analytics, AI strategy & next PAMACON actions", icon: MessageSquare, group: "Insights" },
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
  "other-activities": { title: "Other activities", subtitle: "Post-event tour interests and requests" },
  accommodation: { title: "Room assignments", subtitle: "Pairing and solo occupancy" },
  program: { title: "Program modules", subtitle: "Agenda blocks, timings, and assignments" },
  sponsorship: { title: "Sponsorship", subtitle: "Partners and commitments" },
  speakers: { title: "Speakers & talent", subtitle: "Talks and honoraria" },
  suppliers: { title: "Suppliers & contractors", subtitle: "Vendor spend by category" },
  "payment-vouchers": { title: "Payment vouchers", subtitle: "Supplier payment acknowledgment links" },
  payments: { title: "Payments & rules", subtitle: "Installments and revenue bridge" },
  expenses: { title: "Budget vs actual", subtitle: "Expense lines against limits" },
  setup: { title: "Event setup", subtitle: "Targets, rates, and projections" },
  profile: { title: "View profile", subtitle: "Personal account information" },
  feedback: { title: "Event evaluation", subtitle: "Survey analytics, written feedback, and AI planning for next PAMACON" },
};

const NAV_GROUPS = [
  {
    label: "Start here",
    items: [
      { id: "dashboard", label: "Overview", icon: Layout },
      { id: "feedback", label: "Event evaluation", icon: MessageSquare },
    ],
  },
  {
    label: "People & rooms",
    items: [
      { id: "registration", label: "Delegates", icon: Users },
      { id: "other-activities", label: "Other Activities", icon: Sparkles },
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
      { id: "payment-vouchers", label: "Payment vouchers", icon: FileSignature },
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

export default function PamaconApp({
  canEdit,
  authEmail,
  authRole,
  isSuperuser = false,
  profile,
  attendeeSyncHints = {},
  onSaveProfile,
  profileSaving,
  onApiInfo,
  onApiError,
  onLogout,
}) {
  const [activeTab, setActiveTab] = useState("dashboard");
  /** When `attendee`, committee users preview the same portal delegates see. */
  const [committeePortalView, setCommitteePortalView] = useState("admin");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const openOnsiteDesk = useCallback(() => {
    setCommitteePortalView("admin");
    setActiveTab("registration");
    setIsMobileMenuOpen(false);
    window.setTimeout(() => {
      document.getElementById("pamacon-onsite-desk")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }, []);
  const [loading, setLoading] = useState(true);
  const [eventId, setEventId] = useState(null);
  const [config, setConfig] = useState(DEFAULT_PAMACON_CONFIG);
  const [registrants, setRegistrants] = useState([]);
  const [sponsors, setSponsors] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [speakers, setSpeakers] = useState([]);
  const [eventRecord, setEventRecord] = useState(null);
  const [lastSyncAt, setLastSyncAt] = useState("");
  const isAdmin = authRole === "admin";

  const navGroups = useMemo(
    () =>
      isAdmin
        ? NAV_GROUPS
        : NAV_GROUPS.map((group) => ({
            ...group,
            items: group.items.filter((item) => item.id !== "payment-vouchers"),
          })).filter((group) => group.items.length > 0),
    [isAdmin]
  );

  useEffect(() => {
    if (!isAdmin && activeTab === "payment-vouchers") {
      setActiveTab("dashboard");
    }
  }, [isAdmin, activeTab]);

  const ensureRegistrationProof = useCallback(
    async (registrationId) => {
      let row = registrants.find((r) => r.id === registrationId);
      if (!row) return null;
      const needsFetch =
        (row.hasPaymentProof && !row.paymentProofScreenshotDataUrl) ||
        (row.hasActivityPaymentProof && !row.activityPaymentProofScreenshotDataUrl);
      if (!needsFetch) return row;
      const res = await getRegistration(registrationId);
      row = delegateFromApi(res.item);
      setRegistrants((prev) =>
        prev.map((r) =>
          r.id === registrationId
            ? {
                ...r,
                ...row,
                metaBase: { ...(r.metaBase || {}), ...(row.metaBase || {}) },
              }
            : r
        )
      );
      return row;
    },
    [registrants]
  );

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
          paid: Boolean(s.paid) || String(s.remarks || "").trim().toLowerCase() === "collected",
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
      setLastSyncAt(new Date().toISOString());
    } catch (e) {
      onApiError?.(e, "Failed to load PAMACON data.");
    }
  }, [eventId, onApiError]);

  const persistSeededListScreenshot = useCallback(
    async (dataUrl) => {
      if (!eventId || !isSuperuser) return;
      const raw = String(dataUrl ?? "");
      const shot =
        raw && raw.startsWith("data:image/") && !raw.startsWith("data:image/svg")
          ? await reencodeImageDataUrlAsJpeg(raw, 2200, 0.88)
          : raw;
      const nextConfig = { ...config, seededListScreenshotDataUrl: shot };
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
      const raw = String(dataUrl ?? "");
      const shot =
        raw && raw.startsWith("data:image/") && !raw.startsWith("data:image/svg")
          ? await reencodeImageDataUrlAsJpeg(raw, 2200, 0.88)
          : raw;
      const nextConfig = { ...config, seededListScreenshotDataUrl: shot };
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

  useEffect(() => {
    if (!eventId) return undefined;
    const tick = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      void reloadAll();
    };
    const intervalId = setInterval(tick, 15000);
    const onFocus = () => void reloadAll();
    const onVisible = () => {
      if (document.visibilityState === "visible") void reloadAll();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(intervalId);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [eventId, reloadAll]);

  const sponsorRevenueTotal = useMemo(() => sponsors.reduce((s, x) => s + (Number(x.amount) || 0), 0), [sponsors]);
  const sponsorRevenueCollected = useMemo(
    () => sponsors.filter((s) => Boolean(s.paid)).reduce((sum, row) => sum + (Number(row.amount) || 0), 0),
    [sponsors]
  );
  const delegateRevenueActual = useMemo(() => registrants.reduce((s, x) => s + (Number(x.paid) || 0), 0), [registrants]);
  const totalRevenueProjection = useMemo(
    () => Number(config.targetRegistrants) * 8000 + sponsorRevenueCollected,
    [config.targetRegistrants, sponsorRevenueCollected]
  );
  const totalRealizedRevenueValue = useMemo(
    () => sponsorRevenueCollected + delegateRevenueActual,
    [sponsorRevenueCollected, delegateRevenueActual]
  );
  const totalSupplierSpend = useMemo(() => suppliers.reduce((s, x) => s + (Number(x.amount) || 0), 0), [suppliers]);
  const totalSpeakerHonorarium = useMemo(() => speakers.reduce((s, x) => s + (Number(x.honorarium) || 0), 0), [speakers]);
  const hasSpeakerExpenseRows = useMemo(
    () => suppliers.some((x) => normalizeExpenseCategory(x.category, x.company) === "Speakers and Guests"),
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
      aiaAgentCode: u.aiaAgentCode ?? prev.aiaAgentCode ?? "",
      mobileNumber: u.mobileNumber ?? prev.mobileNumber ?? prev.attendeeClaimMobile ?? "",
      roomNumber: u.roomNumber ?? prev.roomNumber ?? "",
      venueArrivalCheckInAt: u.venueArrivalCheckInAt ?? prev.venueArrivalCheckInAt ?? prev.onsiteRegisteredAt ?? "",
      venueArrivalCheckInBy: u.venueArrivalCheckInBy ?? prev.venueArrivalCheckInBy ?? prev.onsiteRegisteredBy ?? "",
      hallEntryCheckInAt: u.hallEntryCheckInAt ?? prev.hallEntryCheckInAt ?? "",
      hallEntryCheckInBy: u.hallEntryCheckInBy ?? prev.hallEntryCheckInBy ?? "",
      onsiteRegisteredAt: u.onsiteRegisteredAt ?? prev.onsiteRegisteredAt ?? prev.venueArrivalCheckInAt ?? "",
      onsiteRegisteredBy: u.onsiteRegisteredBy ?? prev.onsiteRegisteredBy ?? prev.venueArrivalCheckInBy ?? "",
      shirtSize: u.shirtSize ?? prev.shirtSize ?? "",
      shirtSizeOther: u.shirtSizeOther ?? prev.shirtSizeOther ?? "",
      committeeShirtSize: u.committeeShirtSize ?? prev.committeeShirtSize ?? "",
      committeeShirtSizeOther: u.committeeShirtSizeOther ?? prev.committeeShirtSizeOther ?? "",
      tshirtClaimed: Boolean(u.tshirtClaimed ?? prev.tshirtClaimed),
      conferenceKitClaimed: Boolean(u.conferenceKitClaimed ?? prev.conferenceKitClaimed),
      paymentValidationStatus: u.paymentValidationStatus ?? prev.paymentValidationStatus ?? "pending",
      paymentValidatedAt: u.paymentValidatedAt ?? prev.paymentValidatedAt ?? "",
      paymentValidatedBy: u.paymentValidatedBy ?? prev.paymentValidatedBy ?? "",
      gender: u.gender ?? "Unspecified",
      solo: u.solo,
      manualPairId: u.manualPairId,
      remarks: u.remarks ?? "",
    };
    const res = await patchRegistration(u.id, {
      fullName: u.name,
      attendeeType: u.role,
      status: u.status,
      totalFee: u.totalFee,
      paidAmount: u.paid,
      paymentPlan: modeToPaymentPlan(u.mode),
      metadata: meta,
    });
    if (res?.item) {
      const next = delegateFromApi(res.item);
      setRegistrants((prevRows) => prevRows.map((row) => (row.id === next.id ? next : row)));
      setLastSyncAt(new Date().toISOString());
    } else {
      await reloadAll();
    }
  };

  const saveOnsiteCheckInRegistration = async (row, deskPayload) => {
    if (!canEdit || !row?.id) return;
    const phase = normalizeCheckInPhase(deskPayload.checkInPhase);
    const alreadyPhaseCheckedIn = isDelegatePhaseCheckedIn(row, phase);
    const nowIso = new Date().toISOString();
    const checkedInBy = String(deskPayload.checkedInBy || "").trim();
    if (phase === "hall-entry") {
      const claimUpdate = {
        conferenceKitClaimed: Boolean(deskPayload.conferenceKitClaimed),
        tshirtClaimed: Boolean(deskPayload.tshirtClaimed),
      };
      if (alreadyPhaseCheckedIn) {
        await updateRegistrantRecord({ ...row, ...claimUpdate });
        return;
      }
      await updateRegistrantRecord({
        ...row,
        ...claimUpdate,
        hallEntryCheckInAt: nowIso,
        hallEntryCheckInBy: checkedInBy,
      });
      return;
    }
    const nextRow = {
      ...row,
      role: deskPayload.positionCode,
      aiaAgentCode: deskPayload.aiaAgentCode,
      mobileNumber: deskPayload.mobileNumber,
      roomNumber: deskPayload.roomNumber,
      conferenceKitClaimed: deskPayload.conferenceKitClaimed,
      tshirtClaimed: deskPayload.tshirtClaimed,
      venueArrivalCheckInAt: row.venueArrivalCheckInAt || "",
      venueArrivalCheckInBy: row.venueArrivalCheckInBy || "",
      hallEntryCheckInAt: row.hallEntryCheckInAt || "",
      hallEntryCheckInBy: row.hallEntryCheckInBy || "",
      onsiteRegisteredAt: row.onsiteRegisteredAt || row.venueArrivalCheckInAt || "",
      onsiteRegisteredBy: row.onsiteRegisteredBy || row.venueArrivalCheckInBy || "",
      status: row.status,
    };
    if (!alreadyPhaseCheckedIn) {
      nextRow.venueArrivalCheckInAt = nowIso;
      nextRow.venueArrivalCheckInBy = checkedInBy;
      nextRow.onsiteRegisteredAt = nowIso;
      nextRow.onsiteRegisteredBy = checkedInBy;
      nextRow.status = "checked-in";
    }
    await updateRegistrantRecord(nextRow);
    if (phase === "venue-arrival" && !alreadyPhaseCheckedIn && !String(row.checkedInAt || "").trim()) {
      const res = await checkInRegistration(row.id);
      if (res?.item) {
        const next = delegateFromApi(res.item);
        setRegistrants((prevRows) => prevRows.map((item) => (item.id === next.id ? next : item)));
        setLastSyncAt(new Date().toISOString());
      } else {
        await reloadAll();
      }
    }
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
        shirtSizeOther: u.shirtSizeOther ?? "",
        committeeShirtSize: u.committeeShirtSize ?? "",
        committeeShirtSizeOther: u.committeeShirtSizeOther ?? "",
        tshirtClaimed: Boolean(u.tshirtClaimed),
        conferenceKitClaimed: Boolean(u.conferenceKitClaimed),
        paymentProofScreenshotDataUrl: u.paymentProofScreenshotDataUrl ?? "",
        paymentProofUploadedAt: u.paymentProofUploadedAt ?? "",
        paymentValidationStatus: u.paymentValidationStatus ?? "pending",
        paymentValidatedAt: u.paymentValidatedAt ?? "",
        paymentValidatedBy: u.paymentValidatedBy ?? "",
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
        shirtSizeOther: r.shirtSizeOther ?? prev.shirtSizeOther ?? "",
        committeeShirtSize: r.committeeShirtSize ?? prev.committeeShirtSize ?? "",
        committeeShirtSizeOther: r.committeeShirtSizeOther ?? prev.committeeShirtSizeOther ?? "",
        tshirtClaimed: Boolean(r.tshirtClaimed ?? prev.tshirtClaimed),
        conferenceKitClaimed: Boolean(r.conferenceKitClaimed ?? prev.conferenceKitClaimed),
        paymentValidationStatus: r.paymentValidationStatus ?? prev.paymentValidationStatus ?? "pending",
        paymentValidatedAt: r.paymentValidatedAt ?? prev.paymentValidatedAt ?? "",
        paymentValidatedBy: r.paymentValidatedBy ?? prev.paymentValidatedBy ?? "",
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
        eventId={eventRecord?.id}
        attendeeSyncHints={attendeeSyncHints}
        authEmail={authEmail}
        profile={profile}
        onSaveProfile={onSaveProfile}
        profileSaving={profileSaving}
        onLogout={onLogout}
        onApiInfo={onApiInfo}
        onApiError={onApiError}
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
              <p className="text-[11px] text-slate-500 truncate">Delegate view only. Onsite check-in lives in the admin workspace under Delegates.</p>
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
            eventId={eventRecord?.id}
            attendeeSyncHints={attendeeSyncHints}
            authEmail={authEmail}
            profile={profile}
            onSaveProfile={onSaveProfile}
            profileSaving={profileSaving}
            onLogout={onLogout}
            onApiInfo={onApiInfo}
            onApiError={onApiError}
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
            <div className="rounded-xl bg-white border border-slate-200 flex items-center gap-2 px-2.5 py-2 shrink-0 shadow-sm">
              <img src="/branding/pama-symbol.png" alt="PAMA" className="h-8 w-8 object-contain" />
              <img src="/branding/pama-wordmark.png" alt="AIA PAMA" className="h-6 w-auto max-w-[150px] object-contain" />
            </div>
          </div>
          <button type="button" className="md:hidden p-2 rounded-xl hover:bg-slate-200/80 shrink-0" onClick={() => setIsMobileMenuOpen(false)}>
            <X size={22} />
          </button>
        </div>
        <div className="flex-1 px-3 py-4 space-y-6 overflow-y-auto custom-scrollbar">
          {navGroups.map((group) => (
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
              <p className="text-[11px] text-slate-500">
                Last sync: {lastSyncAt ? new Date(lastSyncAt).toLocaleTimeString() : "—"}
              </p>
            </div>
            <button
              type="button"
              onClick={openOnsiteDesk}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors"
            >
              <UserCheck size={18} />
              Onsite desk
            </button>
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
            {activeTab === "feedback" && (
              <EventFeedbackHub eventId={eventId} eventTitle={eventRecord?.title} onError={onApiError} />
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
                onSaveOnsiteCheckIn={saveOnsiteCheckInRegistration}
                onCreate={createRegistrantRecord}
                onDelete={removeRegistrantRecord}
                onDeleteAll={removeAllRegistrantRecords}
                onAddToSeededList={addRegistrantToSeededList}
                onInfo={onApiInfo}
                onApiError={onApiError}
                onEnsureRegistrationProof={ensureRegistrationProof}
              />
            )}
            {activeTab === "other-activities" && (
              <OtherActivitiesHub
                registrants={registrants}
                canEdit={canEdit}
                isAdmin={isAdmin}
                authEmail={authEmail}
                onUpdate={updateRegistrantRecord}
                onEnsureRegistrationProof={ensureRegistrationProof}
                onApiError={onApiError}
              />
            )}
            {activeTab === "accommodation" && (
              <AccommodationView config={config} registrants={registrants} onPair={pairManualDelegates} onToggleSolo={toggleSoloOccupancy} canEdit={canEdit} />
            )}
            {activeTab === "program" && (
              <ProgramModulesView
                config={config}
                setConfig={setConfig}
                eventId={eventId}
                canEdit={canEdit}
                isAdmin={isAdmin}
                onError={onApiError}
              />
            )}
            {activeTab === "sponsorship" && (
              <SponsorshipHub
                sponsors={sponsors}
                totalRevenue={sponsorRevenueTotal}
                eventId={eventId}
                canEdit={canEdit}
                onReload={reloadAll}
                onError={onApiError}
                onInfo={onApiInfo}
              />
            )}
            {activeTab === "speakers" && (
              <SpeakersHub speakers={speakers} totalHonorarium={totalSpeakerHonorarium} eventId={eventId} canEdit={canEdit} onReload={reloadAll} onError={onApiError} />
            )}
            {activeTab === "suppliers" && (
              <div className="space-y-8">
                <SuppliersHub
                  suppliers={suppliers}
                  totalSpend={totalSupplierSpend}
                  eventId={eventId}
                  canEdit={canEdit}
                  onReload={reloadAll}
                  onError={onApiError}
                  onSeedExpenses={seedExpenseRecords}
                />
                {isAdmin ? (
                  <SupplierVouchersPanel
                    eventId={eventId}
                    suppliers={suppliers}
                    canEdit={canEdit}
                    isAdmin={isAdmin}
                    onError={onApiError}
                    onInfo={onApiInfo}
                  />
                ) : null}
              </div>
            )}
            {activeTab === "payments" && <PaymentsHub config={config} realized={totalRealizedRevenueValue} projection={totalRevenueProjection} />}
            {activeTab === "payment-vouchers" && isAdmin ? (
              <PaymentVouchersHub
                eventId={eventId}
                suppliers={suppliers}
                canEdit={canEdit}
                isAdmin={isAdmin}
                isSuperuser={isSuperuser}
                onError={onApiError}
                onInfo={onApiInfo}
              />
            ) : null}
            {activeTab === "expenses" && (
              <div className="space-y-8">
                <ExpenseDashboard config={config} suppliers={suppliers} />
                <EventExpenseReport eventId={eventId} showVouchers={isAdmin} onError={onApiError} />
                {isAdmin ? (
                  <SupplierVouchersPanel
                    eventId={eventId}
                    suppliers={suppliers}
                    canEdit={canEdit}
                    isAdmin={isAdmin}
                    onError={onApiError}
                    onInfo={onApiInfo}
                  />
                ) : null}
              </div>
            )}
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
    shirtSize: "",
    shirtSizeOther: "",
    committeeShirtSize: "",
    committeeShirtSizeOther: "",
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
  onSaveOnsiteCheckIn,
  onCreate,
  onDelete,
  onDeleteAll,
  onAddToSeededList,
  onInfo,
  onApiError,
  onEnsureRegistrationProof,
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
  const [paymentProofReviewFilter, setPaymentProofReviewFilter] = useState("all");
  const [superuserRegistrantFilter, setSuperuserRegistrantFilter] = useState("all");
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
  const [paymentProofModal, setPaymentProofModal] = useState(null);
  const [savingRefScreenshot, setSavingRefScreenshot] = useState(false);
  const [seedListPasteText, setSeedListPasteText] = useState("");
  const [importingSeedText, setImportingSeedText] = useState(false);
  const [harmonizingSeedRows, setHarmonizingSeedRows] = useState(false);
  const [shirtOtherDraftByRegistrantId, setShirtOtherDraftByRegistrantId] = useState({});
  const [portalEmailDraftByRegistrantId, setPortalEmailDraftByRegistrantId] = useState({});
  const tableMinWidthClass = showMoreColumns ? "min-w-[1640px]" : isAdmin ? "min-w-[1260px]" : "min-w-[1140px]";
  const canEditDelegateShirtFields = canEdit && (isParticipantShirtEditOpenNow() || isAdmin);

  const participantOtherDraftKey = (row) => `${row.id}:participant`;
  const committeeOtherDraftKey = (row) => `${row.id}:committee`;

  const getDraftValue = (key, fallbackValue) =>
    Object.prototype.hasOwnProperty.call(shirtOtherDraftByRegistrantId, key) ? shirtOtherDraftByRegistrantId[key] : fallbackValue;

  const setOtherDraft = (key, value) => {
    setShirtOtherDraftByRegistrantId((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const clearOtherDraft = (key) => {
    setShirtOtherDraftByRegistrantId((prev) => {
      if (!Object.prototype.hasOwnProperty.call(prev, key)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const persistParticipantShirt = async (row, size, otherOverride) => {
    if (!canEditDelegateShirtFields) return;
    const nextSize = size !== undefined && size !== null ? String(size) : String(row.shirtSize || "");
    let nextOther = String(row.shirtSizeOther ?? "");
    if (nextSize.toLowerCase() !== "others") {
      nextOther = "";
    } else if (otherOverride !== undefined) {
      nextOther = String(otherOverride);
    }
    try {
      await onUpdate({
        ...row,
        shirtSize: nextSize,
        shirtSizeOther: nextOther,
      });
      onInfo?.("Participant shirt size saved.");
    } catch (e) {
      onApiError?.(e, "Could not save participant shirt size.");
    }
  };

  const persistCommitteeShirt = async (row, size, otherOverride) => {
    if (!canEditDelegateShirtFields) return;
    const nextSize = size !== undefined && size !== null ? String(size) : String(row.committeeShirtSize || "");
    let nextOther = String(row.committeeShirtSizeOther ?? "");
    if (nextSize.toLowerCase() !== "others") {
      nextOther = "";
    } else if (otherOverride !== undefined) {
      nextOther = String(otherOverride);
    }
    try {
      await onUpdate({
        ...row,
        committeeShirtSize: nextSize,
        committeeShirtSizeOther: nextOther,
      });
      onInfo?.("Committee shirt size saved.");
    } catch (e) {
      onApiError?.(e, "Could not save committee shirt size.");
    }
  };

  const markPaymentValidation = async (row, validated) => {
    if (!canEdit) return;
    const email = String(authEmail || "").trim();
    try {
      await onUpdate({
        ...row,
        paymentValidationStatus: validated ? "validated" : "pending",
        paymentValidatedAt: validated ? new Date().toISOString() : "",
        paymentValidatedBy: validated ? email : "",
      });
      onInfo?.(validated ? "Payment proof marked as validated." : "Payment validation cleared (pending).");
    } catch (e) {
      onApiError?.(e, "Could not update payment validation.");
    }
  };

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

  const assignPortalRole = async (email, nextRole) => {
    const normalized = String(email || "").trim().toLowerCase();
    if (!normalized || !isSuperuser) return;
    const prev = committeeRoleByEmail.get(normalized) || "attendee";
    if (prev === nextRole) return;
    if (normalized === myEmail && prev === "admin" && nextRole !== "admin") {
      if (!window.confirm("You are changing your own account away from Admin. Continue?")) return;
    }
    if (superUserEmails.has(normalized)) {
      onApiInfo?.("This email is already a configured superuser and keeps full admin access.", "warn");
      return;
    }
    await upsertUserRole({ email: normalized, role: nextRole });
    const res = await getUserRoles();
    setCommitteeRoles(res.items || []);
    onInfo?.(`${normalized} is now ${portalRoleLabel(nextRole)} in the portal.`);
  };

  const handlePortalRoleChange = async (row, nextRole, emailOverride) => {
    if (!isSuperuser) return;
    const email = String(emailOverride || resolveDelegatePortalEmail(row) || "").trim().toLowerCase();
    if (!email) {
      onApiError?.(new Error("Email required"), "Enter the delegate sign-in email before assigning a portal role.");
      return;
    }
    try {
      await assignPortalRole(email, nextRole);
      setPortalEmailDraftByRegistrantId((prev) => {
        if (!Object.prototype.hasOwnProperty.call(prev, row.id)) return prev;
        const next = { ...prev };
        delete next[row.id];
        return next;
      });
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

  const paymentsAwaitingConfirmationCount = useMemo(() => {
    return registrants.filter((r) => {
      if (isSeededDelegateRow(r)) return false;
      if (!String(r.paymentProofScreenshotDataUrl || "").trim() && !r.hasPaymentProof) return false;
      return String(r.paymentValidationStatus || "").toLowerCase() !== "validated";
    }).length;
  }, [registrants]);

  const filtered = useMemo(() => {
    return registrants.filter((r) => {
      const seeded = isSeededDelegateRow(r);
      const claimEmail = String(r.staffClaimEmail || "").trim().toLowerCase();
      const attendeeClaimEmail = String(r.attendeeClaimEmail || "").trim().toLowerCase();
      const hasAnyClaim = Boolean(claimEmail || attendeeClaimEmail);
      if (claimFilter === "seed-unclaimed" && (!seeded || hasAnyClaim)) return false;
      if (claimFilter === "seed-claimed-by-me" && (!seeded || !claimEmail || claimEmail !== myEmail)) return false;
      if (claimFilter === "seed-claimed-any" && (!seeded || !hasAnyClaim)) return false;
      if (paymentProofReviewFilter === "awaiting") {
        const hasProof = Boolean(String(r.paymentProofScreenshotDataUrl || "").trim() || r.hasPaymentProof);
        const validated = String(r.paymentValidationStatus || "").toLowerCase() === "validated";
        if (seeded || !hasProof || validated) return false;
      }
      if (isSuperuser && superuserRegistrantFilter === "non-seeded-registered") {
        const status = String(r.status || "").trim().toLowerCase();
        if (seeded || status !== "registered") return false;
      }
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
  }, [registrants, claimFilter, paymentProofReviewFilter, superuserRegistrantFilter, isSuperuser, myEmail, fName, fRole, fFeeMin, fFeeMax, fPaidMin, fPaidMax, fMode, fStatus, fRemarks]);

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
    setPaymentProofReviewFilter("all");
    setSuperuserRegistrantFilter("all");
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
      const bucket = effectiveShirtOrderBucket(r);
      if (!bucket) continue;
      counts[bucket] = (counts[bucket] || 0) + 1;
      total += 1;
    }
    const ordered = Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0]));
    return { ordered, total };
  }, [registrants]);

  const claimTrackerRows = useMemo(
    () =>
      registrants.filter(
        (r) => r.tshirtClaimed || r.conferenceKitClaimed || r.shirtSize || r.committeeShirtSize
      ),
    [registrants]
  );

  const activitySurvey = useMemo(() => {
    const defs = [
      { key: "extraIslandHopping", label: "Island hopping" },
      { key: "extraCityTour", label: "City tour / heritage tour" },
      { key: "extraMountainTour", label: "Cebu city — mountain tour" },
      { key: "extraSafari", label: "Cebu Safari" },
    ];
    const counts = Object.fromEntries(defs.map((d) => [d.key, 0]));
    let withResponses = 0;
    const respondents = [];
    for (const r of registrants) {
      const meta = r?.metaBase && typeof r.metaBase === "object" ? r.metaBase : {};
      const selected = defs.filter((d) => Boolean(meta[d.key])).map((d) => d.label);
      const other = String(meta.extraOtherRequest || "").trim();
      if (!selected.length && !other) continue;
      withResponses += 1;
      for (const d of defs) {
        if (meta[d.key]) counts[d.key] += 1;
      }
      respondents.push({
        id: r.id,
        name: r.name,
        email: String(r.attendeeClaimEmail || "").trim(),
        selected,
        other,
      });
    }
    respondents.sort((a, b) => a.name.localeCompare(b.name));
    return { defs, counts, withResponses, respondents };
  }, [registrants]);

  const downloadMasterlist = () => {
    const headers = onsiteMasterlistHeaders();
    const rows = sorted.map((r) => onsiteMasterlistRow(r));
    downloadCsv(`pamacon-masterlist-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
  };

  const downloadTshirtList = () => {
    const headers = [
      "Full Name",
      "Position",
      "Attendee Email",
      "Participant Shirt",
      "Committee Shirt (default)",
      "Effective Shirt For Order",
      "Tshirt Claimed",
      "Status",
      "Seed Source",
    ];
    const esc = (v) => `"${String(v ?? "").replaceAll("\"", "\"\"")}"`;
    const rows = [...registrants]
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")))
      .map((r) =>
        [
          r.name || "",
          formatPositionShort(r.role),
          String(r.attendeeClaimEmail || "").trim(),
          formatShirtSizeCell(r.shirtSize, r.shirtSizeOther),
          formatShirtSizeCell(r.committeeShirtSize, r.committeeShirtSizeOther),
          formatShirtSizeCell(
            String(r.shirtSize || "").trim() ? r.shirtSize : r.committeeShirtSize,
            String(r.shirtSize || "").trim() ? r.shirtSizeOther : r.committeeShirtSizeOther
          ),
          r.tshirtClaimed ? "Yes" : "No",
          r.status || "",
          r.seedSource || "",
        ].map(esc).join(",")
      );
    const csv = [headers.map(esc).join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `pamacon-tshirt-list-${new Date().toISOString().slice(0, 10)}.csv`;
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
      {paymentProofModal?.src ? (
        <div
          className="fixed inset-0 z-[145] flex items-center justify-center bg-slate-900/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Payment proof screenshot"
          onClick={() => setPaymentProofModal(null)}
        >
          <div
            className="relative max-h-[92vh] w-full max-w-4xl overflow-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setPaymentProofModal(null)}
              className="absolute right-3 top-3 z-10 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              Close
            </button>
            {paymentProofModal.delegateName ? (
              <p className="mt-10 mb-3 text-sm font-semibold text-slate-900">Payment proof — {paymentProofModal.delegateName}</p>
            ) : (
              <p className="mt-10 mb-3 text-sm font-semibold text-slate-900">Payment proof</p>
            )}
            <img
              src={paymentProofModal.src}
              alt="Uploaded payment proof"
              className="mx-auto max-h-[78vh] w-auto max-w-full rounded-lg border border-slate-100 object-contain"
            />
          </div>
        </div>
      ) : null}
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
      <DelegateWorkingTeamPanel
        registrants={registrants}
        isSuperuser={isSuperuser}
        committeeRoles={committeeRoles}
        committeeRolesLoading={committeeRolesLoading}
        superUserEmails={superUserEmails}
        onAssignRole={assignPortalRole}
        onInfo={onInfo}
        onApiError={onApiError}
      />
      <DelegateOnsiteDesk
        registrants={registrants}
        canEdit={canEdit}
        authEmail={authEmail}
        onSaveCheckIn={onSaveOnsiteCheckIn}
        onInfo={onInfo}
        onApiError={onApiError}
      />
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-6 md:p-8 border-b border-slate-100 bg-slate-50/50 flex flex-col gap-4">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Conference Delegates</h3>
              <p className="text-sm text-slate-500 mt-1 max-w-xl">
                <strong>Registration fees</strong> is the sum of each row’s listed fee. <strong>Collected</strong> is the sum of amounts actually paid—they differ when someone is on partial or installment plans.
              </p>
              <p className="mt-3 text-xs text-slate-600 rounded-lg border border-slate-200 bg-white px-3 py-2 max-w-3xl leading-relaxed">
                <strong className="text-slate-800">Participant shirt</strong> — staff set the delegate’s conference shirt in the table (same sizes as the portal). Attendees can also set it until{" "}
                <span className="font-semibold text-slate-900">{participantShirtDeadlineLabel()}</span>.{" "}
                <strong className="text-slate-800">Committee shirt (default order)</strong> — logistics pre-order default when no participant shirt is saved.{" "}
                <strong className="text-slate-800">Payment</strong> — open the proof image and use <em>Mark validated</em> when you have confirmed the transfer (scroll horizontally if columns are off-screen).
                <span className="block mt-1.5 text-slate-600">
                  <strong className="text-slate-800">Conference fee</strong> payment proof in the attendee portal is optional; when delegates upload one, new uploads appear here for your team to confirm.
                </span>
                {!isParticipantShirtEditOpenNow() ? (
                  <span className="block mt-1.5 font-semibold text-amber-800">
                    Self-service shirt changes are closed. Staff and admins can still edit both shirt columns here; ordering uses participant shirt if set, otherwise the committee default.
                  </span>
                ) : null}
              </p>
              {canEdit && paymentsAwaitingConfirmationCount > 0 ? (
                <div
                  className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-950 max-w-3xl"
                  role="status"
                >
                  <span className="font-bold tabular-nums">{paymentsAwaitingConfirmationCount}</span> non-seeded delegate
                  {paymentsAwaitingConfirmationCount === 1 ? "" : "s"} uploaded a payment proof — use the <strong>Payment</strong> column to view the screenshot and{" "}
                  <strong>Mark validated</strong> when the bank or e-wallet transfer is confirmed.
                </div>
              ) : null}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Claim workflow</span>
                <button
                  type="button"
                  onClick={() => {
                    setClaimFilter("seed-unclaimed");
                    setPaymentProofReviewFilter("all");
                    setSuperuserRegistrantFilter("all");
                  }}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold border ${
                    claimFilter === "seed-unclaimed" ? "border-red-300 bg-red-50 text-red-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  Unclaimed seeds: {claimSummary.unclaimed}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setClaimFilter("seed-claimed-by-me");
                    setPaymentProofReviewFilter("all");
                    setSuperuserRegistrantFilter("all");
                  }}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold border ${
                    claimFilter === "seed-claimed-by-me" ? "border-violet-300 bg-violet-50 text-violet-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  Claimed by me: {claimSummary.mine}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setClaimFilter("all");
                    setPaymentProofReviewFilter("all");
                    setSuperuserRegistrantFilter("all");
                  }}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold border ${
                    claimFilter === "all" ? "border-slate-300 bg-slate-100 text-slate-800" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  Show all delegates
                </button>

                {isSuperuser ? (
                  <>
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide ml-1">Superuser</span>
                    <button
                      type="button"
                      onClick={() => {
                        setClaimFilter("all");
                        setPaymentProofReviewFilter("all");
                        setSuperuserRegistrantFilter("non-seeded-registered");
                      }}
                      className={`rounded-lg px-2.5 py-1 text-xs font-semibold border ${
                        superuserRegistrantFilter === "non-seeded-registered"
                          ? "border-sky-400 bg-sky-100 text-sky-900"
                          : "border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      Non-seeded + registered
                    </button>
                    <button
                      type="button"
                      onClick={() => setSuperuserRegistrantFilter("all")}
                      className={`rounded-lg px-2 py-1 text-[11px] font-semibold border border-slate-200 text-slate-500 hover:bg-slate-50 ${
                        superuserRegistrantFilter === "all" ? "opacity-40 pointer-events-none" : ""
                      }`}
                      disabled={superuserRegistrantFilter === "all"}
                    >
                      Clear superuser filter
                    </button>
                  </>
                ) : null}
                {canEdit && paymentsAwaitingConfirmationCount > 0 ? (
                  <>
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide ml-1">Payment review</span>
                    <button
                      type="button"
                      onClick={() => {
                        setClaimFilter("all");
                        setPaymentProofReviewFilter("awaiting");
                        setSuperuserRegistrantFilter("all");
                      }}
                      className={`rounded-lg px-2.5 py-1 text-xs font-semibold border ${
                        paymentProofReviewFilter === "awaiting"
                          ? "border-amber-400 bg-amber-100 text-amber-950"
                          : "border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      Proofs to confirm: {paymentsAwaitingConfirmationCount}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentProofReviewFilter("all")}
                      className={`rounded-lg px-2 py-1 text-[11px] font-semibold border border-slate-200 text-slate-500 hover:bg-slate-50 ${
                        paymentProofReviewFilter === "all" ? "opacity-40 pointer-events-none" : ""
                      }`}
                      disabled={paymentProofReviewFilter === "all"}
                    >
                      Clear payment filter
                    </button>
                  </>
                ) : null}
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
              {isAdmin ? (
                <button
                  type="button"
                  onClick={downloadTshirtList}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Download size={16} />
                  Download T-shirt list
                </button>
              ) : null}
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
              <col className="w-[150px]" />
              <col className="w-[170px]" />
              <col className="w-[150px]" />
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
                      <span className="inline-flex items-center gap-1 font-semibold uppercase tracking-wide text-slate-500">Portal access</span>
                      {!isSuperuser ? (
                        <span className="normal-case font-normal text-[10px] text-slate-400">Superuser promotes Working Team</span>
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
                <th className="px-4 py-3.5 align-bottom w-[150px]">
                  <span className="inline-flex flex-col gap-0.5">
                    <span className="font-semibold uppercase tracking-wide text-slate-500">Participant shirt</span>
                    <span className="normal-case font-normal text-[9px] text-slate-400 leading-tight">Conference tee</span>
                  </span>
                </th>
                <th className="px-4 py-3.5 align-bottom min-w-[10rem]">
                  <span className="inline-flex flex-col gap-0.5">
                    <span className="font-semibold uppercase tracking-wide text-slate-500">Payment</span>
                    <span className="normal-case font-normal text-[9px] text-slate-400 leading-tight">Proof &amp; validate</span>
                  </span>
                </th>
                <th className="px-4 py-3.5 align-bottom w-[150px]">
                  <span className="inline-flex flex-col gap-0.5">
                    <span className="font-semibold uppercase tracking-wide text-slate-500">Committee shirt</span>
                    <span className="normal-case font-normal text-[9px] text-slate-400 leading-tight">Default order</span>
                  </span>
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
                <th className="px-4 py-2.5 font-normal">
                  <span className="text-slate-300">—</span>
                </th>
                <th className="px-4 py-2.5 font-normal">
                  <span className="text-slate-300">—</span>
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
                const awaitingPaymentReview =
                  !isSeededDelegateRow(r) &&
                  Boolean(String(r.paymentProofScreenshotDataUrl || "").trim() || r.hasPaymentProof) &&
                  String(r.paymentValidationStatus || "").toLowerCase() !== "validated";
                return (
                  <tr
                    key={r.id}
                    className={`group hover:bg-slate-50/80 ${
                      awaitingPaymentReview ? "bg-amber-50/90 ring-1 ring-inset ring-amber-200/80" : ""
                    }`}
                  >
                    <td className="px-4 py-4 text-slate-800">
                      <div className="font-semibold">{r.name}</div>
                      {r.nickname && <div className="text-xs text-slate-500 mt-1">Nickname: {r.nickname}</div>}
                      {r.attendeeClaimEmail ? <div className="text-xs text-slate-500 mt-1">Email: {r.attendeeClaimEmail}</div> : null}
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
                          const claimEmail = resolveDelegatePortalEmail(r);
                          const draftEmail = Object.prototype.hasOwnProperty.call(portalEmailDraftByRegistrantId, r.id)
                            ? portalEmailDraftByRegistrantId[r.id]
                            : claimEmail;
                          if (superUserEmails.has(claimEmail)) {
                            return <span className="text-xs font-semibold text-amber-800">Admin (env)</span>;
                          }
                          const current = claimEmail ? committeeRoleByEmail.get(claimEmail) || "attendee" : "attendee";
                          if (!isSuperuser) {
                            return (
                              <span className="text-xs font-semibold text-slate-700">
                                {portalRoleLabel(current)}
                              </span>
                            );
                          }
                          return (
                            <div className="space-y-1.5 max-w-[11rem]">
                              <input
                                type="email"
                                value={draftEmail}
                                disabled={committeeRolesLoading}
                                onChange={(e) =>
                                  setPortalEmailDraftByRegistrantId((prev) => ({
                                    ...prev,
                                    [r.id]: e.target.value,
                                  }))
                                }
                                placeholder="Sign-in email"
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-800 disabled:opacity-50"
                                aria-label={`Portal sign-in email for ${r.name}`}
                              />
                              <select
                                value={current}
                                disabled={committeeRolesLoading}
                                onChange={(e) => void handlePortalRoleChange(r, e.target.value, draftEmail)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-800 disabled:opacity-50"
                                aria-label={`Portal role for ${r.name}`}
                              >
                                {PORTAL_ROLE_OPTIONS.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          );
                        })()}
                      </td>
                    ) : null}
                    <td className="px-4 py-4 text-right font-medium text-slate-800 tabular-nums">₱{(Number(r.totalFee) || 0).toLocaleString()}</td>
                    <td className="px-4 py-4 text-right font-semibold text-slate-800 tabular-nums">₱{(Number(r.paid) || 0).toLocaleString()}</td>
                    <td className="px-4 py-4">
                      <span className="text-xs font-medium text-slate-700">{r.mode}</span>
                    </td>
                    <td className="px-4 py-4 align-top min-w-[140px]">
                      <div className="space-y-1.5 max-w-[10rem]">
                        {(() => {
                          const participantDraftKey = participantOtherDraftKey(r);
                          const participantOtherValue = getDraftValue(participantDraftKey, r.shirtSizeOther || "");
                          return (
                            <>
                        <select
                          className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-800 disabled:opacity-40"
                          disabled={!canEditDelegateShirtFields}
                          value={String(r.shirtSize ?? "")}
                          onChange={(e) => {
                            const nextSize = e.target.value;
                            if (String(nextSize || "").toLowerCase() !== "others") {
                              clearOtherDraft(participantDraftKey);
                            }
                            void persistParticipantShirt(r, nextSize, undefined);
                          }}
                          aria-label={`Participant shirt for ${r.name}`}
                        >
                          {DELEGATE_SHIRT_SIZE_SELECT.map((o) => (
                            <option key={o.value || "unset"} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                        {String(r.shirtSize || "").toLowerCase() === "others" ? (
                          <input
                            type="text"
                            className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs disabled:opacity-40"
                            disabled={!canEditDelegateShirtFields}
                            placeholder="Specify size"
                            value={participantOtherValue}
                            onChange={(e) => setOtherDraft(participantDraftKey, e.target.value)}
                            onBlur={() => {
                              const finalValue = getDraftValue(participantDraftKey, r.shirtSizeOther || "");
                              void persistParticipantShirt(r, "others", finalValue);
                              clearOtherDraft(participantDraftKey);
                            }}
                            onKeyDown={(e) => {
                              if (e.key !== "Enter") return;
                              e.preventDefault();
                              const finalValue = getDraftValue(participantDraftKey, r.shirtSizeOther || "");
                              void persistParticipantShirt(r, "others", finalValue);
                              clearOtherDraft(participantDraftKey);
                              e.currentTarget.blur();
                            }}
                            aria-label={`Participant shirt other for ${r.name}`}
                          />
                        ) : null}
                            </>
                          );
                        })()}
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top min-w-[10rem]">
                      <div className="flex flex-col gap-1.5">
                        {r.paymentProofScreenshotDataUrl || r.hasPaymentProof ? (
                          <button
                            type="button"
                            onClick={() => {
                              void (async () => {
                                try {
                                  const loaded = (await onEnsureRegistrationProof?.(r.id)) || r;
                                  const src = loaded.paymentProofScreenshotDataUrl;
                                  if (!src) {
                                    onApiError?.(new Error("Proof unavailable"), "Could not load payment proof.");
                                    return;
                                  }
                                  setPaymentProofModal({ src, delegateName: r.name });
                                } catch (e) {
                                  onApiError?.(e, "Could not load payment proof.");
                                }
                              })();
                            }}
                            className="text-left text-[11px] font-semibold text-amber-700 hover:underline"
                          >
                            View proof
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">No proof</span>
                        )}
                        {(() => {
                          const validated = String(r.paymentValidationStatus || "").toLowerCase() === "validated";
                          return (
                            <>
                              <span
                                className={`inline-flex w-fit rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                                  validated ? "bg-emerald-100 text-emerald-800 border border-emerald-200/80" : "bg-amber-50 text-amber-900 border border-amber-100"
                                }`}
                              >
                                {validated ? "Validated" : "Pending"}
                              </span>
                              {validated && r.paymentValidatedBy ? (
                                <span className="text-[10px] text-slate-500 leading-snug">By {r.paymentValidatedBy}</span>
                              ) : null}
                              {canEdit && (r.paymentProofScreenshotDataUrl || r.hasPaymentProof) ? (
                                validated ? (
                                  <button
                                    type="button"
                                    className="text-left w-fit text-[11px] font-semibold text-slate-600 hover:underline"
                                    onClick={() => void markPaymentValidation(r, false)}
                                  >
                                    Clear validation
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    className="text-left w-fit text-[11px] font-semibold text-emerald-700 hover:underline"
                                    onClick={() => void markPaymentValidation(r, true)}
                                  >
                                    Mark validated
                                  </button>
                                )
                              ) : null}
                            </>
                          );
                        })()}
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top min-w-[140px]">
                      <div className="space-y-1.5 max-w-[10rem]">
                        {(() => {
                          const committeeDraftKey = committeeOtherDraftKey(r);
                          const committeeOtherValue = getDraftValue(committeeDraftKey, r.committeeShirtSizeOther || "");
                          return (
                            <>
                        <select
                          className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-800 disabled:opacity-40"
                          disabled={!canEditDelegateShirtFields}
                          value={String(r.committeeShirtSize ?? "")}
                          onChange={(e) => {
                            const nextSize = e.target.value;
                            if (String(nextSize || "").toLowerCase() !== "others") {
                              clearOtherDraft(committeeDraftKey);
                            }
                            void persistCommitteeShirt(r, nextSize, undefined);
                          }}
                          aria-label={`Committee shirt default for ${r.name}`}
                        >
                          {DELEGATE_SHIRT_SIZE_SELECT.map((o) => (
                            <option key={o.value || "unset"} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                        {String(r.committeeShirtSize || "").toLowerCase() === "others" ? (
                          <input
                            type="text"
                            className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs disabled:opacity-40"
                            disabled={!canEditDelegateShirtFields}
                            placeholder="Specify size"
                            value={committeeOtherValue}
                            onChange={(e) => setOtherDraft(committeeDraftKey, e.target.value)}
                            onBlur={() => {
                              const finalValue = getDraftValue(committeeDraftKey, r.committeeShirtSizeOther || "");
                              void persistCommitteeShirt(r, "others", finalValue);
                              clearOtherDraft(committeeDraftKey);
                            }}
                            onKeyDown={(e) => {
                              if (e.key !== "Enter") return;
                              e.preventDefault();
                              const finalValue = getDraftValue(committeeDraftKey, r.committeeShirtSizeOther || "");
                              void persistCommitteeShirt(r, "others", finalValue);
                              clearOtherDraft(committeeDraftKey);
                              e.currentTarget.blur();
                            }}
                            aria-label={`Committee shirt other for ${r.name}`}
                          />
                        ) : null}
                            </>
                          );
                        })()}
                      </div>
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
                <td colSpan={showMoreColumns ? 9 : 6} className="px-4 py-3.5 text-xs text-slate-500 font-normal">
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
          <table className="w-full min-w-[880px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-500">
                <th className="py-2 text-left">Delegate</th>
                <th className="py-2 text-left">Participant shirt</th>
                <th className="py-2 text-left">Committee default</th>
                <th className="py-2 text-left">For ordering</th>
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
                  <td className="py-2.5 pr-3 text-slate-600">{formatShirtSizeCell(r.shirtSize, r.shirtSizeOther)}</td>
                  <td className="py-2.5 pr-3 text-slate-600">{formatShirtSizeCell(r.committeeShirtSize, r.committeeShirtSizeOther)}</td>
                  <td className="py-2.5 pr-3 text-slate-800 font-medium">
                    {formatShirtSizeCell(
                      String(r.shirtSize || "").trim() ? r.shirtSize : r.committeeShirtSize,
                      String(r.shirtSize || "").trim() ? r.shirtSizeOther : r.committeeShirtSizeOther
                    )}
                  </td>
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
                  <td colSpan={6} className="py-3 text-slate-500">
                    No claimable delegate data yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">T-shirt size summary (ordering)</p>
          <p className="text-[11px] text-slate-500 mb-2 leading-snug">
            Counts use each delegate’s <strong>participant shirt</strong> when set; otherwise the <strong>committee default</strong>. Participants may update their shirt in the portal until {participantShirtDeadlineLabel()}.
          </p>
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
      <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-sm space-y-4">
        <h4 className="text-base font-semibold text-slate-900">Activity survey responses</h4>
        <p className="text-sm text-slate-500">
          Responses from attendee profile form (post-conference activity interests).
        </p>
        <div className="flex flex-wrap gap-2">
          {activitySurvey.defs.map((d) => (
            <span key={d.key} className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
              {d.label}: {activitySurvey.counts[d.key] || 0}
            </span>
          ))}
          <span className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800">
            Delegates with responses: {activitySurvey.withResponses}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-500">
                <th className="py-2 text-left">Delegate</th>
                <th className="py-2 text-left">Email</th>
                <th className="py-2 text-left">Selected activities</th>
                <th className="py-2 text-left">Other request</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {activitySurvey.respondents.map((row) => (
                <tr key={`activity-${row.id}`}>
                  <td className="py-2.5 pr-3 text-slate-800 font-medium">{row.name}</td>
                  <td className="py-2.5 pr-3 text-slate-600">{row.email || "—"}</td>
                  <td className="py-2.5 pr-3 text-slate-700">{row.selected.length ? row.selected.join("; ") : "—"}</td>
                  <td className="py-2.5 pr-3 text-slate-600">{row.other || "—"}</td>
                </tr>
              ))}
              {activitySurvey.respondents.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-3 text-slate-500">
                    No activity survey responses yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
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
  const downloadRoomListCsv = () => {
    const headers = [
      "Room Number",
      "Status",
      "Pairing Type",
      "Occupant A Name",
      "Occupant A Position",
      "Occupant A Gender",
      "Occupant B Name",
      "Occupant B Position",
      "Occupant B Gender",
      "Room Cost",
    ];
    const esc = (v) => `"${String(v ?? "").replaceAll("\"", "\"\"")}"`;
    const rows = list.map((room, idx) =>
      [
        `Room ${idx + 1}`,
        room.status || "",
        room.pairType || "",
        room.a?.name || "",
        formatPositionShort(room.a?.role || ""),
        room.a?.gender || "",
        room.b?.name || "",
        formatPositionShort(room.b?.role || ""),
        room.b?.gender || "",
        Number(room.price || 0),
      ].map(esc).join(",")
    );
    const csv = [headers.map(esc).join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `pamacon-room-list-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };
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
          <button
            type="button"
            onClick={downloadRoomListCsv}
            className="ml-auto inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
          >
            <Download size={15} />
            Download room list
          </button>
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

function SponsorshipHub({ sponsors, totalRevenue, eventId, canEdit, onReload, onError, onInfo }) {
  const [newS, setNewS] = useState({ company: "", tier: "Gold", amount: 0, remarks: "Uncollected" });
  const [isAdding, setIsAdding] = useState(false);
  const [updatingId, setUpdatingId] = useState("");

  const isCollected = (s) => Boolean(s.paid) || String(s.remarks || "").trim().toLowerCase() === "collected";

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

  const setCollectionStatus = async (sponsor, collected) => {
    setUpdatingId(sponsor.id);
    try {
      await patchSponsor(sponsor.id, { status: collected ? "collected" : "uncollected" });
      await onReload();
      onInfo?.(collected ? `${sponsor.company} marked as collected.` : `${sponsor.company} marked as uncollected.`);
    } catch (e) {
      onError?.(e, "Failed to update sponsor status.");
    } finally {
      setUpdatingId("");
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
                  isCollected(s) ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-amber-50 text-amber-700 border-amber-100"
                }`}
              >
                {isCollected(s) ? "Collected" : "Uncollected"}
              </span>
            </div>
            <div className="pt-6 mt-6 border-t border-slate-50 flex justify-between items-center">
              <span className="text-[10px] font-black text-slate-400">Total Contribution</span>
              <span className="text-2xl font-black">₱{(Number(s.amount) || 0).toLocaleString()}</span>
            </div>
            {canEdit ? (
              <div className="mt-4 pt-4 border-t border-slate-50">
                {isCollected(s) ? (
                  <button
                    type="button"
                    disabled={updatingId === s.id}
                    onClick={() => void setCollectionStatus(s, false)}
                    className="w-full rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-[10px] font-black uppercase text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                  >
                    Mark uncollected
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={updatingId === s.id}
                    onClick={() => void setCollectionStatus(s, true)}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2.5 text-[10px] font-black uppercase text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <CheckCircle2 size={14} aria-hidden />
                    {updatingId === s.id ? "Updating…" : "Mark collected"}
                  </button>
                )}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function SupplierExpenseCard({ s, canEdit, editingId, editDraft, setEditDraft, categorySelectOptions, onStartEdit, onCancelEdit, onSaveEdit, onRemove }) {
  return (
    <div className="bg-white p-8 rounded-[40px] border shadow-sm group relative hover:border-blue-200 transition-all">
      <div className="absolute top-8 right-8 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
        <button
          type="button"
          disabled={!canEdit}
          title="Edit supplier"
          className="rounded-xl p-2 text-slate-300 hover:bg-blue-50 hover:text-blue-600 transition-colors disabled:opacity-0"
          onClick={() => (editingId === s.id ? onCancelEdit() : onStartEdit(s))}
        >
          <Edit3 size={18} />
        </button>
        <button
          type="button"
          disabled={!canEdit}
          title="Remove supplier"
          className="rounded-xl p-2 text-slate-300 hover:bg-rose-50 hover:text-rose-600 transition-colors disabled:opacity-0"
          onClick={() => onRemove(s.id)}
        >
          <Trash2 size={18} />
        </button>
      </div>
      {editingId === s.id ? (
        <div className="space-y-4 pr-10">
          <SetupInput
            label="Vendor / payee name"
            value={editDraft.company}
            onChange={(e) => setEditDraft({ ...editDraft, company: e.target.value })}
            disabled={!canEdit}
          />
          <div className="space-y-2">
            <label className="block text-[10px] font-black text-slate-400 uppercase">Expense group</label>
            <select
              className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-3.5 text-sm font-black appearance-none disabled:opacity-50"
              value={editDraft.category}
              disabled={!canEdit}
              onChange={(e) => setEditDraft({ ...editDraft, category: e.target.value })}
            >
              {categorySelectOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <SetupInput
            label="Amount (₱)"
            type="number"
            value={editDraft.amount}
            disabled={!canEdit}
            onChange={(e) => setEditDraft({ ...editDraft, amount: Number(e.target.value) })}
          />
          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="button"
              disabled={!canEdit || !String(editDraft.company || "").trim()}
              onClick={() => void onSaveEdit()}
              className="inline-flex flex-1 min-w-[120px] items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-2.5 text-xs font-black uppercase text-white hover:bg-blue-700 disabled:opacity-40"
            >
              <Save size={16} aria-hidden />
              Save
            </button>
            <button
              type="button"
              onClick={onCancelEdit}
              className="rounded-2xl border border-slate-200 px-4 py-2.5 text-xs font-black uppercase text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <h4 className="text-xl font-black uppercase text-slate-800 tracking-tighter leading-tight min-h-[3rem] pr-10">{s.company}</h4>
          <div className="pt-6 mt-6 border-t border-slate-50 flex justify-between items-center">
            <span className="text-2xl font-black text-slate-800">₱{(Number(s.amount) || 0).toLocaleString()}</span>
          </div>
        </>
      )}
    </div>
  );
}

function SuppliersHub({ suppliers, totalSpend, eventId, canEdit, onReload, onError, onSeedExpenses }) {
  const [newV, setNewV] = useState({ company: "", category: DEFAULT_EXPENSE_CATEGORY, amount: 0 });
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState({ company: "", category: DEFAULT_EXPENSE_CATEGORY, amount: 0 });

  const expenseGroups = useMemo(() => groupExpensesByCategory(suppliers), [suppliers]);

  const categorySelectOptions = useMemo(() => {
    const seen = new Set(EXPENSE_CATEGORY_GROUPS);
    const out = [...EXPENSE_CATEGORY_GROUPS];
    for (const row of suppliers) {
      const c = normalizeExpenseCategory(row?.category, row?.company);
      if (c && !seen.has(c)) {
        seen.add(c);
        out.push(c);
      }
    }
    return out;
  }, [suppliers]);

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
      setNewV({ company: "", category: DEFAULT_EXPENSE_CATEGORY, amount: 0 });
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

  const downloadSuppliersCsv = () => {
    const day = new Date().toISOString().slice(0, 10);
    const header = ["expense_group", "id", "vendor_name", "category", "amount_php"];
    const rows = [];
    for (const group of expenseGroups) {
      for (const s of group.items) {
        rows.push([group.heading, s.id, s.company, s.category, Number(s.amount) || 0]);
      }
    }
    const total = suppliers.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
    rows.push(["", "", "TOTAL", "", total]);
    downloadCsv(`pamacon-contractors-suppliers-${day}.csv`, header, rows);
  };

  const startEdit = (s) => {
    setEditingId(s.id);
    setEditDraft({
      company: String(s.company || "").trim(),
      category: normalizeExpenseCategory(s.category, s.company),
      amount: Number(s.amount) || 0,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = async () => {
    if (!editingId || !String(editDraft.company || "").trim()) return;
    try {
      await patchExpense(editingId, {
        supplier: String(editDraft.company || "").trim(),
        category: editDraft.category,
        amount: Number(editDraft.amount) || 0,
        expenseType: "fixed",
        approved: true,
      });
      setEditingId(null);
      await onReload();
    } catch (e) {
      onError?.(e, "Failed to save supplier.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-8 rounded-[40px] border shadow-sm flex flex-col gap-4 lg:flex-row lg:justify-between lg:items-center">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 shadow-inner">
            <Truck size={32} />
          </div>
          <div>
            <h3 className="text-xl font-black uppercase text-slate-800">Contractor Hub</h3>
            <p className="text-2xl font-black text-blue-600">₱{(Number(totalSpend) || 0).toLocaleString()}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={!eventId}
            onClick={downloadSuppliersCsv}
            className="inline-flex items-center justify-center gap-2 border border-slate-200 bg-white text-slate-800 px-6 py-3 rounded-2xl font-black text-xs uppercase hover:bg-slate-50 transition-all disabled:opacity-40"
          >
            <Download size={16} aria-hidden />
            Download CSV
          </button>
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
            onClick={() => {
              setEditingId(null);
              setIsAdding(!isAdding);
            }}
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
            <label className="block text-[10px] font-black text-slate-400 uppercase">Expense group</label>
            <select
              className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-3.5 text-sm font-black appearance-none"
              value={newV.category}
              onChange={(e) => setNewV({ ...newV, category: e.target.value })}
            >
              {EXPENSE_CATEGORY_GROUPS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
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
      <div className="space-y-10 pb-20">
        {expenseGroups.map((group) => (
          <section key={group.heading} className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b-2 border-slate-200 pb-3">
              <h4 className="text-sm font-black uppercase tracking-wide text-slate-800">{group.heading}</h4>
              <p className="text-lg font-black text-blue-600 tabular-nums">
                ₱{(Number(group.total) || 0).toLocaleString()}
                <span className="ml-2 text-[10px] font-bold uppercase text-slate-400">
                  {group.items.length} {group.items.length === 1 ? "line" : "lines"}
                </span>
              </p>
            </div>
            {group.items.length === 0 ? (
              <p className="text-sm text-slate-400 italic px-2">No expenses in this group yet.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {group.items.map((s) => (
                  <SupplierExpenseCard
                    key={s.id}
                    s={s}
                    canEdit={canEdit}
                    editingId={editingId}
                    editDraft={editDraft}
                    setEditDraft={setEditDraft}
                    categorySelectOptions={categorySelectOptions}
                    onStartEdit={startEdit}
                    onCancelEdit={cancelEdit}
                    onSaveEdit={saveEdit}
                    onRemove={remove}
                  />
                ))}
              </div>
            )}
          </section>
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
      <div className="md:col-span-2 rounded-3xl border border-amber-200 bg-amber-50 p-6 sm:p-7">
        <h4 className="text-sm font-black uppercase tracking-wide text-amber-900">Payment proof reminder</h4>
        <p className="mt-2 text-sm text-amber-900/90 leading-relaxed">
          Delegates may optionally screenshot their conference fee confirmation and upload it under <strong>Conference registration payment proof screenshot</strong>. Staff/Admin
          can open the proof from the Delegates list during validation. Profile save and tours/activities do not require conference fee proof.
        </p>
      </div>
    </div>
  );
}

function OtherActivitiesHub({ registrants, canEdit, isAdmin, authEmail, onUpdate, onEnsureRegistrationProof, onApiError }) {
  const defs = [
    { key: "extraIslandHopping", label: "Island hopping" },
    { key: "extraCityTour", label: "City tour / heritage tour" },
    { key: "extraMountainTour", label: "Cebu city — mountain tour" },
    { key: "extraSafari", label: "Cebu Safari" },
  ];
  const rows = useMemo(() => {
    const out = [];
    for (const r of registrants || []) {
      const meta = r?.metaBase && typeof r.metaBase === "object" ? r.metaBase : {};
      const selected = defs.filter((d) => Boolean(meta[d.key])).map((d) => d.label);
      const other = String(meta.extraOtherRequest || "").trim();
      if (!selected.length && !other) continue;
      out.push({
        id: r.id,
        name: r.name,
        email: String(r.attendeeClaimEmail || "").trim(),
        mobile: String(meta.mobileNumber || "").trim(),
        arrival: String(meta.arrivalCebu || "").trim(),
        departure: String(meta.departureCebu || "").trim(),
        selected,
        other,
        activityRegistrationConfirmed: Boolean(meta.activityRegistrationConfirmed),
        activityPaymentMethod: String(meta.activityPaymentMethod || "").trim(),
        activityPaymentReference: String(meta.activityPaymentReference || "").trim(),
        activityPaymentProofScreenshotDataUrl: String(r.activityPaymentProofScreenshotDataUrl || meta.activityPaymentProofScreenshotDataUrl || "").trim(),
        hasActivityPaymentProof: Boolean(r.hasActivityPaymentProof || meta.activityPaymentProofScreenshotDataUrl),
        activityPaymentProofUploadedAt: String(meta.activityPaymentProofUploadedAt || "").trim(),
        activityPaymentConfirmedBy: String(meta.activityPaymentConfirmedBy || "").trim(),
        activityPaymentConfirmedAt: String(meta.activityPaymentConfirmedAt || "").trim(),
        activityPaymentStatus: String(meta.activityPaymentStatus || "").trim(),
      });
    }
    out.sort((a, b) => a.name.localeCompare(b.name));
    return out;
  }, [registrants]);
  const [selectedFilter, setSelectedFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [linkCopied, setLinkCopied] = useState(false);
  const [messageCopied, setMessageCopied] = useState(false);
  const attendeeTourLink = `${window.location.origin}/sign-in`;
  const attendeeBroadcastMessage = `Hi PAMACON delegates! Register here for tours and upload your GCash / QR payment proof: ${attendeeTourLink}`;

  const summary = useMemo(() => {
    const counts = Object.fromEntries(defs.map((d) => [d.key, 0]));
    let withOther = 0;
    let withConfirmedRegistration = 0;
    let withPaymentProof = 0;
    for (const row of rows) {
      for (const d of defs) {
        if (row.selected.includes(d.label)) counts[d.key] += 1;
      }
      if (row.other) withOther += 1;
      if (row.activityRegistrationConfirmed) withConfirmedRegistration += 1;
      if (row.activityPaymentProofScreenshotDataUrl || row.hasActivityPaymentProof) withPaymentProof += 1;
    }
    return { counts, withOther, withConfirmedRegistration, withPaymentProof };
  }, [rows]);

  const filteredRows = useMemo(() => {
    let base = rows;
    if (selectedFilter !== "all") {
      if (selectedFilter === "other") base = rows.filter((r) => Boolean(r.other));
      else {
        const def = defs.find((d) => d.key === selectedFilter);
        base = def ? rows.filter((r) => r.selected.includes(def.label)) : rows;
      }
    }
    if (paymentFilter === "all") return base;
    return base.filter((r) => {
      const hasProof = Boolean(r.activityPaymentProofScreenshotDataUrl || r.hasActivityPaymentProof);
      const status = String(r.activityPaymentStatus || (hasProof ? "pending" : "unpaid")).toLowerCase();
      if (paymentFilter === "paid") return status === "confirmed";
      if (paymentFilter === "pending") return status === "pending";
      if (paymentFilter === "unpaid") return status === "unpaid";
      return true;
    });
  }, [rows, selectedFilter, paymentFilter]);

  const openActivityPaymentProof = (row) => {
    void (async () => {
      try {
        const loaded = (await onEnsureRegistrationProof?.(row.id)) || registrants.find((r) => r.id === row.id);
        const src = loaded?.activityPaymentProofScreenshotDataUrl;
        if (!src) {
          onApiError?.(new Error("Proof unavailable"), "Could not load activity payment proof.");
          return;
        }
        window.open(src, "_blank", "noopener,noreferrer");
      } catch (e) {
        onApiError?.(e, "Could not load activity payment proof.");
      }
    })();
  };
  const canConfirmActivityPayments = Boolean(canEdit && isAdmin && typeof onUpdate === "function");

  const setActivityPaymentStatus = async (row, status) => {
    if (!canConfirmActivityPayments) return;
    const source = registrants.find((r) => r.id === row.id);
    if (!source) return;
    const nowIso = new Date().toISOString();
    await onUpdate({
      ...source,
      metaBase: {
        ...(source.metaBase || {}),
        activityPaymentStatus: status,
        activityPaymentConfirmedAt: status === "confirmed" ? nowIso : "",
        activityPaymentConfirmedBy: status === "confirmed" ? String(authEmail || "").trim().toLowerCase() : "",
      },
    });
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="rounded-3xl border-2 border-red-300 bg-gradient-to-r from-red-600 via-rose-600 to-orange-500 p-5 sm:p-7 shadow-lg">
        <p className="text-[11px] uppercase tracking-[0.14em] font-bold text-white/90">Attendee Broadcast Link</p>
        <h3 className="mt-1 text-xl sm:text-2xl font-black text-white">Register Here for Tours</h3>
        <p className="mt-2 text-sm text-white/90 max-w-3xl">
          Copy this link and send it to your attendees group chat so they can sign in, register for activities, and upload GCash / QR payment proof.
        </p>
        <div className="mt-4 rounded-2xl border border-white/25 bg-white/15 p-3 sm:p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <code className="text-xs sm:text-sm font-semibold text-white break-all">{attendeeTourLink}</code>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(attendeeTourLink);
                } catch {
                  const ta = document.createElement("textarea");
                  ta.value = attendeeTourLink;
                  document.body.appendChild(ta);
                  ta.select();
                  document.execCommand("copy");
                  ta.remove();
                }
                setLinkCopied(true);
                setTimeout(() => setLinkCopied(false), 1800);
              }}
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-white px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-50"
            >
              {linkCopied ? "Copied!" : "Copy link"}
            </button>
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(attendeeBroadcastMessage);
                } catch {
                  const ta = document.createElement("textarea");
                  ta.value = attendeeBroadcastMessage;
                  document.body.appendChild(ta);
                  ta.select();
                  document.execCommand("copy");
                  ta.remove();
                }
                setMessageCopied(true);
                setTimeout(() => setMessageCopied(false), 1800);
              }}
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-white/80 bg-white/15 px-4 py-2 text-sm font-bold text-white hover:bg-white/25"
            >
              {messageCopied ? "Message copied!" : "Copy prewritten message"}
            </button>
          </div>
        </div>
      </div>
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-4">
        <h3 className="text-lg font-semibold text-slate-900">Other Activities Coordination Card</h3>
        <p className="text-sm text-slate-500">Use this to prepare bookings, transport, and delegate coordination for optional Cebu activities.</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">Respondents</p>
            <p className="text-lg font-semibold text-slate-900">{rows.length}</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-emerald-700 font-semibold">Confirmed registrations</p>
            <p className="text-lg font-semibold text-emerald-900">{summary.withConfirmedRegistration}</p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-amber-700 font-semibold">With payment proof</p>
            <p className="text-lg font-semibold text-amber-900">{summary.withPaymentProof}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {defs.map((d) => (
            <button
              key={d.key}
              type="button"
              onClick={() => setSelectedFilter(d.key)}
              className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors ${
                selectedFilter === d.key ? "border-red-300 bg-red-50 text-red-700" : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
              }`}
            >
              {d.label}: {summary.counts[d.key] || 0}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setSelectedFilter("other")}
            className={`rounded-lg border px-2.5 py-1 text-xs font-bold transition-colors ${
              selectedFilter === "other" ? "border-amber-300 bg-amber-100 text-amber-900" : "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
            }`}
          >
            With other request: {summary.withOther}
          </button>
          <button
            type="button"
            onClick={() => setSelectedFilter("all")}
            className={`rounded-lg border px-2.5 py-1 text-xs font-bold transition-colors ${
              selectedFilter === "all" ? "border-red-300 bg-red-100 text-red-800" : "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
            }`}
          >
            Delegates with responses: {rows.length}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setPaymentFilter("all")}
            className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${
              paymentFilter === "all" ? "border-slate-300 bg-slate-100 text-slate-800" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            All payments
          </button>
          <button
            type="button"
            onClick={() => setPaymentFilter("paid")}
            className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${
              paymentFilter === "paid" ? "border-emerald-300 bg-emerald-100 text-emerald-900" : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
            }`}
          >
            Paid only
          </button>
          <button
            type="button"
            onClick={() => setPaymentFilter("pending")}
            className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${
              paymentFilter === "pending" ? "border-amber-300 bg-amber-100 text-amber-900" : "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
            }`}
          >
            Pending only
          </button>
          <button
            type="button"
            onClick={() => setPaymentFilter("unpaid")}
            className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${
              paymentFilter === "unpaid" ? "border-rose-300 bg-rose-100 text-rose-900" : "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
            }`}
          >
            Unpaid only
          </button>
        </div>
        <p className="text-xs text-slate-500">
          Showing:{" "}
          <strong>
            {selectedFilter === "all"
              ? "All respondents"
              : selectedFilter === "other"
              ? "Delegates with other requests"
              : defs.find((d) => d.key === selectedFilter)?.label || "Filtered"}
          </strong>{" "}
          ({filteredRows.length})
        </p>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1400px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-500">
                <th className="py-2 text-left">Delegate</th>
                <th className="py-2 text-left">Email</th>
                <th className="py-2 text-left">Mobile</th>
                <th className="py-2 text-left">Arrival</th>
                <th className="py-2 text-left">Departure</th>
                <th className="py-2 text-left">Selected activities</th>
                <th className="py-2 text-left">Other request</th>
                <th className="py-2 text-left">Registration</th>
                <th className="py-2 text-left">Payment method</th>
                <th className="py-2 text-left">Reference</th>
                <th className="py-2 text-left">Proof</th>
                <th className="py-2 text-left">Payment status</th>
                <th className="py-2 text-left">Admin action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRows.map((row) => (
                <tr key={`oa-${row.id}`}>
                  <td className="py-2.5 pr-3 text-slate-800 font-medium">{row.name}</td>
                  <td className="py-2.5 pr-3 text-slate-600">{row.email || "—"}</td>
                  <td className="py-2.5 pr-3 text-slate-600">{row.mobile || "—"}</td>
                  <td className="py-2.5 pr-3 text-slate-600">{row.arrival || "—"}</td>
                  <td className="py-2.5 pr-3 text-slate-600">{row.departure || "—"}</td>
                  <td className="py-2.5 pr-3 text-slate-700">{row.selected.length ? row.selected.join("; ") : "—"}</td>
                  <td className="py-2.5 pr-3 text-slate-600">{row.other || "—"}</td>
                  <td className="py-2.5 pr-3 text-slate-700">
                    {row.activityRegistrationConfirmed ? (
                      <span className="inline-flex rounded bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">Confirmed</span>
                    ) : (
                      <span className="inline-flex rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">Pending</span>
                    )}
                  </td>
                  <td className="py-2.5 pr-3 text-slate-600">{row.activityPaymentMethod || "—"}</td>
                  <td className="py-2.5 pr-3 text-slate-600 space-y-0.5">
                    <p>{row.activityPaymentReference || "—"}</p>
                    <p className="text-[11px] text-slate-500">Amount: {row.activityPaymentAmount || "—"}</p>
                    <p className="text-[11px] text-slate-500">Sender: {row.activityPaymentSenderNumber || "—"}</p>
                  </td>
                  <td className="py-2.5 pr-3 text-slate-600">
                    {row.activityPaymentProofScreenshotDataUrl || row.hasActivityPaymentProof ? (
                      <button
                        type="button"
                        onClick={() => openActivityPaymentProof(row)}
                        className="text-amber-700 font-semibold hover:underline"
                      >
                        View proof
                      </button>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="py-2.5 pr-3 text-slate-600">
                    {(() => {
                      const hasProof = Boolean(row.activityPaymentProofScreenshotDataUrl || row.hasActivityPaymentProof);
                      const status = String(row.activityPaymentStatus || (hasProof ? "pending" : "unpaid")).toLowerCase();
                      if (status === "confirmed") {
                        return (
                          <div className="space-y-1">
                            <span className="inline-flex rounded bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">Confirmed</span>
                            {row.activityPaymentConfirmedBy ? <p className="text-[11px] text-slate-500">By: {row.activityPaymentConfirmedBy}</p> : null}
                            {row.activityPaymentConfirmedAt ? <p className="text-[11px] text-slate-500">{new Date(row.activityPaymentConfirmedAt).toLocaleString()}</p> : null}
                          </div>
                        );
                      }
                      if (status === "pending") {
                        return <span className="inline-flex rounded bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900">Pending</span>;
                      }
                      return <span className="inline-flex rounded bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-800">Unpaid</span>;
                    })()}
                  </td>
                  <td className="py-2.5 pr-3 text-slate-600">
                    {canConfirmActivityPayments ? (
                      <div className="flex flex-col items-start gap-1">
                        <button
                          type="button"
                          className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-40"
                          disabled={!row.activityPaymentProofScreenshotDataUrl && !row.hasActivityPaymentProof}
                          onClick={() => void setActivityPaymentStatus(row, "confirmed")}
                        >
                          Confirm payment
                        </button>
                        <button
                          type="button"
                          className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-800 hover:bg-amber-100"
                          onClick={() => void setActivityPaymentStatus(row, "pending")}
                        >
                          Mark pending
                        </button>
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-400">Admin only</span>
                    )}
                  </td>
                </tr>
              ))}
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-3 text-slate-500">
                    No delegates found for this filter.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ExpenseDashboard({ config, suppliers }) {
  const modules = Array.isArray(config.expenseBudgetModules) && config.expenseBudgetModules.length > 0 ? config.expenseBudgetModules : DEFAULT_EXPENSE_BUDGET_MODULES;
  const sumByCategories = (cats) => {
    const set = new Set((cats || []).map((x) => normalizeExpenseCategory(x)));
    return suppliers
      .filter((s) => set.has(normalizeExpenseCategory(s.category, s.company)))
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

  const downloadBudgetVsActualCsv = () => {
    const day = new Date().toISOString().slice(0, 10);
    const header = [
      "module_label",
      "budget_limit_php",
      "spent_php",
      "remaining_php",
      "utilization_pct",
      "mapped_expense_categories",
    ];
    const rows = modules.map((m) => {
      const b = Number(m.budget) || 0;
      const s = sumByCategories(m.categories);
      const rem = Math.max(0, b - s);
      const util = b > 0 ? Math.round((s / b) * 10000) / 100 : "";
      const cats = (m.categories || []).map((x) => String(x || "").trim()).filter(Boolean).join("; ");
      return [m.label, b, s, rem, util, cats];
    });
    downloadCsv(`pamacon-expense-budget-vs-actual-${day}.csv`, header, rows);
  };

  return (
    <div className="bg-white rounded-[50px] border p-12 space-y-12 shadow-sm relative overflow-hidden pb-20">
      <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-3xl font-black uppercase tracking-tight text-slate-800">Expense Dashboard</h3>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1 italic">Budget modules from editable array mapping</p>
        </div>
        <button
          type="button"
          onClick={downloadBudgetVsActualCsv}
          className="inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-2xl border border-slate-200 bg-white px-6 py-3 text-xs font-black uppercase tracking-wide text-slate-800 shadow-sm hover:bg-slate-50 sm:self-auto"
        >
          <Download size={16} aria-hidden />
          Download CSV
        </button>
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

function ProgramModulesView({ config, setConfig, eventId, canEdit, isAdmin, onError }) {
  const [rows, setRows] = useState(() =>
    Array.isArray(config.programModules) && config.programModules.length > 0 ? config.programModules : DEFAULT_PROGRAM_MODULES
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (dirty) return;
    setRows(Array.isArray(config.programModules) && config.programModules.length > 0 ? config.programModules : DEFAULT_PROGRAM_MODULES);
  }, [config.programModules, dirty]);

  const updateRow = (idx, key, value) => {
    setDirty(true);
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [key]: value } : r)));
  };

  const removeRow = (idx) => {
    setDirty(true);
    setRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const addRow = (day) => {
    setDirty(true);
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
      setDirty(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 1600);
    } catch (e) {
      onError?.(e, "Failed to save program modules.");
    } finally {
      setSaving(false);
    }
  };

  const downloadProgramPdf = () => {
    const cleaned = rows
      .map((r) => ({
        day: String(r.day || "").trim(),
        time: String(r.time || "").trim(),
        program: String(r.program || "").trim(),
        assigned: String(r.assigned || "").trim(),
      }))
      .filter((r) => r.day || r.time || r.program || r.assigned);
    const grouped = cleaned.reduce((acc, row) => {
      const key = row.day || "Program";
      if (!acc[key]) acc[key] = [];
      acc[key].push(row);
      return acc;
    }, {});
    const esc = (v) =>
      String(v || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
    const sections = Object.entries(grouped)
      .map(
        ([day, entries]) => `
          <section class="day-section">
            <h2>${esc(day)}</h2>
            <table>
              <thead>
                <tr><th>Time</th><th>Program</th><th>Assigned</th></tr>
              </thead>
              <tbody>
                ${entries
                  .map(
                    (r) => `
                  <tr>
                    <td>${esc(r.time)}</td>
                    <td>${esc(r.program)}</td>
                    <td>${esc(r.assigned)}</td>
                  </tr>
                `
                  )
                  .join("")}
              </tbody>
            </table>
          </section>
        `
      )
      .join("");
    const now = new Date();
    const printable = `
      <!doctype html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>PAMACON Program</title>
        <style>
          @page { size: A4 portrait; margin: 16mm; }
          body { font-family: Arial, Helvetica, sans-serif; color: #0f172a; }
          h1 { margin: 0 0 4px; font-size: 24px; }
          .meta { margin: 0 0 16px; color: #475569; font-size: 12px; }
          .day-section { margin: 14px 0 18px; break-inside: avoid; }
          h2 { margin: 0 0 8px; font-size: 16px; color: #b91c1c; }
          table { width: 100%; border-collapse: collapse; table-layout: fixed; }
          th, td { border: 1px solid #e2e8f0; padding: 8px; font-size: 12px; vertical-align: top; }
          th { background: #f8fafc; text-align: left; font-weight: 700; }
          th:nth-child(1), td:nth-child(1) { width: 22%; }
          th:nth-child(3), td:nth-child(3) { width: 28%; }
        </style>
      </head>
      <body>
        <h1>PAMACON 2026 Program</h1>
        <p class="meta">Generated ${esc(now.toLocaleString())}</p>
        ${sections || "<p>No program rows available.</p>"}
      </body>
      </html>
    `;
    const blob = new Blob([printable], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, "_blank");
    if (!w) {
      const link = document.createElement("a");
      link.href = url;
      link.download = `pamacon-program-${new Date().toISOString().slice(0, 10)}.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      return;
    }
    const triggerPrint = () => {
      try {
        w.focus();
        w.print();
      } finally {
        setTimeout(() => URL.revokeObjectURL(url), 15000);
      }
    };
    w.onload = triggerPrint;
    setTimeout(triggerPrint, 700);
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
          {isAdmin ? (
            <button
              type="button"
              onClick={downloadProgramPdf}
              className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Download program PDF
            </button>
          ) : null}
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
      let outgoing = { ...local };
      const shot = String(outgoing.seededListScreenshotDataUrl || "");
      if (shot.startsWith("data:image/") && !shot.startsWith("data:image/svg")) {
        outgoing.seededListScreenshotDataUrl = await reencodeImageDataUrlAsJpeg(shot, 2200, 0.88);
      }
      const portal = { ...(outgoing.attendeePortal || {}) };
      const posterUrls = [...(Array.isArray(portal.posterImageUrls) ? portal.posterImageUrls : []), "", "", "", "", "", "", "", "", "", "", "", ""].slice(
        0,
        ATTENDEE_POSTER_MAX
      );
      for (let i = 0; i < posterUrls.length; i++) {
        const u = String(posterUrls[i] || "");
        if (u.startsWith("data:image/") && !u.startsWith("data:image/svg") && u.length > 50000) {
          posterUrls[i] = await reencodeImageDataUrlAsJpeg(u, 1280, 0.82);
        }
      }
      outgoing.attendeePortal = { ...portal, posterImageUrls: posterUrls };

      await patchEvent(eventId, {
        attendeeGoal: outgoing.targetRegistrants,
        config: outgoing,
      });
      setConfig(outgoing);
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
        { label: "New Module", budget: 0, categories: [DEFAULT_EXPENSE_CATEGORY] },
      ],
    });
  };

  const removeExpenseModule = (idx) => {
    setLocal({
      ...local,
      expenseBudgetModules: expenseModules.filter((_, i) => i !== idx),
    });
  };

  const downloadBudgetModulesCsv = () => {
    const day = new Date().toISOString().slice(0, 10);
    const header = ["module_label", "budget_php", "expense_categories_csv"];
    const rows = expenseModules.map((m) => [m.label, Number(m.budget) || 0, (m.categories || []).join(", ")]);
    downloadCsv(`pamacon-expense-budget-modules-${day}.csv`, header, rows);
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
    posterImageUrls: ["", "", "", "", "", "", "", "", "", "", "", ""],
    speakerMaterials: [],
    ...(local.attendeePortal || {}),
  };
  const speakerMaterialRows = Array.isArray(portalConfig.speakerMaterials) ? portalConfig.speakerMaterials : [];
  const posterUrls = [...(portalConfig.posterImageUrls || []), "", "", "", "", "", "", "", "", "", "", "", ""].slice(0, ATTENDEE_POSTER_MAX);
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
    event.target.value = "";
    void (async () => {
      const reader = new FileReader();
      const dataUrl = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("Could not read image file."));
        reader.readAsDataURL(file);
      });
      if (typeof dataUrl !== "string") return;
      const compact = await reencodeImageDataUrlAsJpeg(dataUrl, 1280, 0.82);
      updatePosterSlot(selectedPosterSlot, compact);
    })().catch((e) => onError?.(e, "Could not process poster image."));
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
                <span className="text-xs font-semibold text-slate-600">Quote request email (this event)</span>
                <input
                  type="email"
                  disabled={!canEdit}
                  value={String(portalConfig.quoteRequestEmail || "")}
                  onChange={(e) => updatePortalConfig({ quoteRequestEmail: e.target.value.trim() })}
                  placeholder="events@example.com"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 disabled:opacity-50"
                />
                <p className="text-[11px] text-slate-500">
                  This overrides <code className="text-xs">VITE_QUOTE_REQUEST_EMAIL</code> for this specific event.
                </p>
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-semibold text-slate-600">Welcome video URL (optional)</span>
                <input
                  type="url"
                  disabled={!canEdit}
                  value={String(portalConfig.youtubeUrl || "")}
                  onChange={(e) => updatePortalConfig({ youtubeUrl: e.target.value.trim() })}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 disabled:opacity-50"
                />
                <p className="text-[11px] text-slate-500">Leave blank to use the environment-level attendee video link.</p>
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-semibold text-slate-600">No. of posters to display (1-12)</span>
                <input
                  type="number"
                  min={1}
                  max={ATTENDEE_POSTER_MAX}
                  disabled={!canEdit}
                  value={Number(portalConfig.posterDisplayCount) || 3}
                  onChange={(e) =>
                    updatePortalConfig({
                      posterDisplayCount: Math.max(1, Math.min(ATTENDEE_POSTER_MAX, Number(e.target.value) || 3)),
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
            <SpeakerMaterialsSetup
              rows={speakerMaterialRows}
              canEdit={canEdit}
              onChange={(speakerMaterials) => updatePortalConfig({ speakerMaterials })}
            />
          </div>
        </div>
      )}
      {setupTab === "budget" && <div className="mt-2 relative z-10 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h4 className="text-[10px] font-black uppercase text-slate-600 border-b pb-3 tracking-[0.2em] leading-none flex-1 min-w-[200px]">
            Expense Budget Modules (Editable Array)
          </h4>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={downloadBudgetModulesCsv}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            >
              <Download size={16} aria-hidden />
              Download CSV
            </button>
            <button
              type="button"
              disabled={!canEdit}
              onClick={addExpenseModule}
              className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              + Add module
            </button>
          </div>
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
