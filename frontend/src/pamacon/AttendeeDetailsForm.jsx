import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronRight, Download, Save, X } from "lucide-react";
import { isParticipantShirtEditOpenNow, participantShirtDeadlineLabel } from "./shirtOrderingPolicy";
import { SHOW_CEBU_TOUR_ACTIVITIES } from "./attendeePortalFlags";

const POSITION_OPTIONS = [
  { value: "DD", label: "DD — District Director" },
  { value: "AD", label: "AD — Agency Director" },
  { value: "SUM", label: "SUM — Senior Unit Manager" },
  { value: "UM", label: "UM — Unit Manager" },
  { value: "others", label: "Others (specify)" },
];

const SHIRT_OPTIONS = [
  { value: "XS", label: "XS" },
  { value: "S", label: "S" },
  { value: "M", label: "M" },
  { value: "L", label: "L" },
  { value: "XL", label: "XL" },
  { value: "XXL", label: "XXL" },
  { value: "XXXL", label: "XXXL" },
  { value: "others", label: "Others (specify)" },
];

const GENDER_OPTIONS = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "other", label: "Other / prefer to self-describe" },
  { value: "unspecified", label: "Prefer not to say" },
];

const ACTIVITY_KEYS = [
  { key: "extraIslandHopping", label: "Island hopping" },
  { key: "extraCityTour", label: "City tour / heritage tour" },
  { key: "extraMountainTour", label: "Cebu city — mountain tour" },
  { key: "extraSafari", label: "Cebu Safari" },
];
const CEBU_TOUR_CARDS = [
  {
    id: "island-hopping",
    title: "Island Hopping Adventure",
    key: "extraIslandHopping",
    short: "Snorkeling and island lunch stops.",
    details:
      "A full-day island route around Mactan and nearby islets, with beach time and guided transfer options for delegates.",
  },
  {
    id: "city-heritage",
    title: "Cebu City Heritage Tour",
    key: "extraCityTour",
    short: "History, landmarks, and local food.",
    details:
      "Visit Fort San Pedro, Basilica Minore, Magellan's Cross, and top city stops. Designed for delegates who want a classic Cebu city experience.",
  },
  {
    id: "mountain-scenic",
    title: "Mountain Scenic Route",
    key: "extraMountainTour",
    short: "Temple views and cool mountain spots.",
    details:
      "A scenic mountain loop featuring elevated viewpoints and curated stopovers for photos and team bonding.",
  },
  {
    id: "cebu-safari",
    title: "Cebu Safari Experience",
    key: "extraSafari",
    short: "Wildlife and family-friendly attractions.",
    details:
      "A day trip to Cebu Safari with coordinated transport schedules and optional group package rates.",
  },
];

function draftFromProfile(p) {
  const arrivalDefault = p?.arrivalCebu || "2026-05-13";
  const departureDefault = p?.departureCebu || "2026-05-15";
  return {
    lastName: p?.lastName || "",
    firstName: p?.firstName || "",
    nickname: p?.nickname || "",
    aiaAgentCode: p?.aiaAgentCode || "",
    middleName: p?.middleName || "",
    age: p?.age != null && p?.age !== "" ? String(p.age) : "",
    positionCode: p?.positionCode || "UM",
    positionOther: p?.positionOther || "",
    gender: p?.gender || "",
    shirtSize: p?.shirtSize || "",
    shirtSizeOther: p?.shirtSizeOther || "",
    arrivalCebu: arrivalDefault,
    departureCebu: departureDefault,
    extraIslandHopping: Boolean(p?.extraIslandHopping),
    extraCityTour: Boolean(p?.extraCityTour),
    extraMountainTour: Boolean(p?.extraMountainTour),
    extraSafari: Boolean(p?.extraSafari),
    extraOtherRequest: p?.extraOtherRequest || "",
    activityRegistrationConfirmed: Boolean(p?.activityRegistrationConfirmed),
    activityPaymentMethod: p?.activityPaymentMethod || "",
    activityPaymentReference: p?.activityPaymentReference || "",
    activityPaymentAmount: p?.activityPaymentAmount || "",
    activityPaymentSenderNumber: p?.activityPaymentSenderNumber || "",
    activityPaymentProofScreenshotDataUrl: p?.activityPaymentProofScreenshotDataUrl || "",
    activityPaymentProofUploadedAt: p?.activityPaymentProofUploadedAt || "",
    activityPaymentConfirmedAt: p?.activityPaymentConfirmedAt || "",
    activityPaymentStatus: p?.activityPaymentStatus || "pending",
    mobileNumber: p?.mobileNumber || "",
    paymentProofScreenshotDataUrl: p?.paymentProofScreenshotDataUrl || "",
    paymentProofUploadedAt: p?.paymentProofUploadedAt || "",
  };
}

