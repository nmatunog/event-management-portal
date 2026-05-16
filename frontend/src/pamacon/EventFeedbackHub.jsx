import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  BrainCircuit,
  ClipboardList,
  ExternalLink,
  Loader2,
  MessageSquareText,
  PieChart,
  Sparkles,
  Zap,
} from "lucide-react";
import { generateEventFeedbackAiStrategy, getEventFeedbackAnalytics } from "../lib/api";
import { SPEAKER_RATING_KEYS } from "./eventFeedbackSchema";

const TABS = [
  { id: "overview", label: "Overview", icon: PieChart },
  { id: "comments", label: "Written feedback", icon: MessageSquareText },
  { id: "strategy", label: "AI & next year", icon: Zap },
];

function BarDistribution({ label, sub, dist, average }) {
  const total = [1, 2, 3, 4, 5].reduce((s, k) => s + (dist[k] || 0), 0);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900 leading-snug">{label}</p>
          {sub ? <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{sub}</p> : null}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-lg font-bold text-red-700 tabular-nums">{average.toFixed(2)}</p>
          <p className="text-[10px] font-semibold uppercase text-slate-400">avg / 5</p>
        </div>
      </div>
      <div className="mt-3 flex h-24 items-end gap-1">
        {[1, 2, 3, 4, 5].map((star) => {
          const c = dist[star] || 0;
          const pct = total ? Math.max(8, Math.round((c / total) * 100)) : 8;
          return (
            <div key={star} className="flex flex-1 flex-col items-center gap-1 min-w-0">
              <div
                className="w-full max-w-[48px] mx-auto rounded-t-md bg-red-100 border border-red-200/80"
                style={{ height: `${pct}%` }}
                title={`${star} stars: ${c}`}
              />
              <span className="text-[10px] font-semibold text-slate-500">{star}</span>
            </div>
          );
        })}
      </div>
      <p className="mt-1 text-[10px] text-slate-400">{total ? `${total} ratings` : "No data"}</p>
    </div>
  );
}

