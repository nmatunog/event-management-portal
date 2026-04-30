import { Link } from "react-router-dom";
import { Calendar, ChevronDown, ClipboardCheck, Film, ImageIcon, MapPin, Sparkles } from "lucide-react";
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
  const firstName = typeof profile?.firstName === "string" ? profile.firstName.trim() : "";

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
        <section
          aria-labelledby="welcome-heading"
          className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-red-200/50 bg-gradient-to-br from-rose-50/95 via-white to-amber-50/70 p-5 sm:p-8 md:p-10 shadow-[0_20px_50px_-25px_rgba(185,28,28,0.25)]"
        >
          <div className="pointer-events-none absolute -top-28 -right-20 h-56 w-56 rounded-full bg-gradient-to-br from-red-400/20 to-fuchsia-400/15 blur-3xl" aria-hidden />
          <div className="pointer-events-none absolute -bottom-24 -left-16 h-48 w-48 rounded-full bg-gradient-to-tr from-amber-300/25 to-orange-200/20 blur-3xl" aria-hidden />
          <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[120%] w-[120%] opacity-[0.07] bg-[radial-gradient(circle_at_center,_#dc2626_0%,_transparent_55%)]" aria-hidden />

          <div className="relative flex flex-col gap-6 sm:gap-8">
            <div className="flex flex-col sm:flex-row sm:items-start gap-5">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-red-600 to-rose-600 text-white shadow-lg shadow-red-600/30 ring-4 ring-white/80">
                <Sparkles className="h-7 w-7" strokeWidth={2} aria-hidden />
              </div>
              <div className="min-w-0 flex-1 space-y-3">
                <p className="text-[11px] sm:text-xs font-bold uppercase tracking-[0.14em] text-red-700 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-2.5 py-1 text-[10px] sm:text-[11px] font-semibold tracking-wide text-red-800 shadow-sm ring-1 ring-red-100">
                    <span className="relative flex h-2 w-2" aria-hidden>
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                    </span>
                    Live · Your attendee hub
                  </span>
                </p>
                <h2 id="welcome-heading" className="text-2xl sm:text-3xl md:text-[2rem] font-bold text-slate-900 leading-[1.15] tracking-tight">
                  {firstName ? (
                    <>
                      <span className="block text-red-700">{firstName}, you made it!</span>
                      <span className="mt-1 block text-slate-900 font-extrabold">Welcome to the heart of {title}</span>
                    </>
                  ) : (
                    <>
                      <span className="block text-red-700">Welcome in!</span>
                      <span className="mt-1 block text-slate-900 font-extrabold">So glad you&apos;re joining {title}</span>
                    </>
                  )}
                </h2>
                <p className="text-sm sm:text-base text-slate-700 leading-relaxed max-w-2xl">
                  Dive into the posters, feel the buzz in the welcome video, then tell us how you&apos;re traveling — shirt size, Cebu dates, and any extra-day tours you&apos;re dreaming about.
                  Every detail you share helps the team welcome you with open arms (and the right-sized tee).
                </p>
              </div>
            </div>

            <div className="relative grid grid-cols-1 sm:grid-cols-3 gap-3">
              <a
                href="#posters-heading"
                className="group flex gap-3 rounded-2xl border border-white/70 bg-white/75 backdrop-blur-sm p-4 shadow-sm ring-1 ring-slate-200/60 transition-all duration-200 hover:-translate-y-0.5 hover:bg-white hover:shadow-md hover:ring-red-200/80 hover:border-red-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-100 to-slate-50 text-slate-700 ring-1 ring-slate-200/80 group-hover:from-red-50 group-hover:to-rose-50 group-hover:text-red-700 group-hover:ring-red-200/60 transition-colors">
                  <ImageIcon className="h-5 w-5" strokeWidth={2} aria-hidden />
                </span>
                <span className="min-w-0 text-left">
                  <span className="block text-[11px] font-bold uppercase tracking-wide text-red-600/90">Step 1</span>
                  <span className="mt-0.5 block text-sm font-bold text-slate-900 group-hover:text-red-900 transition-colors">Soak up the posters</span>
                  <span className="mt-1 block text-xs text-slate-600 leading-snug">Tap to expand and preview every graphic.</span>
                </span>
              </a>
              <a
                href="#video-heading"
                className="group flex gap-3 rounded-2xl border border-white/70 bg-white/75 backdrop-blur-sm p-4 shadow-sm ring-1 ring-slate-200/60 transition-all duration-200 hover:-translate-y-0.5 hover:bg-white hover:shadow-md hover:ring-red-200/80 hover:border-red-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-100 to-slate-50 text-slate-700 ring-1 ring-slate-200/80 group-hover:from-red-50 group-hover:to-rose-50 group-hover:text-red-700 group-hover:ring-red-200/60 transition-colors">
                  <Film className="h-5 w-5" strokeWidth={2} aria-hidden />
                </span>
                <span className="min-w-0 text-left">
                  <span className="block text-[11px] font-bold uppercase tracking-wide text-red-600/90">Step 2</span>
                  <span className="mt-0.5 block text-sm font-bold text-slate-900 group-hover:text-red-900 transition-colors">Feel the energy</span>
                  <span className="mt-1 block text-xs text-slate-600 leading-snug">Hit play on the welcome video — quick, lively, and worth it.</span>
                </span>
              </a>
              <a
                href="#attendee-details"
                className="group flex gap-3 rounded-2xl border border-red-300/70 bg-gradient-to-br from-red-50 via-white to-rose-50/90 p-4 shadow-md shadow-red-600/10 ring-2 ring-red-200/70 transition-all duration-200 hover:-translate-y-0.5 hover:ring-red-400/80 hover:shadow-lg hover:shadow-red-600/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-red-600 to-rose-600 text-white shadow-md shadow-red-600/25">
                  <ClipboardCheck className="h-5 w-5" strokeWidth={2} aria-hidden />
                </span>
                <span className="min-w-0 text-left">
                  <span className="block text-[11px] font-bold uppercase tracking-wide text-red-700">Step 3 · Main event</span>
                  <span className="mt-0.5 block text-sm font-bold text-red-950">Complete your details</span>
                  <span className="mt-1 block text-xs text-red-950/75 leading-snug">Travel, shirt, extras — lock it in so we can roll out the red carpet.</span>
                </span>
              </a>
            </div>
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
