import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, MessageSquareText, Star } from "lucide-react";
import { getMyEventFeedback, putMyEventFeedback } from "../lib/api";

const STEP_LABELS = {
  1: "Before & during — logistics",
  2: "Experience — sessions, meals, venue",
  3: "Support, production & overall",
};

function emptyScoresFromSchema(schema) {
  const o = {};
  for (const row of schema || []) {
    o[row.key] = 0;
  }
  return o;
}

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
              aria-label={`${n} out of 5`}
            >
              <Star className={`h-4 w-4 ${active ? "fill-white text-white" : "text-amber-400 fill-amber-200"}`} aria-hidden />
              <span className="ml-1">{n}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-slate-500">1 = poor · 5 = excellent</p>
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
  const [schema, setSchema] = useState([]);
  const [step, setStep] = useState(1);
  const [scores, setScores] = useState({});
  const [highlights, setHighlights] = useState("");
  const [suggestions, setSuggestions] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const load = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    try {
      const data = await getMyEventFeedback(eventId);
      const sch = data.schema || [];
      setSchema(sch);
      if (data.item?.scores) {
        setScores({ ...emptyScoresFromSchema(sch), ...data.item.scores });
        setHighlights(String(data.item.highlights || ""));
        setSuggestions(String(data.item.suggestions || ""));
        setSubmitted(true);
      } else {
        setScores(emptyScoresFromSchema(sch));
        setHighlights("");
        setSuggestions("");
        setSubmitted(false);
      }
    } catch (e) {
      onNotify?.("error", e?.message || "Could not load feedback form.");
    } finally {
      setLoading(false);
    }
  }, [eventId, onNotify]);

  useEffect(() => {
    void load();
  }, [load]);

  const byStep = useMemo(() => {
    const map = { 1: [], 2: [], 3: [] };
    for (const row of schema) {
      if (map[row.step]) map[row.step].push(row);
    }
    return map;
  }, [schema]);

  const stepComplete = (n) => {
    const rows = byStep[n] || [];
    return rows.every((r) => scores[r.key] >= 1 && scores[r.key] <= 5);
  };

  const allRated = [1, 2, 3].every((n) => stepComplete(n));

  const handleSubmit = async () => {
    if (!eventId || !allRated) return;
    setSaving(true);
    try {
      await putMyEventFeedback(eventId, {
        scores,
        highlights,
        suggestions,
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
      <section
        id="event-feedback"
        className="rounded-2xl sm:rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm"
        aria-busy="true"
      >
        <p className="text-sm text-slate-600">Loading feedback…</p>
      </section>
    );
  }

  if (!schema.length) {
    return null;
  }

  const maxStep = 3;
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
            Event feedback
          </h2>
          <p className="mt-1 text-sm text-slate-600 leading-relaxed">
            A few taps per screen — ratings are required; written comments are optional. You can update your response anytime while signed in as{" "}
            <span className="font-semibold text-slate-800">{authEmail}</span>.
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
      <p className="mt-2 text-xs font-semibold text-slate-700">{STEP_LABELS[step]}</p>

      <div className="mt-5 space-y-4">
        {(byStep[step] || []).map((row) => (
          <StarRow
            key={row.key}
            label={row.label}
            value={scores[row.key] || 0}
            disabled={saving}
            onChange={(n) => setScores((prev) => ({ ...prev, [row.key]: n }))}
          />
        ))}
      </div>

      {isLastStep ? (
        <div className="mt-6 space-y-4">
          <div>
            <label htmlFor="fb-highlights" className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
              What went especially well? (optional)
            </label>
            <textarea
              id="fb-highlights"
              rows={3}
              value={highlights}
              disabled={saving}
              onChange={(e) => setHighlights(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-inner focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-100"
              placeholder="Short highlights help the team celebrate wins."
            />
          </div>
          <div>
            <label htmlFor="fb-suggestions" className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Suggestions for next time (optional)
            </label>
            <textarea
              id="fb-suggestions"
              rows={4}
              value={suggestions}
              disabled={saving}
              onChange={(e) => setSuggestions(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-inner focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-100"
              placeholder="Be specific (e.g., registration desk queues, session length, dietary options)."
            />
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
            disabled={saving || !allRated}
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