function storageKey(email) {
  return `pamacon-attendee-details:${String(email || "guest").toLowerCase()}`;
}

function buildQuoteBody(draft, quoteKind) {
  const activities = ACTIVITY_KEYS.filter((a) => draft[a.key]).map((a) => a.label);
  if (draft.extraOtherRequest.trim()) activities.push(`Other: ${draft.extraOtherRequest.trim()}`);
  const pos =
    draft.positionCode === "others"
      ? `Others (${draft.positionOther || "—"})`
      : POSITION_OPTIONS.find((o) => o.value === draft.positionCode)?.label || draft.positionCode;
  const shirt =
    draft.shirtSize === "others"
      ? `Others (${draft.shirtSizeOther || "—"})`
      : SHIRT_OPTIONS.find((o) => o.value === draft.shirtSize)?.label || draft.shirtSize;
  const lines = [
    `Quote request: ${quoteKind}`,
    "",
    `Last name: ${draft.lastName}`,
    `First name: ${draft.firstName}`,
    `Nickname: ${draft.nickname || "—"}`,
    `AIA Agent Code: ${draft.aiaAgentCode || "—"}`,
    `Middle name: ${draft.middleName}`,
    `Age: ${draft.age}`,
    `Position: ${pos}`,
    `Gender: ${GENDER_OPTIONS.find((g) => g.value === draft.gender)?.label || draft.gender || "—"}`,
    `Shirt size: ${shirt}`,
    `Arrival in Cebu: ${draft.arrivalCebu || "—"}`,
    `Departure from Cebu: ${draft.departureCebu || "—"}`,
    `Extra-day interests: ${activities.length ? activities.join("; ") : "None selected"}`,
    `Activity registration confirmed: ${draft.activityRegistrationConfirmed ? "Yes" : "No"}`,
    `Activity payment method: ${draft.activityPaymentMethod || "—"}`,
    `Activity payment reference: ${draft.activityPaymentReference || "—"}`,
    `Activity payment amount: ${draft.activityPaymentAmount || "—"}`,
    `Activity payment sender no.: ${draft.activityPaymentSenderNumber || "—"}`,
    "",
    "Thank you.",
  ];
  return lines.join("\n");
}

