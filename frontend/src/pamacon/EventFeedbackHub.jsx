import { useCallback, useEffect, useState } from "react";
import { BarChart3, MessageSquareText, Sparkles } from "lucide-react";
import { getEventFeedbackAnalytics } from "../lib/api";

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
      <p className="mt-1 text-[10px] text-slate-400">{total ? `${total} ratings in this category` : "No data"}</p>
    </div>
  );
}

export default function EventFeedbackHub({ eventId, eventTitle, onError }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

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

  if (!eventId) {
    return <p className="text-sm text-slate-500">Select an event to view feedback.</p>;
  }

  if (loading) {
    return (
      <div className="flex items-center gap-3 text-slate-600">
        <div className="h-9 w-9 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium">Loading feedback analytics…</p>
      </div>
    );
  }

  if (!data) {
    return <p className="text-sm text-slate-500">No analytics available.</p>;
  }

  const insights = data.suggestionInsights || {};
  const unlocked = Boolean(insights.unlocked);

  return (
    <div className="space-y-8 pb-16">
      <div className="bg-white p-6 sm:p-8 rounded-[32px] border shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center text-red-600 shadow-inner shrink-0">
            <MessageSquareText size={28} />
          </div>
          <div className="min-w-0">
            <h3 className="text-xl font-black uppercase text-slate-800 tracking-tight">Attendee feedback</h3>
            <p className="text-sm text-slate-500 mt-1 truncate">{eventTitle || data.event?.title || "Event"}</p>
            <p className="text-2xl font-black text-red-600 mt-2 tabular-nums">
              {data.responseCount}
              <span className="text-sm font-semibold text-slate-500 ml-2">responses</span>
            </p>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4 shrink-0">
          <p className="text-[10px] font-bold uppercase text-slate-400">Overall experience (avg)</p>
          <p className="text-3xl font-black text-slate-900 tabular-nums">{Number(data.overallAverage || 0).toFixed(2)}</p>
          <p className="text-xs text-slate-500 mt-1">From the “overall experience” question only.</p>
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="text-slate-500" size={20} aria-hidden />
          <h4 className="text-lg font-semibold text-slate-900">Ratings by area</h4>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {(data.averages || []).map((row) => (
            <BarDistribution
              key={row.key}
              label={row.label}
              sub={null}
              dist={data.distributions?.[row.key] || {}}
              average={Number(row.average || 0)}
            />
          ))}
        </div>
      </div>

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
                  <p className="text-xs font-bold uppercase text-slate-400 mb-2">Top words in written comments</p>
                  <div className="flex flex-wrap gap-2">
                    {insights.topKeywords.slice(0, 10).map((k) => (
                      <span key={k.word} className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                        {k.word}
                        <span className="ml-1 text-slate-400">×{k.count}</span>
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-500">No written comments yet — numeric summaries still apply.</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-600 leading-relaxed">{insights.message}</p>
          )}
        </div>

        <div className="bg-white rounded-[28px] border shadow-sm p-6 sm:p-8">
          <h4 className="text-lg font-semibold text-slate-900 mb-1">Suggested priorities</h4>
          <p className="text-xs text-slate-500 mb-4">
            {unlocked
              ? "Auto-generated from scores and comment wording — use as a starting point for debriefs."
              : "Prioritized themes appear once there are at least 40 responses."}
          </p>
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
              <li>Watch the lowest bars in the chart above — they highlight relative gaps.</li>
              <li>Read recent comments (below) for qualitative detail.</li>
            </ul>
          )}
        </div>
      </div>

      <div className="bg-white rounded-[28px] border shadow-sm p-6 sm:p-8">
        <h4 className="text-lg font-semibold text-slate-900 mb-2">Recent written comments</h4>
        <p className="text-xs text-slate-500 mb-4">Newest first; trimmed for display. Identities are not shown.</p>
        {(data.recentSuggestions || []).length ? (
          <ul className="space-y-3">
            {data.recentSuggestions.map((t, i) => (
              <li key={i} className="rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-3 text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
                {t}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">No open-ended suggestions submitted yet.</p>
        )}
      </div>

      <p className="text-[11px] text-slate-400">Generated {data.generatedAt ? new Date(data.generatedAt).toLocaleString() : "—"}</p>
    </div>
  );
}
