import { Link } from "react-router-dom";
import { Calendar, ChevronDown, Film, ImageIcon, MapPin, Sparkles } from "lucide-react";
import { DEFAULT_PAMACON_CONFIG, DEFAULT_ATTENDEE_PORTAL, PAMACON_TITLE } from "./defaultConfig";
import AttendeeDetailsForm from "./AttendeeDetailsForm";

function youtubeEmbedSrc(url) {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  const short = trimmed.match(/youtu\.be\/([^?&\s#]+)/);
  if (short?.[1]) return `https://www.youtube.com/embed/${short[1]}`;
  const long = trimmed.match(/[?&]v=([^?&\s#]+)/);
  if (long?.[1]) return `https://www.youtube.com/embed/${long[1]}`;
  const embed = trimmed.match(/youtube\.com\/embed\/([^?&\s#]+)/);
  if (embed?.[1]) return `https://www.youtube.com/embed/${embed[1]}`;
  return null;
}

/**
 * Participant-facing portal: marketing placeholders, promo video, and travel / shirt / tour form.
 * Layout is tuned for phones, tablets, and desktop (fluid max-width, touch-friendly controls).
 */
export default function ParticipantPortal({ config = DEFAULT_PAMACON_CONFIG, eventRow, authEmail, profile, onSaveProfile, profileSaving }) {
  const title = eventRow?.title || PAMACON_TITLE;
  const theme = config?.theme || DEFAULT_PAMACON_CONFIG.theme;
  const venue = eventRow?.venue || "Waterfront Cebu Hotel and Casino";
  const start = eventRow?.start_date || "2026-05-13";
  const end = eventRow?.end_date || "2026-05-15";
  const portal = { ...DEFAULT_ATTENDEE_PORTAL, ...(config?.attendeePortal || {}) };
  const posterSlots = [...(portal.posterImageUrls || []), "", "", "", "", ""].slice(0, 5);
  const youtubeUrl =
    String(portal.youtubeUrl || "").trim() || String(import.meta.env.VITE_ATTENDEE_YOUTUBE_URL || "").trim();
  const embedSrc = youtubeEmbedSrc(youtubeUrl);

  return (
    <div
      className="min-h-[100dvh] bg-gradient-to-b from-slate-50 to-slate-100 text-slate-800 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
      style={{ paddingLeft: "max(0px, env(safe-area-inset-left))", paddingRight: "max(0px, env(safe-area-inset-right))" }}
    >
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur-md shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl overflow-hidden bg-white border border-slate-200 flex items-center justify-center shadow-sm shrink-0">
              <img src="/branding/pama-symbol.png" alt="PAMA logo" className="w-full h-full object-contain" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-semibold text-slate-900 tracking-tight truncate">{title}</h1>
              <p className="text-[11px] font-medium text-slate-500 mt-0.5">Attendee portal · AIA PAMA</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <Link
              to="/"
              className="inline-flex items-center justify-center min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 shadow-sm"
            >
              Home
            </Link>
            <a
              href="#attendee-details"
              className="inline-flex items-center justify-center min-h-[44px] rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 shadow-sm"
            >
              Enter your details
            </a>
            <p className="text-[11px] text-slate-500 truncate max-w-full sm:max-w-[14rem] text-left sm:text-right">{authEmail}</p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-8 sm:space-y-10">
        <section className="rounded-2xl sm:rounded-3xl bg-white border border-slate-200/80 p-5 sm:p-8 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-red-600 mb-2">For attendees</p>
          <h2 className="text-xl sm:text-2xl font-semibold text-slate-900 leading-snug">Welcome</h2>
          <p className="mt-3 text-sm sm:text-base text-slate-600 leading-relaxed">
            Use this page on your phone, tablet, or computer. Scroll down for event posters and a welcome video, then complete your travel and shirt information and optional
            post-conference activities.
          </p>
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <a
              href="#posters-heading"
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-red-50 hover:border-red-200 transition"
            >
              1. View posters
            </a>
            <a
              href="#video-heading"
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-red-50 hover:border-red-200 transition"
            >
              2. Watch video
            </a>
            <a
              href="#attendee-details"
              className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 transition"
            >
              3. Complete your details
            </a>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          <InfoCard icon={Sparkles} title="Theme" body={theme} accent="bg-red-50 text-red-600" />
          <InfoCard icon={Calendar} title="Dates" body={`${start} → ${end}`} />
          <InfoCard icon={MapPin} title="Venue" body={venue} />
        </section>

        <section aria-labelledby="posters-heading" className="space-y-4">
          <div className="flex items-end justify-between gap-3 flex-wrap">
            <h2 id="posters-heading" className="text-lg sm:text-xl font-semibold text-slate-900">
              Event posters
            </h2>
            <p className="text-xs text-slate-500 max-w-md">Tap a card to zoom in. Replace images in event configuration whenever posters are finalized.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {posterSlots.map((src, i) => (
              <details
                key={i}
                className="group rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden open:ring-1 open:ring-red-100 transition hover:shadow-md"
              >
                <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                  <div className="relative w-full overflow-hidden bg-slate-100 aspect-[4/5]">
                    {src ? (
                      <img src={src} alt={`Event poster ${i + 1}`} className="absolute inset-0 h-full w-full object-cover transition duration-300 group-open:scale-[1.02]" loading="lazy" />
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center border-2 border-dashed border-slate-300/80 rounded-xl m-2">
                        <ImageIcon className="text-slate-300" size={40} strokeWidth={1.25} aria-hidden />
                        <p className="text-sm font-medium text-slate-500">Poster placeholder</p>
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-900/65 via-slate-900/25 to-transparent p-3">
                      <span className="inline-flex items-center gap-2 rounded-lg bg-white/95 px-2.5 py-1 text-xs font-semibold text-slate-800">
                        <ImageIcon size={14} aria-hidden />
                        Poster {i + 1}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 px-3.5 py-3 border-t border-slate-100">
                    <span className="text-sm font-semibold text-slate-800">{src ? "Tap to view details" : "Waiting for artwork"}</span>
                    <ChevronDown className="h-5 w-5 shrink-0 text-slate-400 transition group-open:rotate-180" aria-hidden />
                  </div>
                </summary>
                <div className="border-t border-slate-100 px-3.5 pb-3.5 pt-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-600 leading-relaxed">
                    {src ? (
                      <>
                        High-resolution source loaded for this poster. Use this card as your quick preview before filling out your attendee details.
                      </>
                    ) : (
                      <>
                        Set <code className="rounded bg-slate-200/80 px-1 py-0.5 text-[10px]">attendeePortal.posterImageUrls[{i}]</code> in event configuration to publish this slot.
                      </>
                    )}
                  </div>
                </div>
              </details>
            ))}
          </div>
        </section>

        <section aria-labelledby="video-heading" className="space-y-4">
          <h2 id="video-heading" className="text-lg sm:text-xl font-semibold text-slate-900 flex items-center gap-2">
            <Film className="text-red-600 shrink-0" size={22} aria-hidden />
            Welcome video
          </h2>
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
            {embedSrc ? (
              <div className="relative w-full aspect-video bg-black">
                <iframe
                  title="Event welcome video"
                  src={embedSrc}
                  className="absolute inset-0 h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  loading="lazy"
                />
              </div>
            ) : (
              <div className="relative w-full aspect-video bg-slate-900/95 flex flex-col items-center justify-center gap-3 p-6 text-center">
                <Film className="text-slate-500" size={36} strokeWidth={1.25} aria-hidden />
                <p className="text-sm font-medium text-slate-300">Video placeholder</p>
                <p className="text-xs text-slate-500 max-w-sm leading-relaxed">
                  Add a YouTube link via <code className="text-slate-400">VITE_ATTENDEE_YOUTUBE_URL</code> or{" "}
                  <code className="text-slate-400">attendeePortal.youtubeUrl</code> in event configuration.
                </p>
              </div>
            )}
            {youtubeUrl && (
              <p className="text-xs text-slate-500 px-4 py-3 border-t border-slate-100">
                Source:{" "}
                <a href={youtubeUrl} className="font-medium text-red-700 hover:underline break-all" target="_blank" rel="noreferrer">
                  {youtubeUrl}
                </a>
              </p>
            )}
          </div>
        </section>

        <AttendeeDetailsForm
          profile={profile}
          authEmail={authEmail}
          onSaveProfile={onSaveProfile}
          profileSaving={profileSaving}
          quoteEmail={portal.quoteRequestEmail}
        />
      </main>
    </div>
  );
}

function InfoCard({ icon, title, body, accent = "bg-slate-100 text-slate-600" }) {
  const Glyph = icon;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 flex gap-3 sm:flex-col sm:gap-3 shadow-sm">
      <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${accent}`}>
        <Glyph size={20} aria-hidden />
      </div>
      <div className="min-w-0">
        <h3 className="font-semibold text-slate-900 text-sm sm:text-base">{title}</h3>
        <p className="text-slate-600 mt-1 text-sm leading-relaxed">{body}</p>
      </div>
    </div>
  );
}