function SpeakerScoreBar({ label, average }) {
  const val = Number(average || 0);
  const pct = (val / 5) * 100;
  return (
    <div className="bg-white p-6 sm:p-8 rounded-[32px] border border-slate-100 shadow-sm space-y-3">
      <div className="flex justify-between items-end gap-3">
        <span className="text-[10px] font-black uppercase text-slate-600 tracking-tight leading-snug">{label}</span>
        <span className="text-xl font-black text-slate-900 tabular-nums shrink-0">{val.toFixed(1)}</span>
      </div>
      <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-700 ${val >= 4 ? "bg-emerald-500" : val >= 3 ? "bg-amber-400" : "bg-red-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function MetricTile({ label, value, accent = "text-slate-900" }) {
  return (
    <div className="bg-white/5 p-6 sm:p-8 rounded-[32px] border border-white/10 min-w-[120px] text-center">
      <p className="text-[10px] font-black uppercase text-white/50 mb-2 tracking-wide">{label}</p>
      <p className={`text-4xl sm:text-5xl font-black tracking-tighter tabular-nums ${accent}`}>{value}</p>
    </div>
  );
}

function OverviewTab({ data }) {
  const exec = data.executiveSummary || {};
  const avgByKey = Object.fromEntries((data.averages || []).map((r) => [r.key, r]));
  const speakerRows = SPEAKER_RATING_KEYS.map((k) => avgByKey[k]).filter(Boolean);
  const day1Rows = (data.averages || []).filter((r) => ["coffee_sessions", "welcome_dinner"].includes(r.key));
  const logisticsRows = (data.averages || []).filter((r) =>
    ["fellowship_night", "hotel_venue", "conference_proper"].includes(r.key)
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="bg-slate-900 p-8 sm:p-10 rounded-[40px] text-white relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-72 h-72 bg-red-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
          <div>
            <h4 className="text-2xl sm:text-3xl font-black uppercase tracking-tight">Convention metrics</h4>
            <p className="text-white/50 text-xs font-bold uppercase tracking-widest mt-2">Delegate evaluation survey</p>
            <p className="text-sm text-white/70 mt-3 max-w-md">
              Data from <span className="font-mono text-white/90">{data.evaluationSurveyUrl || "/evaluation"}</span> — matched delegates and guest submissions by name.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <MetricTile label="Responses" value={exec.responseCount ?? data.responseCount ?? 0} />
            <MetricTile
              label="Composite"
              value={(exec.compositeSatisfaction ?? 0).toFixed(1)}
              accent="text-amber-400"
            />
            <MetricTile
              label="Conference"
              value={(exec.conferenceProperAverage ?? data.overallAverage ?? 0).toFixed(1)}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-[10px] font-bold uppercase text-slate-400">Speakers avg</p>
          <p className="text-2xl font-black text-slate-900 mt-1 tabular-nums">{(exec.speakersAverage ?? 0).toFixed(2)}</p>
          <p className="text-xs text-slate-500 mt-1">Day 2 talks</p>
        </div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-[10px] font-bold uppercase text-slate-400">Logistics avg</p>
          <p className="text-2xl font-black text-slate-900 mt-1 tabular-nums">{(exec.logisticsAverage ?? 0).toFixed(2)}</p>
          <p className="text-xs text-slate-500 mt-1">Hotel & venue</p>
        </div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-[10px] font-bold uppercase text-slate-400">Gap to watch</p>
          <p className="text-sm font-semibold text-slate-900 mt-2 leading-snug">
            {exec.weakest ? `${exec.weakest.label} (${exec.weakest.average.toFixed(2)})` : "—"}
          </p>
          <p className="text-xs text-emerald-700 mt-1">
            {exec.strongest ? `Strongest: ${exec.strongest.label}` : ""}
          </p>
        </div>
      </div>

      {speakerRows.length ? (
        <section>
          <h4 className="text-lg font-black uppercase border-l-4 border-red-600 pl-3 text-red-800 mb-4">Day 2 — Speaker performance</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {speakerRows.map((row) => (
              <SpeakerScoreBar key={row.key} label={row.label} average={row.average} />
            ))}
          </div>
        </section>
      ) : null}

      {day1Rows.length ? (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="text-slate-500" size={20} aria-hidden />
            <h4 className="text-lg font-semibold text-slate-900">Day 1 — Breakout & welcome dinner</h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
            {day1Rows.map((row) => (
              <BarDistribution
                key={row.key}
                label={row.label}
                dist={data.distributions?.[row.key] || {}}
                average={Number(row.average || 0)}
              />
            ))}
          </div>
        </section>
      ) : null}

      {logisticsRows.length ? (
        <section>
          <h4 className="text-lg font-semibold text-slate-900 mb-4">Overall & logistics</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {logisticsRows.map((row) => (
              <BarDistribution
                key={row.key}
                label={row.label}
                dist={data.distributions?.[row.key] || {}}
                average={Number(row.average || 0)}
              />
            ))}
          </div>
        </section>
      ) : null}

      {(data.averages || []).some((r) => r.legacy) ? (
        <section>
          <h4 className="text-sm font-semibold text-slate-500 mb-3">Legacy survey dimensions (prior format)</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 opacity-80">
            {data.averages
              .filter((r) => r.legacy)
              .map((row) => (
                <BarDistribution
                  key={row.key}
                  label={row.label}
                  dist={data.distributions?.[row.key] || {}}
                  average={Number(row.average || 0)}
                />
              ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function CommentsTab({ data }) {
  const insights = data.suggestionInsights || {};
  const unlocked = Boolean(insights.unlocked);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-[28px] border shadow-sm p-6 sm:p-8">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="text-amber-500" size={20} aria-hidden />
            <h4 className="text-lg font-semibold text-slate-900">Suggestions summary</h4>
          </div>
          {unlocked ? (
            <div className="space-y-3 text-sm text-slate-700 leading-relaxed">
              {(insights.summaryLines || []).map((line, i) => (
                <p key={i}>{line}</p>
              ))}
              {insights.topKeywords?.length ? (
                <div className="mt-4">
                  <p className="text-xs font-bold uppercase text-slate-400 mb-2">Top words in comments</p>
                  <div className="flex flex-wrap gap-2">
                    {insights.topKeywords.slice(0, 12).map((k) => (
                      <span
                        key={k.word}
                        className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700"
                      >
                        {k.word}
                        <span className="ml-1 text-slate-400">×{k.count}</span>
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-slate-600 leading-relaxed">{insights.message}</p>
          )}
        </div>

        <div className="bg-white rounded-[28px] border shadow-sm p-6 sm:p-8">
          <h4 className="text-lg font-semibold text-slate-900 mb-1">Rule-based priorities</h4>
          <p className="text-xs text-slate-500 mb-4">Auto-generated from scores and keywords (40+ responses for full unlock).</p>
          {unlocked && insights.priorityActions?.length ? (
            <ol className="space-y-3">
              {insights.priorityActions.map((a) => (
                <li key={`${a.rank}-${a.title}`} className="rounded-xl border border-slate-100 bg-slate-50/80 p-4">
                  <p className="text-xs font-bold text-red-700 uppercase">Priority {a.rank}</p>
                  <p className="text-sm font-semibold text-slate-900 mt-1">{a.title}</p>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">{a.rationale}</p>
                </li>
              ))}
            </ol>
          ) : (
            <ul className="text-sm text-slate-600 space-y-2 list-disc pl-5">
              <li>Review the Overview tab for lowest-rated dimensions.</li>
              <li>Use AI & next year for a full planning narrative.</li>
            </ul>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-[28px] border shadow-sm p-6 sm:p-8">
          <h4 className="text-lg font-semibold text-slate-900 mb-2">Improvement suggestions</h4>
          {(data.recentSuggestions || []).length ? (
            <ul className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {data.recentSuggestions.map((t, i) => (
                <li key={i} className="rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-3 text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
                  {t}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">No suggestions yet.</p>
          )}
        </div>
        <div className="bg-white rounded-[28px] border shadow-sm p-6 sm:p-8">
          <h4 className="text-lg font-semibold text-slate-900 mb-2">Testimonials</h4>
          {(data.recentTestimonials || []).length ? (
            <ul className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {data.recentTestimonials.map((t, i) => (
                <li
                  key={i}
                  className="rounded-xl border border-emerald-100 bg-emerald-50/40 px-4 py-3 text-sm text-slate-800 leading-relaxed whitespace-pre-wrap italic"
                >
                  {t}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">No testimonials yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function StrategyTab({ eventId, data, onError }) {
  const [aiReport, setAiReport] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMeta, setAiMeta] = useState(null);

  const generate = async () => {
    if (!eventId || !(data?.responseCount > 0)) return;
    setAiLoading(true);
    try {
      const res = await generateEventFeedbackAiStrategy(eventId);
      setAiReport(res.report || "");
      setAiMeta(res);
    } catch (e) {
      onError?.(e, "Could not generate AI strategy report.");
    } finally {
      setAiLoading(false);
    }
  };

  const actionItems = aiMeta?.actionItems || [];

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-6">
        <div className="flex items-center gap-3">
          <Zap className="text-amber-500 fill-amber-500" size={28} aria-hidden />
          <div>
            <h4 className="text-xl font-black uppercase tracking-tight text-slate-900">Next PAMACON planning</h4>
            <p className="text-sm text-slate-500 mt-0.5">AI-assisted debrief and action items for the committee</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void generate()}
          disabled={aiLoading || !(data?.responseCount > 0)}
          className={`inline-flex items-center justify-center gap-2 min-h-[48px] px-8 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg transition-all ${
            aiLoading || !(data?.responseCount > 0)
              ? "bg-slate-200 text-slate-400 cursor-not-allowed"
              : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100"
          }`}
        >
          {aiLoading ? <Loader2 size={18} className="animate-spin" /> : <BrainCircuit size={18} />}
          Generate AI roadmap
        </button>
      </div>

      {aiMeta?.themeSuggestion ? (
        <div className="rounded-2xl border border-violet-200 bg-violet-50/80 px-5 py-4">
          <p className="text-[10px] font-black uppercase text-violet-700">Suggested theme direction</p>
          <p className="text-sm font-semibold text-violet-950 mt-1">{aiMeta.themeSuggestion}</p>
        </div>
      ) : null}

      {actionItems.length ? (
        <div className="bg-white rounded-[28px] border shadow-sm p-6 sm:p-8">
          <h4 className="text-lg font-semibold text-slate-900 mb-4">Action items for next PAMACON</h4>
          <ol className="space-y-3">
            {actionItems.map((a) => (
              <li key={`${a.rank}-${a.title}`} className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4">
                <p className="text-xs font-bold text-indigo-700 uppercase">#{a.rank}</p>
                <p className="text-sm font-semibold text-slate-900 mt-1">{a.title}</p>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">{a.rationale}</p>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {aiReport ? (
        <div className="bg-indigo-50 border-2 border-indigo-100 rounded-[40px] p-8 sm:p-12 relative overflow-hidden">
          <div className="absolute top-8 right-8 text-indigo-200/40 pointer-events-none">
            <Sparkles size={80} aria-hidden />
          </div>
          <div className="relative z-10 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-3 py-1 text-[10px] font-black uppercase text-white">
                {aiMeta?.source === "gemini" ? "Gemini AI" : "Rules engine"}
              </span>
              {aiMeta?.generatedAt ? (
                <span className="text-[10px] font-semibold text-indigo-600/80">
                  {new Date(aiMeta.generatedAt).toLocaleString()}
                </span>
              ) : null}
            </div>
            <div className="prose prose-sm prose-slate max-w-none text-indigo-950/90 whitespace-pre-wrap leading-relaxed border-l-2 border-indigo-200 pl-6">
              {aiReport}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white p-16 rounded-[40px] border-2 border-dashed border-slate-200 text-center space-y-4">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-300">
            <Activity size={32} aria-hidden />
          </div>
          <p className="text-slate-500 font-semibold text-sm max-w-md mx-auto">
            {data?.responseCount > 0
              ? "Generate a strategic audit from delegate ratings and written feedback — used for next-year PAMACON planning."
              : "Collect at least one evaluation response before generating a roadmap."}
          </p>
          {!import.meta.env.PROD && (
            <p className="text-[11px] text-slate-400">
              Set <code className="font-mono">GEMINI_API_KEY</code> on the API worker for Gemini-powered reports; otherwise a rules-based plan is used.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function EventFeedbackHub({ eventId, eventTitle, onError }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");

  const load = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    try {
      const res = await getEventFeedbackAnalytics(eventId);
      setData(res);
    } catch (e) {
      onError?.(e, "Failed to load attendee feedback.");
    } finally {
      setLoading(false);
    }
  }, [eventId, onError]);

  useEffect(() => {
    void load();
  }, [load]);

  const surveyHref = useMemo(() => {
    if (typeof window === "undefined") return "/evaluation";
    return `${window.location.origin}/evaluation`;
  }, []);

  if (!eventId) {
    return <p className="text-sm text-slate-500">Select an event to view feedback.</p>;
  }

  if (loading) {
    return (
      <div className="flex items-center gap-3 text-slate-600">
        <div className="h-9 w-9 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium">Loading evaluation analytics…</p>
      </div>
    );
  }

  if (!data) {
    return <p className="text-sm text-slate-500">No analytics available.</p>;
  }

  return (
    <div className="space-y-6 pb-16">
      <div className="bg-white p-6 sm:p-8 rounded-[32px] border shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center text-red-600 shadow-inner shrink-0">
            <ClipboardList size={28} aria-hidden />
          </div>
          <div className="min-w-0">
            <h3 className="text-xl font-black uppercase text-slate-800 tracking-tight">Event evaluation</h3>
            <p className="text-sm text-slate-500 mt-1 truncate">{eventTitle || data.event?.title || "Event"}</p>
          </div>
        </div>
        <a
          href={surveyHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 min-h-[44px] rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-800 hover:bg-red-100 shrink-0"
        >
          Delegate survey
          <ExternalLink size={16} aria-hidden />
        </a>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-4 sticky top-0 bg-slate-50/95 backdrop-blur-sm z-10 -mx-1 px-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
            className={`inline-flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-wide transition-all ${
              activeTab === t.id ? "bg-red-600 text-white shadow-md" : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-100"
            }`}
          >
            <t.icon size={16} aria-hidden />
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" ? <OverviewTab data={data} /> : null}
      {activeTab === "comments" ? <CommentsTab data={data} /> : null}
      {activeTab === "strategy" ? <StrategyTab eventId={eventId} data={data} onError={onError} /> : null}

      <p className="text-[11px] text-slate-400">
        Updated {data.generatedAt ? new Date(data.generatedAt).toLocaleString() : "—"}
      </p>
    </div>
  );
}
