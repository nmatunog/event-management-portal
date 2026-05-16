import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Coffee,
  Hotel,
  MessageSquareText,
  Mic,
  Mic2,
  Presentation,
  Sparkles,
  Star,
  Trophy,
  Tv,
  Users2,
  UtensilsCrossed,
} from "lucide-react";
import { getMyEventFeedback, getPublicEventFeedback, putMyEventFeedback, submitPublicEventFeedback } from "../lib/api";
import { loadDelegateIdentity, mergeDelegateProfile, saveDelegateIdentity } from "../lib/delegateIdentity";
import {
  FEEDBACK_RATING_SECTIONS,
  defaultRatingScores,
  defaultResponses,
  formatDisplayName,
  formatGreetingName,
  PAMACON_2027_JOIN_OPTIONS,
  ratingsForStep,
} from "./eventFeedbackSchema";

const ICONS = {
  Coffee,
  UtensilsCrossed,
  Sparkles,
  Presentation,
  Mic,
  Mic2,
  Users2,
  Trophy,
  Tv,
  Hotel,
  Star,
};

function RatingCard({ label, subtitle, iconName, value, onChange, disabled }) {
  const Icon = ICONS[iconName] || Star;
  return (
    <div className="bg-white p-5 sm:p-6 rounded-[28px] border border-slate-100 shadow-sm space-y-4 hover:border-red-200/80 transition-colors">
      <div className="flex items-start gap-3 text-slate-800">
        <div className="p-2.5 bg-slate-50 rounded-xl text-slate-500 shrink-0">
          <Icon size={20} aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] sm:text-xs font-black uppercase tracking-tight leading-snug">{label}</p>
          {subtitle ? <p className="text-[11px] text-slate-500 mt-1 leading-snug">{subtitle}</p> : null}
        </div>
      </div>
      <div className="flex justify-between gap-1.5" role="group" aria-label={label}>
        {[1, 2, 3, 4, 5].map((n) => {
          const active = value === n;
          return (
            <button
              key={n}
              type="button"
              disabled={disabled}
              onClick={() => onChange(n)}
              className={`flex-1 min-h-[48px] rounded-xl font-black text-sm transition-all ${
                active ? "bg-red-600 text-white shadow-lg scale-[1.02]" : "bg-slate-50 text-slate-400 hover:bg-slate-100"
              } disabled:opacity-50`}
              aria-pressed={active}
              aria-label={`${n} out of 5`}
            >
              {n}
            </button>
          );
        })}
      </div>
      <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">1 = dissatisfied · 5 = highly satisfied</p>
    </div>
  );
}

function TextAreaField({ id, label, required, value, onChange, disabled, rows = 3, placeholder }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <label htmlFor={id} className="block text-sm font-semibold text-slate-900">
        {label}
        {required ? <span className="text-red-600"> *</span> : null}
      </label>
      <textarea
        id={id}
        rows={rows}
        required={required}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-100"
      />
    </div>
  );
}

