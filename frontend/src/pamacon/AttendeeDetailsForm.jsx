import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronRight, Save } from "lucide-react";

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
    "",
    "Thank you.",
  ];
  return lines.join("\n");
}

export default function AttendeeDetailsForm({ profile, authEmail, onSaveProfile, profileSaving, quoteEmail }) {
  const [draft, setDraft] = useState(() => draftFromProfile(profile));
  const [savedFlash, setSavedFlash] = useState(false);
  const [saveError, setSaveError] = useState("");

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
    if (!String(draft.shirtSize || "").trim()) {
      setSaveError("T-shirt size is required before saving.");
      return;
    }
    if (draft.shirtSize === "others" && !String(draft.shirtSizeOther || "").trim()) {
      setSaveError("Please specify your T-shirt size.");
      return;
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
          Please complete the fields below so the committee can plan shirts, logistics, and optional tours. Your answers are saved on this device as you type; use{" "}
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
        <div className="space-y-2 rounded-2xl border border-red-200 bg-red-50/60 p-3 sm:p-4">
          <span className="text-xs font-bold uppercase tracking-wide text-red-700">T-shirt size (required)</span>
          <select
            id="ad-shirt"
            className={`${inputClass} bg-white`}
            value={draft.shirtSize}
            onChange={(e) => setDraft((s) => ({ ...s, shirtSize: e.target.value }))}
            required
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
              className={`${inputClass} mt-2`}
              placeholder="Shirt size details"
              value={draft.shirtSizeOther}
              onChange={(e) => setDraft((s) => ({ ...s, shirtSizeOther: e.target.value }))}
              aria-label="Shirt size — other details"
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

      <section className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 sm:p-6 space-y-3">
        <h3 className="text-base font-semibold text-slate-900">Payment proof screenshot</h3>
        <p className="text-sm text-slate-700 leading-relaxed">
          After you pay, screenshot your bank / GCash confirmation and upload it here. Staff/Admin will use this for payment validation.
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