export default function AttendeeDetailsForm({ profile, authEmail, onSaveProfile, profileSaving, quoteEmail }) {
  const [draft, setDraft] = useState(() => draftFromProfile(profile));
  const [expandedTourCard, setExpandedTourCard] = useState("");
  const [activityQrLoadFailed, setActivityQrLoadFailed] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [saveError, setSaveError] = useState("");
  const shirtFieldsLocked = !isParticipantShirtEditOpenNow();

  useEffect(() => {
    setDraft(() => {
      try {
        const raw = localStorage.getItem(storageKey(authEmail));
        if (raw) {
          const parsed = JSON.parse(raw);
          return { ...draftFromProfile(profile), ...parsed };
        }
      } catch {
        /* ignore */
      }
      return draftFromProfile(profile);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rehydrate when identity changes
  }, [authEmail]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey(authEmail), JSON.stringify(draft));
    } catch {
      /* ignore */
    }
  }, [draft, authEmail]);

  const resolvedQuoteEmail = useMemo(() => {
    const fromEnv = String(import.meta.env.VITE_QUOTE_REQUEST_EMAIL || "").trim();
    return String(quoteEmail || "").trim() || fromEnv || "";
  }, [quoteEmail]);
  const activityGcashQrUrl =
    String(import.meta.env.VITE_ACTIVITY_GCASH_QR_URL || "").trim() || "/payments/gcash-qr.jpg";
  const hasSelectedActivities = useMemo(
    () =>
      ACTIVITY_KEYS.some(({ key }) => Boolean(draft[key])) ||
      Boolean(String(draft.extraOtherRequest || "").trim()),
    [draft]
  );
  const activityPaymentStatusLabel = String(draft.activityPaymentStatus || "pending").toLowerCase() === "confirmed" ? "Confirmed by admin" : "Pending confirmation";

  const [activityQrZoomOpen, setActivityQrZoomOpen] = useState(false);

  const activityGcashQrAbsoluteUrl = useMemo(() => {
    try {
      return new URL(activityGcashQrUrl, window.location.origin).href;
    } catch {
      return activityGcashQrUrl;
    }
  }, [activityGcashQrUrl]);

  const downloadActivityGcashQr = useCallback(async () => {
    const filename = "PAMACON-tours-gcash-qr.jpg";
    const url = activityGcashQrAbsoluteUrl;
    try {
      const res = await fetch(url, { mode: "cors" });
      if (!res.ok) throw new Error("fetch failed");
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = filename;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  }, [activityGcashQrAbsoluteUrl]);

  useEffect(() => {
    if (!activityQrZoomOpen) return undefined;
    const onKeyDown = (e) => {
      if (e.key === "Escape") setActivityQrZoomOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activityQrZoomOpen]);

  const openQuote = useCallback(
    (quoteKind) => {
      const body = buildQuoteBody(draft, quoteKind);
      const subject = encodeURIComponent(`[PAMACON] Quote request — ${quoteKind}`);
      if (!resolvedQuoteEmail) {
        window.alert(
          "Quote email is not configured yet. Ask your organizer to set VITE_QUOTE_REQUEST_EMAIL in the app environment or quoteRequestEmail in event configuration."
        );
        return;
      }
      window.location.href = `mailto:${resolvedQuoteEmail}?subject=${subject}&body=${encodeURIComponent(body)}`;
    },
    [draft, resolvedQuoteEmail]
  );

  const handleSave = async () => {
    if (!shirtFieldsLocked) {
      if (!String(draft.shirtSize || "").trim()) {
        setSaveError("T-shirt size is required before saving.");
        return;
      }
      if (draft.shirtSize === "others" && !String(draft.shirtSizeOther || "").trim()) {
        setSaveError("Please specify your T-shirt size.");
        return;
      }
    }
    setSaveError("");
    const middleName = String(draft.middleName || "").trim();
    await onSaveProfile?.({
      ...draft,
      middleName: middleName.slice(0, 120),
      middleInitial: middleName.slice(0, 1),
    });
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2500);
  };

  const inputClass =
    "w-full min-h-[44px] rounded-xl border border-slate-200 px-3 py-2.5 text-base sm:text-sm text-slate-800 bg-white focus:border-red-400 focus:outline-none focus:ring-1 focus:ring-red-200";

  return (
    <section id="attendee-details" className="scroll-mt-24 rounded-2xl sm:rounded-3xl border border-slate-200 bg-white p-4 sm:p-8 shadow-sm space-y-6 sm:space-y-8">
      <header className="space-y-1">
        <h2 className="text-xl sm:text-2xl font-semibold text-slate-900 tracking-tight">Your travel and event details</h2>
        <p className="text-sm text-slate-600 leading-relaxed">
          Please complete the fields below so the committee can keep your profile up to date. Your answers are saved on this device as you type; use{" "}
          <span className="font-medium text-slate-800">Save to my account</span> to sync them to your signed-in profile.
        </p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
        <Field label="Last name" htmlFor="ad-last">
          <input
            id="ad-last"
            className={inputClass}
            value={draft.lastName}
            onChange={(e) => setDraft((s) => ({ ...s, lastName: e.target.value }))}
            autoComplete="family-name"
          />
        </Field>
        <Field label="First name" htmlFor="ad-first">
          <input
            id="ad-first"
            className={inputClass}
            value={draft.firstName}
            onChange={(e) => setDraft((s) => ({ ...s, firstName: e.target.value }))}
            autoComplete="given-name"
          />
        </Field>
        <Field label="Nickname" htmlFor="ad-nickname">
          <input
            id="ad-nickname"
            className={inputClass}
            value={draft.nickname}
            onChange={(e) => setDraft((s) => ({ ...s, nickname: e.target.value }))}
            placeholder="Optional"
          />
        </Field>
        <Field label="AIA Agent Code" htmlFor="ad-agent-code">
          <input
            id="ad-agent-code"
            className={inputClass}
            value={draft.aiaAgentCode}
            onChange={(e) => setDraft((s) => ({ ...s, aiaAgentCode: e.target.value }))}
            placeholder="Enter your code"
          />
        </Field>
        <Field label="Middle name" htmlFor="ad-middle-name">
          <input
            id="ad-middle-name"
            className={inputClass}
            maxLength={120}
            value={draft.middleName}
            onChange={(e) => setDraft((s) => ({ ...s, middleName: e.target.value }))}
            autoComplete="additional-name"
          />
        </Field>
        <Field label="Age" htmlFor="ad-age" className="sm:max-w-[8rem]">
          <input
            id="ad-age"
            type="number"
            inputMode="numeric"
            min={1}
            max={120}
            className={inputClass}
            value={draft.age}
            onChange={(e) => setDraft((s) => ({ ...s, age: e.target.value }))}
          />
        </Field>
        <div className="sm:col-span-2 space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Position</span>
          <select
            id="ad-pos"
            className={inputClass}
            value={draft.positionCode}
            onChange={(e) => setDraft((s) => ({ ...s, positionCode: e.target.value }))}
          >
            {POSITION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {draft.positionCode === "others" && (
            <input
              className={`${inputClass} mt-2`}
              placeholder="Describe your role"
              value={draft.positionOther}
              onChange={(e) => setDraft((s) => ({ ...s, positionOther: e.target.value }))}
              aria-label="Position — other description"
            />
          )}
        </div>
        <Field label="Gender" htmlFor="ad-gender">
          <select
            id="ad-gender"
            className={inputClass}
            value={draft.gender}
            onChange={(e) => setDraft((s) => ({ ...s, gender: e.target.value }))}
          >
            <option value="">Select…</option>
            {GENDER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <div
          className={`space-y-2 rounded-2xl border p-3 sm:p-4 ${
            shirtFieldsLocked ? "border-slate-200 bg-slate-50" : "border-red-200 bg-red-50/60"
          }`}
        >
          <span className={`text-xs font-bold uppercase tracking-wide ${shirtFieldsLocked ? "text-slate-600" : "text-red-700"}`}>
            T-shirt size {shirtFieldsLocked ? "(locked — committee / admin)" : "(required)"}
          </span>
          {shirtFieldsLocked ? (
            <p className="text-xs text-slate-600 leading-relaxed">
              The committee cut-off for self-service shirt changes has passed ({participantShirtDeadlineLabel()}). Your saved size below is kept on file; contact an admin if it must be corrected.
            </p>
          ) : null}
          <select
            id="ad-shirt"
            className={`${inputClass} bg-white disabled:bg-slate-100 disabled:text-slate-600`}
            value={draft.shirtSize}
            onChange={(e) => setDraft((s) => ({ ...s, shirtSize: e.target.value }))}
            required={!shirtFieldsLocked}
            disabled={shirtFieldsLocked}
          >
            <option value="">Select your size…</option>
            {SHIRT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {draft.shirtSize === "others" && (
            <input
              className={`${inputClass} mt-2 disabled:bg-slate-100`}
              placeholder="Shirt size details"
              value={draft.shirtSizeOther}
              onChange={(e) => setDraft((s) => ({ ...s, shirtSizeOther: e.target.value }))}
              aria-label="Shirt size — other details"
              disabled={shirtFieldsLocked}
            />
          )}
        </div>
        <Field label="Date of arrival in Cebu" htmlFor="ad-arr">
          <input
            id="ad-arr"
            type="date"
            className={inputClass}
            value={draft.arrivalCebu}
            onChange={(e) => setDraft((s) => ({ ...s, arrivalCebu: e.target.value }))}
          />
        </Field>
        <Field label="Date of departure from Cebu" htmlFor="ad-dep">
          <input
            id="ad-dep"
            type="date"
            className={inputClass}
            value={draft.departureCebu}
            onChange={(e) => setDraft((s) => ({ ...s, departureCebu: e.target.value }))}
          />
        </Field>
      </div>

      {SHOW_CEBU_TOUR_ACTIVITIES ? (
      <>
      <section id="tours-cards" className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base sm:text-lg font-semibold text-slate-900">Cebu City Tours & Activities</h3>
            <p className="text-sm text-slate-600 mt-1">Tap any card to expand details. Choose your preferred activities below.</p>
          </div>
          <a href="#tour-registration" className="inline-flex min-h-[40px] items-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100">
            Register here
          </a>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {CEBU_TOUR_CARDS.map((card) => {
            const selected = Boolean(draft[card.key]);
            const expanded = expandedTourCard === card.id;
            return (
              <article
                key={card.id}
                className={`rounded-xl border p-3.5 transition ${
                  selected ? "border-red-300 bg-red-50/60" : "border-slate-200 bg-slate-50/40"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setExpandedTourCard((prev) => (prev === card.id ? "" : card.id))}
                  className="w-full text-left"
                >
                  <p className="text-sm font-semibold text-slate-900">{card.title}</p>
                  <p className="mt-1 text-xs text-slate-600">{card.short}</p>
                  <p className="mt-2 text-[11px] font-semibold text-red-700">{expanded ? "Hide details" : "View details"}</p>
                </button>
                {expanded ? <p className="mt-2 text-sm text-slate-700 leading-relaxed">{card.details}</p> : null}
              </article>
            );
          })}
        </div>
      </section>

      <fieldset className="rounded-2xl border border-slate-200 bg-gradient-to-b from-red-50/40 to-white p-4 sm:p-6 space-y-4">
        <legend className="text-base sm:text-lg font-semibold text-slate-900 px-1">
          Would you like to extend your stay and enjoy fun Cebu activities after PAMACON?
        </legend>
        <p className="text-sm text-slate-600 leading-relaxed">
          Select all activities you are interested in. This helps the team prepare options and rates for your extension day.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {ACTIVITY_KEYS.map(({ key, label }) => (
            <label
              key={key}
              className={`flex items-center gap-3 min-h-[52px] cursor-pointer rounded-xl border px-3 py-3 transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-red-200 ${
                draft[key] ? "border-red-300 bg-red-50/70" : "border-slate-200 bg-white hover:border-red-200 hover:bg-red-50/40"
              }`}
            >
              <input
                type="checkbox"
                checked={Boolean(draft[key])}
                onChange={(e) => setDraft((s) => ({ ...s, [key]: e.target.checked }))}
                className="h-5 w-5 rounded border-slate-300 text-red-600 focus:ring-red-500"
              />
              <span className="text-sm sm:text-base text-slate-800 font-medium">{label}</span>
            </label>
          ))}
        </div>
        <label className="block space-y-1.5 pt-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Any other activity request?</span>
          <textarea
            rows={2}
            className={`${inputClass} min-h-[5rem] resize-y`}
            placeholder="Example: whale shark tour, specific date preference, family-friendly option"
            value={draft.extraOtherRequest}
            onChange={(e) => setDraft((s) => ({ ...s, extraOtherRequest: e.target.value }))}
          />
        </label>
      </fieldset>

      <section id="tour-registration" className="scroll-mt-24 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 sm:p-6 space-y-3">
        <h3 className="text-base font-semibold text-slate-900">Activities registration and payment confirmation</h3>
        <p className="text-sm text-slate-700 leading-relaxed">
          If you plan to join optional activities, confirm your registration intent here and upload your GCash / QR payment proof so the committee can include you in the activity list.
        </p>
        <p className="rounded-xl border border-emerald-300 bg-emerald-100 px-3 py-2 text-xs font-semibold text-emerald-900">
          This payment section is for <strong>Cebu City Tours &amp; Activities only</strong> (not for conference registration payments).
        </p>
        <div className="rounded-xl border border-emerald-200 bg-white p-3 sm:p-4 flex flex-col sm:flex-row gap-3 sm:items-start">
          {!activityQrLoadFailed ? (
            <div className="flex flex-col items-start gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setActivityQrZoomOpen(true)}
                className="rounded-xl border border-emerald-200 bg-white p-1 shadow-sm transition hover:border-emerald-400 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
                aria-label="Open GCash QR code full screen"
              >
                <img
                  src={activityGcashQrUrl}
                  alt="GCash QR code for activities payment"
                  className="h-36 w-36 rounded-lg bg-white object-contain pointer-events-none"
                  onError={() => setActivityQrLoadFailed(true)}
                />
              </button>
              <span className="text-[11px] font-medium text-emerald-800">Tap QR to zoom in</span>
            </div>
          ) : (
            <div className="h-36 w-36 rounded-lg border border-amber-300 bg-amber-50 p-2 text-[11px] font-semibold text-amber-900 leading-tight">
              QR image not found.
              <span className="block mt-1 font-normal">
                Add <code className="rounded bg-amber-100 px-1">frontend/public/payments/gcash-qr.jpg</code> or set{" "}
                <code className="rounded bg-amber-100 px-1">VITE_ACTIVITY_GCASH_QR_URL</code>.
              </span>
            </div>
          )}
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-sm text-slate-600 leading-relaxed">
              Scan this QR with GCash to pay for optional activities, then upload the confirmation screenshot below.
            </p>
            {!activityQrLoadFailed ? (
              <button
                type="button"
                onClick={() => void downloadActivityGcashQr()}
                className="inline-flex items-center justify-center gap-2 min-h-[44px] rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-100"
              >
                <Download size={18} aria-hidden />
                Download QR to photos / files
              </button>
            ) : null}
          </div>
        </div>
        <label className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm font-medium text-slate-800">
          <input
            type="checkbox"
            checked={Boolean(draft.activityRegistrationConfirmed)}
            onChange={(e) =>
              setDraft((s) => ({
                ...s,
                activityRegistrationConfirmed: e.target.checked,
                activityPaymentConfirmedAt: e.target.checked ? s.activityPaymentConfirmedAt || new Date().toISOString() : "",
              }))
            }
            className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
          />
          I want to register for selected activities
        </label>
        {!hasSelectedActivities ? (
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
            Select at least one activity above so the team can process your activity registration and payment.
          </p>
        ) : null}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Payment method</span>
            <select
              className={inputClass}
              value={draft.activityPaymentMethod}
              onChange={(e) => setDraft((s) => ({ ...s, activityPaymentMethod: e.target.value }))}
            >
              <option value="">Select payment method…</option>
              <option value="gcash_qr">GCash via QR code</option>
              <option value="gcash_number">GCash send money</option>
              <option value="bank_transfer">Bank transfer</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Reference number / note</span>
            <input
              className={inputClass}
              placeholder="e.g. GCash ref no. / transaction note"
              value={draft.activityPaymentReference}
              onChange={(e) => setDraft((s) => ({ ...s, activityPaymentReference: e.target.value }))}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Amount paid</span>
            <input
              className={inputClass}
              type="number"
              min="0"
              step="0.01"
              placeholder="e.g. 1200"
              value={draft.activityPaymentAmount}
              onChange={(e) => setDraft((s) => ({ ...s, activityPaymentAmount: e.target.value }))}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sender mobile number</span>
            <input
              className={inputClass}
              placeholder="e.g. 09XXXXXXXXX"
              value={draft.activityPaymentSenderNumber}
              onChange={(e) => setDraft((s) => ({ ...s, activityPaymentSenderNumber: e.target.value }))}
            />
          </label>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="inline-flex cursor-pointer items-center justify-center rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800">
            Upload activity payment proof
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => {
                  if (typeof reader.result !== "string") return;
                  setDraft((s) => ({
                    ...s,
                    activityPaymentProofScreenshotDataUrl: reader.result,
                    activityPaymentProofUploadedAt: new Date().toISOString(),
                    activityPaymentStatus: "pending",
                  }));
                };
                reader.readAsDataURL(file);
              }}
            />
          </label>
          {draft.activityPaymentProofScreenshotDataUrl ? (
            <button
              type="button"
              onClick={() =>
                setDraft((s) => ({
                  ...s,
                  activityPaymentProofScreenshotDataUrl: "",
                  activityPaymentProofUploadedAt: "",
                  activityPaymentStatus: "pending",
                }))
              }
              className="inline-flex items-center justify-center rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-100"
            >
              Remove activity proof
            </button>
          ) : null}
        </div>
        {draft.activityPaymentProofScreenshotDataUrl ? (
          <div className="space-y-2">
            <img
              src={draft.activityPaymentProofScreenshotDataUrl}
              alt="Activity payment proof screenshot preview"
              className="max-h-56 w-full max-w-md rounded-xl border border-slate-200 bg-white object-contain"
            />
            <p className="text-xs text-slate-500">
              Uploaded {draft.activityPaymentProofUploadedAt ? new Date(draft.activityPaymentProofUploadedAt).toLocaleString() : "just now"}.
            </p>
          </div>
        ) : null}
        <p className="text-xs">
          <span
            className={`inline-flex rounded px-2 py-1 font-semibold ${
              activityPaymentStatusLabel.includes("Confirmed") ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"
            }`}
          >
            Activity payment: {activityPaymentStatusLabel}
          </span>
        </p>
      </section>
      </>
      ) : null}

      <section className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 sm:p-6 space-y-3">
        <h3 className="text-base font-semibold text-slate-900">
          Conference registration payment proof screenshot
          <span className="ml-2 text-sm font-medium text-slate-500 normal-case">Optional</span>
        </h3>
        <p className="text-sm text-slate-700 leading-relaxed">
          If you have paid your <strong>conference fee</strong>, you may screenshot your bank / GCash confirmation and upload it here so committee staff can validate it in
          the Delegates list.
          <span className="block mt-1 text-slate-600">Staff/Admin can open your proof from the Conference Delegates list (Payment column) when you upload one.</span>
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="inline-flex cursor-pointer items-center justify-center rounded-xl bg-amber-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-800">
            Upload screenshot
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => {
                  if (typeof reader.result !== "string") return;
                  setDraft((s) => ({
                    ...s,
                    paymentProofScreenshotDataUrl: reader.result,
                    paymentProofUploadedAt: new Date().toISOString(),
                  }));
                };
                reader.readAsDataURL(file);
              }}
            />
          </label>
          {draft.paymentProofScreenshotDataUrl ? (
            <button
              type="button"
              onClick={() => setDraft((s) => ({ ...s, paymentProofScreenshotDataUrl: "", paymentProofUploadedAt: "" }))}
              className="inline-flex items-center justify-center rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-100"
            >
              Remove screenshot
            </button>
          ) : null}
        </div>
        {draft.paymentProofScreenshotDataUrl ? (
          <div className="space-y-2">
            <img
              src={draft.paymentProofScreenshotDataUrl}
              alt="Payment proof screenshot preview"
              className="max-h-56 w-full max-w-md rounded-xl border border-slate-200 bg-white object-contain"
            />
            <p className="text-xs text-slate-500">
              Uploaded {draft.paymentProofUploadedAt ? new Date(draft.paymentProofUploadedAt).toLocaleString() : "just now"}.
              Click <strong>Save to my account</strong> to submit this to staff.
            </p>
          </div>
        ) : null}
      </section>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <button
          type="button"
          disabled={profileSaving}
          onClick={handleSave}
          className="inline-flex items-center justify-center gap-2 min-h-[48px] rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 shadow-sm"
        >
          <Save size={18} aria-hidden />
          {profileSaving ? "Saving…" : "Save to my account"}
        </button>
        {saveError && <p className="text-sm font-medium text-rose-700">{saveError}</p>}
        {savedFlash && <p className="text-sm font-medium text-emerald-700">Saved.</p>}
      </div>

      {SHOW_CEBU_TOUR_ACTIVITIES ? (
      <div className="border-t border-slate-200 pt-6 space-y-4">
        <h3 className="text-base font-semibold text-slate-900">Request a quote (tours / extensions)</h3>
        <p className="text-sm text-slate-600">
          Opens your email app with this form summarized in the message. Choose the option that best matches your group size.
        </p>
        <div className="grid grid-cols-1 xs:grid-cols-1 sm:grid-cols-3 gap-3">
          <QuoteButton label="Individual" sub="1 person" onClick={() => openQuote("Individual (1)")} />
          <QuoteButton label="Small group" sub="6 people" onClick={() => openQuote("Group of 6")} />
          <QuoteButton label="Large group" sub="15 people" onClick={() => openQuote("Group of 15")} />
        </div>
        {!resolvedQuoteEmail && (
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
            Configure <code className="font-mono text-[11px]">VITE_QUOTE_REQUEST_EMAIL</code> or event <code className="font-mono text-[11px]">quoteRequestEmail</code> so
            mail links reach your tours desk.
          </p>
        )}
      </div>
      ) : null}

      {SHOW_CEBU_TOUR_ACTIVITIES && activityQrZoomOpen && !activityQrLoadFailed ? (
        <div
          className="fixed inset-0 z-[130] bg-black/90 p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="GCash QR code enlarged"
          onClick={() => setActivityQrZoomOpen(false)}
        >
          <div className="relative mx-auto flex h-full max-w-4xl flex-col items-center justify-center">
            <div className="absolute right-0 top-0 z-10 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  void downloadActivityGcashQr();
                }}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500"
              >
                <Download size={18} aria-hidden />
                Download
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActivityQrZoomOpen(false);
                }}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/40 bg-black/50 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black/70"
              >
                <X size={18} aria-hidden />
                Close
              </button>
            </div>
            <img
              src={activityGcashQrUrl}
              alt="GCash QR code for activities payment — enlarged"
              className="max-h-[88vh] max-w-full rounded-2xl bg-white object-contain shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
            <p className="mt-4 text-center text-xs text-white/80">Tap outside the QR or press Escape to close</p>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function Field({ label, htmlFor, className = "", children }) {
  return (
    <label className={`block space-y-1.5 ${className}`} htmlFor={htmlFor}>
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function QuoteButton({ label, sub, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-stretch justify-center gap-0.5 min-h-[52px] rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-900 hover:border-red-300 hover:bg-red-50/50 active:scale-[0.99] transition shadow-sm"
    >
      <span className="flex items-center justify-between gap-2">
        {label}
        <ChevronRight className="shrink-0 text-slate-400" size={18} aria-hidden />
      </span>
      <span className="text-xs font-normal text-slate-500">{sub}</span>
    </button>
  );
}