function RatingStepContent({ stepNum, schema, scores, setScores, saving }) {
  const schemaRatings = schema?.ratings || [];
  const sections = FEEDBACK_RATING_SECTIONS.filter((s) => s.step === stepNum);

  if (sections.length) {
    return (
      <div className="mt-5 space-y-8">
        {sections.map((section) => (
          <div key={section.title} className="space-y-4">
            <h3 className={`text-base font-black uppercase border-l-4 pl-3 ${section.accent.replace("border-", "text-").replace("600", "700")} ${section.accent}`}>
              {section.title}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {section.items.map((item) => {
                const row = schemaRatings.find((r) => r.key === item.key);
                return (
                  <RatingCard
                    key={item.key}
                    label={row?.label || item.label}
                    subtitle={row?.subtitle || item.subtitle}
                    iconName={item.icon}
                    value={scores[item.key] || 0}
                    disabled={saving}
                    onChange={(n) => setScores((prev) => ({ ...prev, [item.key]: n }))}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  }

  const orphan = ratingsForStep(schemaRatings, stepNum);
  if (!orphan.length) return null;
  return (
    <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
      {orphan.map((row) => (
        <RatingCard
          key={row.key}
          label={row.label}
          subtitle={row.subtitle}
          iconName="Star"
          value={scores[row.key] || 0}
          disabled={saving}
          onChange={(n) => setScores((prev) => ({ ...prev, [row.key]: n }))}
        />
      ))}
    </div>
  );
}

export default function AttendeeEventFeedback({
  eventId,
  authInitialized = true,
  authEmail,
  attendeeSyncHints = {},
  profile = {},
  onNotify,
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [schema, setSchema] = useState(null);
  const [step, setStep] = useState(1);
  const [scores, setScores] = useState(defaultRatingScores);
  const [responses, setResponses] = useState(defaultResponses);
  const [textExtras, setTextExtras] = useState({ likedMost: "", suggestions: "" });
  const [submitted, setSubmitted] = useState(false);
  const [formClosed, setFormClosed] = useState(false);
  const [matchInfo, setMatchInfo] = useState(null);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [connectedDelegate, setConnectedDelegate] = useState(null);

  const isLoggedIn = Boolean(String(authEmail || "").trim());
  const rememberedDelegate = useMemo(() => mergeDelegateProfile(profile), [profile]);
  const greetingName = formatGreetingName(responses.firstName, responses.lastName);
  const maxStep = 5;

  const applyFeedbackItem = useCallback((data, emptyScores) => {
    if (!data?.item?.scores) return false;
    setScores({ ...emptyScores, ...data.item.scores });
    const r = data.item.responses || {};
    setResponses((prev) => ({
      ...prev,
      firstName: r.firstName || prev.firstName,
      lastName: r.lastName || prev.lastName,
      agency: r.agency || prev.agency,
      speakerImpact: r.speakerImpact || "",
      biggestTakeaway: r.biggestTakeaway || "",
      testimonial: r.testimonial || "",
      joiningPamacon2027: r.joiningPamacon2027 || "",
    }));
    setTextExtras({
      likedMost: data.item.likedMost || data.item.highlights || "",
      suggestions: data.item.suggestions || "",
    });
    if (data.match) setMatchInfo(data.match);
    setSubmitted(true);
    return true;
  }, []);

  const load = useCallback(async () => {
    if (!eventId || !authInitialized) return;
    setLoading(true);
    try {
      const saved = loadDelegateIdentity();
      const merged = mergeDelegateProfile(profile, saved);
      const lookupFirst = merged.firstName;
      const lookupLast = merged.lastName;

      const data = isLoggedIn
        ? await getMyEventFeedback(eventId, {
            firstName: lookupFirst,
            lastName: lookupLast,
            nickname: merged.nickname,
            seededRegistrationId: attendeeSyncHints.seededRegistrationId,
            seededDelegateName: attendeeSyncHints.seededDelegateName,
          })
        : await getPublicEventFeedback(eventId, {
            firstName: lookupFirst,
            lastName: lookupLast,
          });

      const sch = data.schema || null;
      setSchema(sch);
      const ratingKeys = (sch?.ratings || []).map((r) => r.key);
      const emptyScores = ratingKeys.length ? Object.fromEntries(ratingKeys.map((k) => [k, 0])) : defaultRatingScores();

      const delegate = data.delegate || {};
      const agencyPrefill = data.match?.agencyFromRegistration || data.match?.agencyPrefill || delegate.agency || merged.agency;
      const baseResponses = {
        ...defaultResponses(),
        firstName: String(delegate.firstName || lookupFirst || "").trim(),
        lastName: String(delegate.lastName || lookupLast || "").trim(),
        agency: String(agencyPrefill || "").trim(),
      };

      if (data.match) setMatchInfo(data.match);
      if (data.connectedAccount || isLoggedIn) {
        setConnectedDelegate({
          email: authEmail || delegate.email || saved?.email || "",
          fromLogin: Boolean(isLoggedIn),
          fromRemembered: Boolean(!isLoggedIn && saved?.email),
        });
      } else if (saved?.email || saved?.firstName) {
        setConnectedDelegate({ email: saved.email, fromLogin: false, fromRemembered: true });
      } else {
        setConnectedDelegate(null);
      }

      if (applyFeedbackItem(data, emptyScores)) {
        setFormClosed(true);
        if (isLoggedIn) {
          saveDelegateIdentity({
            email: authEmail,
            firstName: baseResponses.firstName,
            lastName: baseResponses.lastName,
            agency: baseResponses.agency,
            nickname: merged.nickname,
          });
        }
      } else {
        setScores(emptyScores);
        setResponses(baseResponses);
        setTextExtras({ likedMost: "", suggestions: "" });
        setSubmitted(false);
        setFormClosed(false);
        if (!data.match) setMatchInfo(null);
      }
    } catch (e) {
      onNotify?.("error", e?.message || "Could not load feedback form.");
    } finally {
      setLoading(false);
    }
  }, [eventId, authInitialized, isLoggedIn, authEmail, onNotify, profile, attendeeSyncHints, applyFeedbackItem]);

  useEffect(() => {
    void load();
  }, [load]);

  const stepLabel = schema?.steps?.find((s) => s.id === step)?.label || "";

  const ratingsComplete = useCallback(
    (stepNum) => {
      const list = ratingsForStep(schema?.ratings, stepNum);
      if (!list.length) return true;
      return list.every((r) => scores[r.key] >= 1 && scores[r.key] <= 5);
    },
    [schema, scores]
  );

  const step1Complete = useMemo(
    () =>
      String(responses.firstName || "").trim() &&
      String(responses.lastName || "").trim() &&
      String(responses.agency || "").trim(),
    [responses]
  );

  const handleContinueFromStep1 = async () => {
    if (!step1Complete || !eventId) return;
    if (isLoggedIn) {
      if (!matchInfo?.registrationMatched) {
        setLookupBusy(true);
        try {
          const data = await getPublicEventFeedback(eventId, {
            firstName: responses.firstName,
            lastName: responses.lastName,
          });
          setMatchInfo(data.match || null);
          const agencyPrefill = data.match?.agencyFromRegistration || data.match?.agencyPrefill;
          if (agencyPrefill && !String(responses.agency || "").trim()) {
            setResponses((p) => ({ ...p, agency: agencyPrefill }));
          }
        } catch {
          // Proceed without blocking — signed-in save still works.
        } finally {
          setLookupBusy(false);
        }
      }
      saveDelegateIdentity({
        email: authEmail,
        firstName: responses.firstName,
        lastName: responses.lastName,
        agency: responses.agency,
        nickname: rememberedDelegate.nickname,
      });
      setStep(2);
      return;
    }
    setLookupBusy(true);
    try {
      const data = await getPublicEventFeedback(eventId, {
        firstName: responses.firstName,
        lastName: responses.lastName,
      });
      setMatchInfo(data.match || null);
      const agencyPrefill = data.match?.agencyFromRegistration || data.match?.agencyPrefill;
      if (agencyPrefill && !String(responses.agency || "").trim()) {
        setResponses((p) => ({ ...p, agency: agencyPrefill }));
      }
      const ratingKeys = (schema?.ratings || []).map((r) => r.key);
      const emptyScores = ratingKeys.length ? Object.fromEntries(ratingKeys.map((k) => [k, 0])) : defaultRatingScores();
      if (data.item?.scores) {
        applyFeedbackItem(data, emptyScores);
      }
      setStep(2);
    } catch (e) {
      onNotify?.("error", e?.message || "Could not verify your name.");
    } finally {
      setLookupBusy(false);
    }
  };

  const step5Complete = useMemo(
    () =>
      String(responses.speakerImpact || "").trim() &&
      String(responses.biggestTakeaway || "").trim() &&
      String(textExtras.likedMost || "").trim() &&
      String(textExtras.suggestions || "").trim() &&
      String(responses.testimonial || "").trim() &&
      PAMACON_2027_JOIN_OPTIONS.some((o) => o.value === responses.joiningPamacon2027),
    [responses, textExtras]
  );

  const stepComplete = (n) => {
    if (n === 1) return step1Complete;
    if (n === 5) return step5Complete;
    return ratingsComplete(n);
  };

  const handleSubmit = async () => {
    if (!eventId || !step5Complete) return;
    setSaving(true);
    try {
      const payload = {
        scores,
        responses: { ...responses, likedMost: textExtras.likedMost, suggestions: textExtras.suggestions },
        likedMost: textExtras.likedMost,
        highlights: textExtras.likedMost,
        suggestions: textExtras.suggestions,
        firstName: responses.firstName,
        lastName: responses.lastName,
        seededRegistrationId: attendeeSyncHints.seededRegistrationId,
        seededDelegateName: attendeeSyncHints.seededDelegateName,
        profile: {
          firstName: responses.firstName || profile.firstName,
          lastName: responses.lastName || profile.lastName,
          nickname: profile.nickname,
        },
      };
      const result = isLoggedIn
        ? await putMyEventFeedback(eventId, payload)
        : await submitPublicEventFeedback(eventId, payload);
      if (result?.match) setMatchInfo(result.match);
      saveDelegateIdentity({
        email: authEmail || loadDelegateIdentity()?.email,
        firstName: responses.firstName,
        lastName: responses.lastName,
        agency: responses.agency,
        nickname: rememberedDelegate.nickname,
      });
      setSubmitted(true);
      setFormClosed(true);
      onNotify?.("ok", `Your feedback has been submitted! Thank you${greetingName ? `, ${greetingName}` : ""}!`);
    } catch (e) {
      onNotify?.("error", e?.message || "Could not save feedback.");
    } finally {
      setSaving(false);
    }
  };

  if (!eventId) return null;

  if (loading) {
    return (
      <section className="rounded-2xl sm:rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm" aria-busy="true">
        <p className="text-sm text-slate-600">Loading evaluation…</p>
      </section>
    );
  }

  if (!schema?.ratings?.length) return null;

  if (formClosed) {
    return (
      <section
        aria-labelledby="event-feedback-thanks-heading"
        className="rounded-2xl sm:rounded-3xl border border-emerald-200 bg-gradient-to-b from-emerald-50/90 to-white p-8 sm:p-10 shadow-sm text-center"
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-white shadow-md">
          <CheckCircle2 className="h-8 w-8" aria-hidden />
        </div>
        <h2 id="event-feedback-thanks-heading" className="mt-5 text-xl sm:text-2xl font-bold text-slate-900">
          {greetingName ? `Thank you, ${greetingName}!` : "Your feedback has been submitted! Thank you!"}
        </h2>
        <p className="mt-2 text-sm text-slate-600 max-w-md mx-auto">
          {matchInfo?.registrationMatched
            ? "We matched your name to our delegate list and saved your evaluation."
            : "Your evaluation was saved and included in the conference ratings."}
        </p>
        <button
          type="button"
          onClick={() => {
            setFormClosed(false);
            setStep(1);
          }}
          className="mt-6 inline-flex min-h-[44px] items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Edit your feedback
        </button>
      </section>
    );
  }

  const isLastStep = step === maxStep;
  const progressSteps = schema.steps?.length ? schema.steps : [1, 2, 3, 4, 5].map((id) => ({ id, label: `Step ${id}` }));

  return (
    <section
      aria-labelledby="event-feedback-heading"
      className="rounded-2xl sm:rounded-3xl border border-slate-200 bg-gradient-to-b from-white to-slate-50/80 p-5 sm:p-8 shadow-sm"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-600 text-white shadow-md">
          <MessageSquareText className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-wide text-red-700">Post-event evaluation</p>
          <h2 id="event-feedback-heading" className="text-lg sm:text-xl font-bold text-slate-900">
            {schema.formTitle || "PAMACON Conference Evaluation"}
          </h2>
          <p className="mt-1 text-sm text-slate-600 leading-relaxed">
            {schema.formIntro}
            {isLoggedIn ? (
              <>
                {" "}
                Signed in as <span className="font-semibold text-slate-800">{authEmail}</span> — your delegate profile is linked to this evaluation.
              </>
            ) : connectedDelegate?.fromRemembered ? (
              <>
                {" "}
                Welcome back
                {greetingName ? (
                  <>
                    , <span className="font-semibold text-slate-800">{greetingName}</span>
                  </>
                ) : null}
                . We restored your details from your last sign-in.
              </>
            ) : (
              <> No account or sign-in required — enter your name as registered for PAMACON.</>
            )}
          </p>
          {connectedDelegate?.fromLogin && matchInfo?.registrationMatched ? (
            <p className="mt-2 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
              Connected to delegate registration
              {matchInfo.registrationName ? `: ${matchInfo.registrationName}` : ""}.
            </p>
          ) : null}
        </div>
      </div>

      <ol className="mt-6 flex items-center gap-0.5 overflow-x-auto pb-1" aria-label="Progress">
        {progressSteps.map((s, i) => (
          <li key={s.id} className="flex items-center gap-0.5 shrink-0">
            <span
              className={`flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full border text-[10px] font-bold ${
                step === s.id
                  ? "border-red-600 bg-red-600 text-white"
                  : stepComplete(s.id)
                    ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                    : "border-slate-200 bg-white text-slate-500"
              }`}
              title={s.label}
            >
              {stepComplete(s.id) ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> : s.id}
            </span>
            {i < progressSteps.length - 1 ? <span className="w-3 sm:w-6 h-px bg-slate-200" aria-hidden /> : null}
          </li>
        ))}
      </ol>
      {stepLabel ? <p className="mt-2 text-xs font-semibold text-slate-700">{stepLabel}</p> : null}

      {step === 1 ? (
        <div className="mt-5 space-y-4">
          {greetingName ? (
            <p className="rounded-xl border border-red-100 bg-red-50/80 px-4 py-3 text-sm text-red-900">
              Hello, <span className="font-bold">{greetingName}</span> — please confirm your details below.
            </p>
          ) : null}
          <div className="rounded-[28px] border border-slate-100 bg-white p-5 sm:p-6 shadow-sm space-y-4">
            <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Delegate identification</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="fb-first" className="block text-sm font-semibold text-slate-900">
                  First name <span className="text-red-600">*</span>
                </label>
                <input
                  id="fb-first"
                  type="text"
                  autoComplete="given-name"
                  disabled={saving || lookupBusy}
                  value={responses.firstName}
                  onChange={(e) => setResponses((p) => ({ ...p, firstName: e.target.value }))}
                  className="mt-1.5 w-full rounded-xl border-2 border-slate-100 bg-slate-50 px-3 py-3 text-sm font-semibold focus:border-red-400 focus:outline-none"
                  placeholder="e.g. Juan"
                />
              </div>
              <div>
                <label htmlFor="fb-last" className="block text-sm font-semibold text-slate-900">
                  Family name / Last name <span className="text-red-600">*</span>
                </label>
                <input
                  id="fb-last"
                  type="text"
                  autoComplete="family-name"
                  disabled={saving || lookupBusy}
                  value={responses.lastName}
                  onChange={(e) => setResponses((p) => ({ ...p, lastName: e.target.value }))}
                  className="mt-1.5 w-full rounded-xl border-2 border-slate-100 bg-slate-50 px-3 py-3 text-sm font-semibold focus:border-red-400 focus:outline-none"
                  placeholder="e.g. Santos"
                />
              </div>
            </div>
            <div>
              <label htmlFor="fb-agency" className="block text-sm font-semibold text-slate-900">
                Agency <span className="text-red-600">*</span>
              </label>
              <input
                id="fb-agency"
                type="text"
                disabled={saving || lookupBusy}
                value={responses.agency}
                onChange={(e) => setResponses((p) => ({ ...p, agency: e.target.value }))}
                className="mt-1.5 w-full rounded-xl border-2 border-slate-100 bg-slate-50 px-3 py-3 text-sm font-semibold focus:border-red-400 focus:outline-none"
                placeholder="Your agency name"
              />
            </div>
            {!isLoggedIn ? (
              <p className="text-xs text-slate-500 leading-relaxed">
                We will try to match your name to the delegate list. If there is no match, your feedback is still saved and counted.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {step >= 2 && step <= 4 && matchInfo?.registrationMatched ? (
        <p className="mt-4 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">
          Matched to delegate registration{matchInfo.registrationName ? `: ${matchInfo.registrationName}` : ""}.
        </p>
      ) : null}

      {step >= 2 && step <= 4 ? <RatingStepContent stepNum={step} schema={schema} scores={scores} setScores={setScores} saving={saving} /> : null}

      {step === 5 ? (
        <div className="mt-5 space-y-4">
          <h3 className="text-base font-black uppercase border-l-4 border-emerald-600 pl-3 text-emerald-800">Your reflections</h3>
          <TextAreaField
            id="fb-speaker"
            label="Which speaker impacted you the most and why?"
            required
            rows={3}
            disabled={saving}
            value={responses.speakerImpact}
            onChange={(v) => setResponses((p) => ({ ...p, speakerImpact: v }))}
          />
          <TextAreaField
            id="fb-takeaway"
            label="What is your biggest takeaway from the conference?"
            required
            rows={3}
            disabled={saving}
            value={responses.biggestTakeaway}
            onChange={(v) => setResponses((p) => ({ ...p, biggestTakeaway: v }))}
          />
          <TextAreaField
            id="fb-liked"
            label="What did you like the most about the conference this year?"
            required
            rows={3}
            disabled={saving}
            value={textExtras.likedMost}
            onChange={(v) => setTextExtras((p) => ({ ...p, likedMost: v }))}
          />
          <TextAreaField
            id="fb-suggestions"
            label="Suggestions to improve future PAMACON events"
            required
            rows={4}
            disabled={saving}
            value={textExtras.suggestions}
            onChange={(v) => setTextExtras((p) => ({ ...p, suggestions: v }))}
          />
          <TextAreaField
            id="fb-testimonial"
            label="Short testimonial (may be used with permission)"
            required
            rows={4}
            disabled={saving}
            value={responses.testimonial}
            onChange={(v) => setResponses((p) => ({ ...p, testimonial: v }))}
          />
          <div className="rounded-2xl border border-red-100 bg-gradient-to-br from-red-50/80 to-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-900">
              Will you be joining PAMACON2027? <span className="text-red-600">*</span>
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap" role="radiogroup" aria-label="Will you be joining PAMACON2027?">
              {PAMACON_2027_JOIN_OPTIONS.map((opt) => {
                const active = responses.joiningPamacon2027 === opt.value;
                return (
                  <label
                    key={opt.value}
                    className={`flex min-h-[48px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 px-4 py-3 text-sm font-semibold transition-colors ${
                      active ? "border-red-600 bg-red-600 text-white shadow-md" : "border-slate-200 bg-white text-slate-700 hover:border-red-200 hover:bg-red-50/50"
                    } ${saving ? "opacity-60 pointer-events-none" : ""}`}
                  >
                    <input
                      type="radio"
                      name="joiningPamacon2027"
                      value={opt.value}
                      checked={active}
                      disabled={saving}
                      onChange={() => setResponses((p) => ({ ...p, joiningPamacon2027: opt.value }))}
                      className="sr-only"
                    />
                    {opt.label}
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          disabled={saving || step <= 1}
          onClick={() => setStep((s) => Math.max(1, s - 1))}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          Back
        </button>
        {!isLastStep ? (
          <button
            type="button"
            disabled={saving || lookupBusy || !stepComplete(step)}
            onClick={() => void (step === 1 ? handleContinueFromStep1() : setStep((s) => Math.min(maxStep, s + 1)))}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-red-600 px-5 text-sm font-semibold text-white shadow-md hover:bg-red-700 disabled:opacity-40"
          >
            {lookupBusy ? "Checking name…" : "Continue"}
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        ) : (
          <button
            type="button"
            disabled={saving || !step5Complete}
            onClick={() => void handleSubmit()}
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-slate-900 px-6 text-sm font-black uppercase tracking-wide text-white hover:bg-black disabled:opacity-40"
          >
            {saving ? "Saving…" : submitted ? "Update feedback" : "Submit evaluation"}
          </button>
        )}
      </div>
    </section>
  );
}
