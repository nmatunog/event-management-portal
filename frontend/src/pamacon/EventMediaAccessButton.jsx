import { Camera, ExternalLink, Lock } from "lucide-react";
import { DEFAULT_EVENT_MEDIA_LABEL } from "./eventMedia";

/**
 * Opens Google Drive event media for matched delegates; compact or full button styles.
 */
export default function EventMediaAccessButton({
  configured = false,
  loading = false,
  hasAccess = false,
  url = "",
  label = DEFAULT_EVENT_MEDIA_LABEL,
  lockMessage = "",
  variant = "button",
  onNeedProfile,
}) {
  if (!configured && !loading) return null;

  const displayLabel = String(label || "").trim() || DEFAULT_EVENT_MEDIA_LABEL;

  const openDrive = () => {
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  if (variant === "card") {
    return (
      <div className="rounded-2xl border border-sky-200 bg-white/90 p-4 shadow-sm space-y-2">
        <p className="text-[11px] font-bold uppercase tracking-wide text-sky-700">Available now</p>
        <p className="text-sm font-bold text-slate-900">{displayLabel}</p>
        {loading ? (
          <p className="text-xs text-slate-500">Checking access…</p>
        ) : !hasAccess ? (
          <>
            <p className="text-xs text-slate-600 leading-relaxed flex items-start gap-1.5">
              <Lock size={14} className="shrink-0 mt-0.5 text-amber-700" aria-hidden />
              {lockMessage || "Sign in and match your delegate registration to open the album."}
            </p>
            {typeof onNeedProfile === "function" ? (
              <button
                type="button"
                onClick={onNeedProfile}
                className="inline-flex min-h-[40px] items-center justify-center rounded-lg bg-sky-700 px-3 py-2 text-xs font-bold text-white hover:bg-sky-800"
              >
                Complete your profile
              </button>
            ) : null}
          </>
        ) : (
          <>
            <p className="text-xs text-slate-600 leading-relaxed">
              Browse official conference photos and videos on Google Drive.
            </p>
            <button
              type="button"
              onClick={openDrive}
              disabled={!url}
              className="inline-flex w-full min-h-[40px] items-center justify-center gap-2 rounded-lg bg-sky-600 px-3 py-2 text-xs font-bold text-white hover:bg-sky-700 disabled:opacity-50"
            >
              <Camera size={16} aria-hidden />
              Open album
              <ExternalLink size={14} aria-hidden />
            </button>
          </>
        )}
      </div>
    );
  }

  if (variant === "header") {
    return (
      <button
        type="button"
        onClick={openDrive}
        disabled={loading || !hasAccess || !url}
        title={!hasAccess ? lockMessage : displayLabel}
        className="inline-flex items-center justify-center gap-1.5 min-h-[44px] rounded-xl border border-sky-200 bg-sky-50 px-3.5 py-2 text-sm font-semibold text-sky-900 hover:bg-sky-100 shadow-sm disabled:opacity-50"
      >
        <Camera size={16} aria-hidden />
        Photos &amp; videos
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={openDrive}
      disabled={loading || !hasAccess || !url}
      title={!hasAccess ? lockMessage : undefined}
      className="inline-flex w-full sm:w-auto flex-1 sm:flex-none items-center justify-center gap-2 min-h-[48px] rounded-2xl border-2 border-sky-300 bg-sky-50 px-6 py-3 text-sm font-bold text-sky-900 shadow-sm hover:bg-sky-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <Camera size={18} aria-hidden />
      {loading ? "Loading…" : displayLabel}
      {hasAccess && url ? <ExternalLink size={16} aria-hidden /> : !hasAccess ? <Lock size={16} aria-hidden /> : null}
    </button>
  );
}
