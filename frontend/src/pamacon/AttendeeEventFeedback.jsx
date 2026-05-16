import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, MessageSquareText, Star } from "lucide-react";
import { getMyEventFeedback, putMyEventFeedback } from "../lib/api";
import { defaultRatingScores, defaultResponses, formatDisplayName } from "./eventFeedbackSchema";

function StarRow({ label, value, onChange, disabled }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-semibold text-slate-900 leading-snug">{label}</p>
      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label={label}>
        {[1, 2, 3, 4, 5].map((n) => {
          const active = value === n;
          return (
            <button
              key={n}
              type="button"
              disabled={disabled}
              onClick={() => onChange(n)}
              className={`inline-flex min-h-[44px] min-w-[44px] flex-1 sm:flex-none sm:min-w-[52px] items-center justify-center rounded-xl border text-sm font-bold transition-colors ${
                active
                  ? "border-red-600 bg-red-600 text-white shadow-md"
                  : "border-slate-200 bg-slate-50 text-slate-700 hover:border-red-200 hover:bg-red-50"
              } disabled:opacity-50`}
              aria-pressed={active}
              aria-label={`${n} out of 5 — ${n === 1 ? "dissatisfied" : n === 5 ? "highly satisfied" : ""}`}
            >
              <Star className={`h-4 w-4 ${active ? "fill-white text-white" : "text-amber-400 fill-amber-200"}`} aria-hidden />
              <span className="ml-1">{n}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-slate-500">1 = dissatisfied · 5 = highly satisfied</p>
    </div>
  );
}

function TextAreaField({ id, label, required, value, onChange, disabled, rows = 3, placeholder }) {
  return (
    <div>
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
        className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-inner focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-100"
      />
    </div>
  );
}

export default function AttendeeEventFeedback({
  eventId,
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

  const maxStep = 3;

  const load = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    try {
      const data = await getMyEventFeedback(eventId);
      const sch = data.schema || null;
      setSchema(sch);
      const ratingKeys = (sch?.ratings || []).map((r) => r.key);
      const emptyScores = ratingKeys.length ? Object.fromEntries(ratingKeys.map((k) => [k, 0])) : defaultRatingScores();

      if (data.item?.scores) {
        setScores({ ...emptyScores, ...data.item.scores });
        const r = data.item.responses || {};
        setResponses({
          displayName: r.displayName || formatDisplayName(profile) || "",
          agency: r.agency || "",
          coffeeSession: r.coffeeSession || "",
          speakerImpact: r.speakerImpact || "",
          biggestTakeaway: r.biggestTakeaway || "",
          testimonial: r.testimonial || "",
        });
        setTextExtras({
          likedMost: data.item.likedMost || data.item.highlights || "",
          suggestions: data.item.suggestions || "",
        });
        setSubmitted(true);
      } else {
        setScores(emptyScores);
        setResponses({ ...defaultResponses(), displayName: formatDisplayName(profile) });
        setTextExtras({ likedMost: "", suggestions: "" });
        setSubmitted(false);
      }
    } catch (e) {
      onNotify?.("error", e?.message || "Could not load feedback form.");
    } finally {
      setLoading(false);
    }
  }, [eventId, onNotify, profile]);

  useEffect(() => {
    void load();
  }, [load]);

  const stepLabel = schema?.steps?.find((s) => s.id === step)?.label || "";

  const step1Complete = useMemo(() => {
    return (
      String(responses.displayName || "").trim().length > 0 &&
      String(responses.agency || "").trim().length > 0 &&
      String(responses.coffeeSession || "").trim().length > 0
    );
  }, [responses]);

  const step2Complete = useMemo(() => {
    const ratings = schema?.ratings || [];
    return ratings.every((r) => scores[r.key] >= 1 && scores[r.key] <= 5);
  }, [schema, scores]);

  const step3Complete = useMemo(() => {
    return (
      String(responses.speakerImpact || "").trim() &&
      String(responses.biggestTakeaway || "").trim() &&
      String(textExtras.likedMost || "").trim() &&
      String(textExtras.suggestions || "").trim() &&
      String(responses.testimonial || "").trim()
    );
  }, [responses, textExtras]);

  const stepComplete = (n) => (n === 1 ? step1Complete : n === 2 ? step2Complete : step3Complete);

  const handleSubmit = async () => {
    if (!eventId || !step3Complete) return;
    setSaving(true);
    try {
      await putMyEventFeedback(eventId, {
        scores,
        responses: {
          ...responses,
          likedMost: textExtras.likedMost,
          suggestions: textExtras.suggestions,
        },
        likedMost: textExtras.likedMost,
        highlights: textExtras.likedMost,
        suggestions: textExtras.suggestions,
        seededRegistrationId: attendeeSyncHints.seededRegistrationId,
        seededDelegateName: attendeeSyncHints.seededDelegateName,
        profile: {
          firstName: profile.firstName,
          lastName: profile.lastName,
          nickname: profile.nickname,
        },
      });
      setSubmitted(true);
      onNotify?.("ok", submitted ? "Feedback updated. Thank you!" : "Thank you — your feedback was submitted.");
    } catch (e) {
      onNotify?.("error", e?.message || "Could not save feedback.");
    } finally {
      setSaving(false);
    }
  };

  if (!eventId) return null;

  if (loading) {
    return (
      <section id="event-feedback" className="rounded-2xl sm:rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm" aria-busy="true">
        <p className="text-sm text-slate-600">Loading feedback…</p>
      </section>
    );
  }

  if (!schema?.ratings?.length) return null;

  const isLastStep = step === maxStep;

  return (
    <section
      id="event-feedback"
      aria-labelledby="event-feedback-heading"
      className="rounded-2xl sm:rounded-3xl border border-slate-200 bg-gradient-to-b from-white to-slate-50/80 p-6 sm:p-8 shadow-sm"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-600 text-white shadow-md shadow-red-600/25">
          <MessageSquareText className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-wide text-red-700">Post-event</p>
          <h2 id="event-feedback-heading" className="text-lg sm:text-xl font-bold text-slate-900">
            {schema.formTitle || "PAMA Conference Feedback"}
          </h2>
          <p className="mt-1 text-sm text-slate-600 leading-relaxed">
            {schema.formIntro ||
              "Share your experience — the same topics as our official delegate survey. You can update your answers anytime while signed in."}{" "}
            <span className="font-semibold text-slate-800">{authEmail}</span>
          </p>
        </div>
      </div>

      <ol className="mt-6 flex items-center gap-1 text-[11px] font-semibold text-slate-500" aria-label="Progress">
        {[1, 2, 3].map((n) => (
          <li key={n} className="flex flex-1 items-center gap-1 min-w-0">
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${
                step === n ? "border-red-600 bg-red-600 text-white" : stepComplete(n) ? "border-emerald-500 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white"
              }`}
            >
              {stepComplete(n) ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : n}
            </span>
            {n < 3 ? <span className="h-px flex-1 bg-slate-200" aria-hidden /> : null}
          </li>
        ))}
      </ol>
      {stepLabel ? <p className="mt-2 text-xs font-semibold text-slate-700">{stepLabel}</p> : null}

      {step === 1 ? (
        <div className="mt-5 space-y-4">
          <div>
            <label htmlFor="fb-name" className="block text-sm font-semibold text-slate-900">
              Name (Last Name, First Name) <span className="text-red-600">*</span>
            </label>
            <input
              id="fb-name"
              type="text"
              disabled={saving}
              value={responses.displayName}
              onChange={(e) => setResponses((p) => ({ ...p, displayName: e.target.value }))}
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium"
              placeholder="e.g. Santos, Juan"
            />
          </div>
          <div>
            <label htmlFor="fb-agency" className="block text-sm font-semibold text-slate-900">
              Agency <span className="text-red-600">*</span>
            </label>
            <input
              id="fb-agency"
              type="text"
              disabled={saving}
              value={responses.agency}
              onChange={(e) => setResponses((p) => ({ ...p, agency: e.target.value }))}
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium"
            />
          </div>
          <fieldset className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <legend className="text-sm font-semibold text-slate-900 px-1">
              Which coffee session did you go to? <span className="text-red-600">*</span>
            </legend>
            <div className="mt-3 space-y-2">
              {(schema.coffeeSessions || []).map((opt) => (
                <label
                  key={opt.value}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 text-sm transition-colors ${
                    responses.coffeeSession === opt.value ? "border-red-300 bg-red-50" : "border-slate-100 hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="coffeeSession"
                    className="mt-1"
                    disabled={saving}
                    checked={responses.coffeeSession === opt.value}
                    onChange={() => setResponses((p) => ({ ...p, coffeeSession: opt.value }))}
                  />
                  <span className="text-slate-800 leading-snug">{opt.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="mt-5 space-y-4">
          {(schema.ratings || []).map((row) => (
            <StarRow
              key={row.key}
              label={row.label}
              value={scores[row.key] || 0}
              disabled={saving}
              onChange={(n) => setScores((prev) => ({ ...prev, [row.key]: n }))}
            />
          ))}
        </div>
      ) : null}

      {step === 3 ? (
        <div className="mt-5 space-y-4">
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
            label="Do you have any suggestions for us to improve in the next conferences?"
            required
            rows={4}
            disabled={saving}
            value={textExtras.suggestions}
            onChange={(v) => setTextExtras((p) => ({ ...p, suggestions: v }))}
          />
          <TextAreaField
            id="fb-testimonial"
            label="Please write a short testimonial of your experience at the conference"
            required
            rows={4}
            disabled={saving}
            value={responses.testimonial}
            onChange={(v) => setResponses((p) => ({ ...p, testimonial: v }))}
            placeholder="A few sentences we may use (with permission) for future promotions."
          />
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
            disabled={saving || !stepComplete(step)}
            onClick={() => setStep((s) => Math.min(maxStep, s + 1))}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-red-600 px-5 text-sm font-semibold text-white shadow-md hover:bg-red-700 disabled:opacity-40"
          >
            Continue
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        ) : (
          <button
            type="button"
            disabled={saving || !step3Complete}
            onClick={() => void handleSubmit()}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-red-600 px-5 text-sm font-semibold text-white shadow-md hover:bg-red-700 disabled:opacity-40"
          >
            {saving ? "Saving…" : submitted ? "Update feedback" : "Submit feedback"}
          </button>
        )}
      </div>
    </section>
  );
}
