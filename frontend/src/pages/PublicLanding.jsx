import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Calendar, MapPin, Sparkles } from "lucide-react";
import { getEvents } from "../lib/api";
import { PAMACON_TITLE } from "../pamacon/defaultConfig";

/**
 * Public marketing page — layout, palette, and type pegged to PAMACON 2026 print posters:
 * Montserrat-style sans for UI and headlines, magenta “PAMACON”, gold metallic year & subheads,
 * royal blue accents, red pill CTA; white base with sunburst and poster art as reference.
 */
export default function PublicLanding() {
  const [heroEvent, setHeroEvent] = useState(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { items } = await getEvents();
        if (cancelled) return;
        const pinned = import.meta.env.VITE_PAMACON_EVENT_ID;
        let ev = (items || []).find((x) => String(x.title || "").includes("PAMACON"));
        if (pinned) ev = (items || []).find((x) => x.id === pinned) || ev;
        setHeroEvent(ev || (items && items[0]) || null);
      } catch {
        if (!cancelled) setLoadError("Live schedule will load when the API is available.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const title = heroEvent?.title || PAMACON_TITLE;
  const venue = heroEvent?.venue || "Cebu";
  const start = heroEvent?.start_date || "2026-05-13";
  const end = heroEvent?.end_date || "2026-05-15";
  const dateLabel = formatDateRange(start, end);

  return (
    <div className="public-landing relative min-h-[100dvh] text-zinc-900 overflow-x-hidden bg-zinc-100">
      <div className="landing-sunburst -z-10" aria-hidden />
      <div className="absolute inset-0 -z-20 bg-[linear-gradient(180deg,#fafafa_0%,#f4f4f5_45%,#ececee_100%)]" aria-hidden />

      {/* Top bar — poster header: white strip, logos, efficient nav */}
      <header className="sticky top-0 z-30 border-b border-zinc-200/90 bg-white/95 backdrop-blur-md shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 py-4 flex flex-wrap items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-3 min-w-0 group">
            <div className="w-11 h-11 rounded-xl bg-white border border-zinc-200 flex items-center justify-center shadow-sm shrink-0">
              <img src="/branding/pama-symbol.png" alt="" className="w-8 h-8 object-contain" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#1d4ed8]">AIA · AIA PAMA</p>
              <p className="text-sm font-bold text-zinc-800 tracking-tight truncate">{title}</p>
            </div>
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/sign-in"
              className="inline-flex items-center justify-center min-h-[44px] rounded-full px-5 py-2.5 text-xs font-black uppercase tracking-wide text-zinc-700 bg-white border-2 border-zinc-200 hover:border-[#e11d74] hover:text-[#be185d] transition-colors"
            >
              Sign in
            </Link>
            <Link
              to="/sign-in"
              className="inline-flex items-center justify-center gap-2 min-h-[44px] rounded-full px-6 py-2.5 text-xs font-black uppercase tracking-wide text-white bg-[#dc2626] shadow-md hover:bg-[#b91c1c] transition-colors"
            >
              Book your seat
              <ArrowRight size={16} strokeWidth={2.5} aria-hidden />
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-8 pb-20">
        {/* Hero — white-poster peg: magenta title, gold year, gold subline, CTA; Sulog poster as visual */}
        <section className="pt-10 sm:pt-14 lg:pt-16 grid lg:grid-cols-[1fr_min(42%,380px)] gap-10 lg:gap-12 items-center">
          <div className="order-2 lg:order-1 space-y-6">
            <p className="text-[#1d4ed8] font-extrabold text-xs sm:text-sm uppercase tracking-[0.2em]">
              Sulog · Rise with the current
            </p>

            <div className="space-y-1">
              <h1 className="text-[clamp(2.75rem,8vw,5.5rem)] font-black italic leading-[0.92] tracking-tight text-[#e11d74] drop-shadow-sm [text-shadow:0_1px_0_rgba(255,255,255,0.4)]">
                PAMACON
              </h1>
              <p className="font-year text-[clamp(4rem,14vw,9rem)] leading-none font-normal tracking-tight text-gold-gradient select-none" aria-hidden="true">
                2026
              </p>
              <p className="pt-2 text-xl sm:text-2xl md:text-3xl font-extrabold uppercase tracking-[0.12em] text-gold-gradient-soft">In Cebu</p>
              <p className="text-lg sm:text-xl font-bold uppercase tracking-widest text-gold-gradient-soft">{dateLabel}</p>
            </div>

            <p className="text-zinc-600 text-base sm:text-lg leading-relaxed max-w-xl font-medium">
              Register, plan your stay, and step into the delegate portal — same sign-in for participants and the committee workspace.
            </p>

            <div className="flex flex-col sm:flex-row flex-wrap gap-3 pt-2">
              <Link
                to="/sign-in"
                className="inline-flex items-center justify-center gap-2 min-h-[52px] rounded-full px-8 py-3.5 text-sm font-black uppercase tracking-wide text-white bg-[#dc2626] shadow-lg hover:bg-[#b91c1c] active:scale-[0.99] transition-transform"
              >
                Book your seats today
                <ArrowRight size={18} strokeWidth={2.5} aria-hidden />
              </Link>
              <a
                href="#rates"
                className="inline-flex items-center justify-center min-h-[52px] rounded-full px-7 py-3.5 text-sm font-bold uppercase tracking-wide text-[#be185d] border-2 border-[#e11d74]/80 bg-white hover:bg-rose-50/80 transition-colors"
              >
                Rates & info
              </a>
            </div>
            {loadError && <p className="text-sm text-amber-800 font-semibold bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 max-w-xl">{loadError}</p>}
          </div>

          <div className="order-1 lg:order-2 flex justify-center lg:justify-end">
            <figure className="relative w-full max-w-[380px]">
              <div className="absolute -inset-3 rounded-[2rem] bg-gradient-to-br from-[#1d4ed8]/15 via-[#e11d74]/10 to-amber-400/25 blur-2xl" aria-hidden />
              <img
                src="/landing/poster-sulog-cebu.png"
                alt="PAMACON 2026 in Cebu — Sulog: Rise with the Current event poster"
                className="relative w-full rounded-3xl border border-white shadow-2xl shadow-zinc-900/15 ring-1 ring-black/5 object-cover"
                loading="eager"
                decoding="async"
              />
              <figcaption className="mt-3 text-center text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Official look · Sinulog-inspired palette
              </figcaption>
            </figure>
          </div>
        </section>

        {/* Quick facts — white rounded cards like speaker labels on poster */}
        <section className="mt-14 sm:mt-20 grid sm:grid-cols-3 gap-4">
          <article className="rounded-2xl bg-white border border-zinc-200/90 p-5 shadow-md shadow-zinc-900/5">
            <div className="w-10 h-10 rounded-xl bg-[#1d4ed8]/10 text-[#1d4ed8] flex items-center justify-center mb-3">
              <Calendar size={20} strokeWidth={2} />
            </div>
            <h2 className="font-extrabold text-zinc-900 text-sm uppercase tracking-wide">Dates</h2>
            <p className="mt-2 text-zinc-600 text-sm font-medium leading-relaxed">
              {start} → {end}
            </p>
          </article>
          <article className="rounded-2xl bg-white border border-zinc-200/90 p-5 shadow-md shadow-zinc-900/5">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center mb-3">
              <MapPin size={20} strokeWidth={2} />
            </div>
            <h2 className="font-extrabold text-zinc-900 text-sm uppercase tracking-wide">Venue</h2>
            <p className="mt-2 text-zinc-600 text-sm font-medium leading-relaxed">{venue}</p>
          </article>
          <article className="rounded-2xl bg-white border border-zinc-200/90 p-5 shadow-md shadow-zinc-900/5">
            <div className="w-10 h-10 rounded-xl bg-[#e11d74]/10 text-[#be185d] flex items-center justify-center mb-3">
              <Sparkles size={20} strokeWidth={2} />
            </div>
            <h2 className="font-extrabold text-zinc-900 text-sm uppercase tracking-wide">Portal</h2>
            <p className="mt-2 text-zinc-600 text-sm font-medium leading-relaxed">Delegates and working team — tailored screens after you sign in.</p>
          </article>
        </section>

        <section className="mt-8 rounded-3xl border border-amber-200 bg-amber-50/70 p-6 sm:p-8 shadow-md shadow-amber-900/5">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-amber-800">Already in the seeded delegate list?</p>
              <h3 className="mt-1 text-xl font-bold text-zinc-900">Claim your seeded account in 3 easy steps</h3>
              <ol className="mt-3 text-sm text-zinc-700 space-y-1">
                <li>1) Sign in using your preferred email.</li>
                <li>2) Fill out your attendee details (name, travel dates, shirt size).</li>
                <li>3) Committee staff confirms and tags your seeded profile.</li>
              </ol>
            </div>
            <Link
              to="/sign-in#claim-seeded"
              className="inline-flex items-center justify-center gap-2 min-h-[46px] rounded-full px-6 py-2.5 text-xs font-black uppercase tracking-wide text-white bg-[#b91c1c] hover:bg-[#991b1b] transition-colors shadow-sm"
            >
              Start claim process
              <ArrowRight size={15} aria-hidden />
            </Link>
          </div>
        </section>

        {/* Two-column peg — early bird vs regular (placeholders; replace with live copy from committee) */}
        <section id="rates" className="mt-14 sm:mt-16 scroll-mt-28 grid md:grid-cols-2 gap-5">
          <div className="rounded-3xl bg-white border border-zinc-200 p-6 sm:p-8 shadow-lg shadow-zinc-900/5">
            <h3 className="text-[#b91c1c] font-black text-xs uppercase tracking-[0.2em] mb-2">Early bird rate</h3>
            <p className="text-zinc-800 font-bold text-lg leading-snug">Publish your confirmed tiers in event setup — this block mirrors the poster layout.</p>
            <p className="mt-3 text-zinc-600 text-sm leading-relaxed">Use the admin portal to keep fees aligned with printed materials.</p>
          </div>
          <div className="rounded-3xl bg-white border border-zinc-200 p-6 sm:p-8 shadow-lg shadow-zinc-900/5">
            <h3 className="text-zinc-900 font-black text-xs uppercase tracking-[0.2em] mb-2">Regular conference fee</h3>
            <p className="text-zinc-800 font-bold text-lg leading-snug">Bank &amp; e-wallet lines stay on your official poster — link or PDF from the committee site if needed.</p>
            <p className="mt-3 text-zinc-600 text-sm leading-relaxed">PAMA accounts (BPI / GCash) should match finance-approved wording.</p>
          </div>
        </section>

        {/* Alternate poster — clean white + gold + magenta reference */}
        <section className="mt-14 sm:mt-16 rounded-3xl bg-white border border-zinc-200 overflow-hidden shadow-xl shadow-zinc-900/8">
          <div className="grid md:grid-cols-2 gap-0">
            <div className="p-6 sm:p-10 flex flex-col justify-center space-y-4 bg-gradient-to-br from-white to-zinc-50">
              <p className="text-[#1d4ed8] font-extrabold text-xs uppercase tracking-[0.2em]">Alternate layout peg</p>
              <h2 className="text-2xl sm:text-3xl font-black text-zinc-900 leading-tight">White field, gold type, magenta hero</h2>
              <p className="text-zinc-600 leading-relaxed text-sm sm:text-base font-medium">
                The second reference poster uses a bright white base, metallic gold for the year and dates, and condensed magenta for the wordmark — mirrored here in the hero
                typography above.
              </p>
              <Link
                to="/sign-in"
                className="inline-flex w-fit items-center gap-2 rounded-full bg-[#e11d74] text-white font-black uppercase text-xs tracking-wide px-6 py-3 hover:bg-[#be185d] transition-colors"
              >
                Enter portal
                <ArrowRight size={16} aria-hidden />
              </Link>
            </div>
            <div className="relative min-h-[220px] md:min-h-[320px] bg-zinc-100">
              <img
                src="/landing/poster-pamacon-white.png"
                alt="PAMACON in Cebu 2026 — alternate minimalist poster"
                className="absolute inset-0 w-full h-full object-cover object-top"
                loading="lazy"
                decoding="async"
              />
            </div>
          </div>
        </section>
      </main>

      <footer className="max-w-6xl mx-auto px-4 sm:px-8 py-10 text-center text-zinc-500 text-xs font-medium leading-relaxed border-t border-zinc-200/80 bg-white/80">
        Theme peg: royal blue <span className="text-[#1d4ed8]">■</span> magenta <span className="text-[#e11d74]">■</span> gold{" "}
        <span className="text-amber-600">■</span> red CTA <span className="text-[#dc2626]">■</span> · Montserrat + DM Serif Display · Posters in{" "}
        <code className="text-[11px] text-zinc-600">/public/landing/</code>
      </footer>
    </div>
  );
}

function formatDateRange(startIso, endIso) {
  if (!startIso && !endIso) return "";
  const a = startIso ? new Date(`${startIso}T12:00:00`) : null;
  const b = endIso ? new Date(`${endIso}T12:00:00`) : null;
  if (a && b && !Number.isNaN(a.getTime()) && !Number.isNaN(b.getTime())) {
    const y = a.getFullYear();
    if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()) {
      return `${a.toLocaleDateString("en-PH", { month: "long", day: "numeric" })}–${b.getDate()}, ${y}`;
    }
    return `${a.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })} – ${b.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}`;
  }
  if (a && !Number.isNaN(a.getTime())) return a.toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" });
  return String(startIso || endIso);
}
