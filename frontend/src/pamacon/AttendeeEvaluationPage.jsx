import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ClipboardList, Home, LogOut, MessageSquareText } from "lucide-react";
import { PAMACON_TITLE } from "./defaultConfig";
import { resolvePamaconEvent } from "./resolvePamaconEvent";
import AttendeeEventFeedback from "./AttendeeEventFeedback";

export default function AttendeeEvaluationPage({
  authInitialized = true,
  authEmail,
  profile,
  attendeeSyncHints,
  canManage = false,
  onLogout,
  onApiInfo,
  onApiError,
}) {
  const [loading, setLoading] = useState(true);
  const [eventRow, setEventRow] = useState(null);
  const [loadError, setLoadError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const ev = await resolvePamaconEvent();
      if (!ev?.id) {
        setLoadError("The conference event is not available yet. Please try again later.");
        setEventRow(null);
        return;
      }
      setEventRow(ev);
    } catch (e) {
      setLoadError(e?.message || "Could not load event.");
      setEventRow(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const title = eventRow?.title || PAMACON_TITLE;

  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-slate-50 to-slate-100 text-slate-800 pb-[max(2rem,env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur-md shadow-sm">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="rounded-2xl bg-white border border-slate-200 flex items-center gap-2 px-3 py-2 shadow-sm shrink-0">
              <img src="/branding/pama-symbol.png" alt="PAMA" className="h-8 w-8 object-contain" />
              <img src="/branding/pama-wordmark.png" alt="AIA PAMA" className="h-6 w-auto max-w-[150px] object-contain" />
            </div>
            <div className="min-w-0 hidden sm:block">
              <p className="text-[10px] font-bold uppercase tracking-wide text-red-700">Evaluation survey</p>
              <p className="text-sm font-semibold text-slate-900 truncate">{title}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <Link
              to="/"
              className="inline-flex items-center justify-center gap-1.5 min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Home size={16} aria-hidden />
              Home
            </Link>
            {canManage ? (
              <Link
                to="/portal"
                className="inline-flex items-center justify-center min-h-[44px] rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-800 hover:bg-violet-100"
              >
                Admin portal
              </Link>
            ) : authEmail ? (
              <Link
                to="/portal"
                className="inline-flex items-center justify-center min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Attendee hub
              </Link>
            ) : (
              <Link
                to="/sign-in?next=%2Fevaluation"
                className="inline-flex items-center justify-center min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Sign in
              </Link>
            )}
            {typeof onLogout === "function" ? (
              <button
                type="button"
                onClick={onLogout}
                className="inline-flex items-center justify-center gap-1.5 min-h-[44px] rounded-xl border border-red-200 bg-red-50 px-3.5 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
              >
                <LogOut size={16} aria-hidden />
                Logout
              </button>
            ) : null}
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="rounded-2xl border border-red-100 bg-gradient-to-br from-red-50/90 via-white to-amber-50/50 p-6 sm:p-8 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-600 text-white shadow-md">
              <ClipboardList className="h-6 w-6" aria-hidden />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Conference evaluation</h1>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Share your feedback on sessions, meals, hotel, and the overall experience. No account needed — enter your first and family name as registered for PAMACON.
                {authEmail ? (
                  <>
                    {" "}
                    Signed in as <span className="font-semibold text-slate-800">{authEmail}</span>.
                  </>
                ) : null}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                Share this link with delegates:{" "}
                <span className="font-mono text-slate-700 break-all">{typeof window !== "undefined" ? `${window.location.origin}/evaluation` : "/evaluation"}</span>
              </p>
            </div>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-slate-600 text-center py-12">Loading survey…</p>
        ) : loadError ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-6 text-sm text-amber-900">{loadError}</div>
        ) : (
          <AttendeeEventFeedback
            eventId={eventRow.id}
            authInitialized={authInitialized}
            authEmail={authEmail}
            attendeeSyncHints={attendeeSyncHints}
            profile={profile}
            onNotify={(kind, msg) => {
              if (kind === "ok") onApiInfo?.(msg);
              else onApiError?.({ message: msg }, msg);
            }}
          />
        )}

        {canManage ? (
          <div className="rounded-2xl border border-violet-200 bg-violet-50/80 p-5 flex gap-3 items-start">
            <MessageSquareText className="text-violet-600 shrink-0 mt-0.5" size={22} aria-hidden />
            <div className="text-sm text-violet-950">
              <p className="font-semibold">Committee: view aggregated results</p>
              <p className="mt-1 text-violet-800/90 leading-relaxed">
                Open the admin workspace → <strong>Event evaluation</strong> for charts, written feedback, AI strategy, and next-year action items.
              </p>
              <Link to="/portal" className="mt-3 inline-flex min-h-[44px] items-center rounded-xl bg-violet-700 px-4 text-sm font-semibold text-white hover:bg-violet-800">
                Open admin portal
              </Link>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
