import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Calendar, MapPin, Sparkles } from "lucide-react";
import { getEvents } from "../lib/api";
import { DEFAULT_ATTENDEE_PORTAL, PAMACON_TITLE } from "../pamacon/defaultConfig";

/**
 * Public marketing page — layout, palette, and type pegged to PAMACON 2026 print posters:
 * Montserrat-style sans for UI and headlines, magenta “PAMACON”, gold metallic year & subheads,
 * royal blue accents, red pill CTA; white base with sunburst and poster art as reference.
 */
export default function PublicLanding() {
  const [heroEvent, setHeroEvent] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [copiedField, setCopiedField] = useState("");
  const [copyToast, setCopyToast] = useState("");
  const [posterIdx, setPosterIdx] = useState(0);

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
  const eventPosterSlides = getPosterSlidesFromEvent(heroEvent);
  const activePoster = eventPosterSlides[posterIdx] || eventPosterSlides[0] || null;

  useEffect(() => {
    setPosterIdx(0);
  }, [eventPosterSlides.length]);

  useEffect(() => {
    if (eventPosterSlides.length <= 1) return undefined;
    const timer = window.setInterval(() => {
      setPosterIdx((i) => (i + 1) % eventPosterSlides.length);
    }, 3800);
    return () => window.clearInterval(timer);
  }, [eventPosterSlides.length]);
  const copyValue = async (label, value) => {
    try {
      await navigator.clipboard.writeText(String(value));
      setCopiedField(label);
      setCopyToast(label === "bpi" ? "BPI account number copied" : "GCash number copied");
      window.setTimeout(() => setCopiedField(""), 1500);
      window.setTimeout(() => setCopyToast(""), 1700);
    } catch {
      setCopyToast("Unable to copy on this browser");
      window.setTimeout(() => setCopyToast(""), 1700);
    }
  };

  return (
    <div className="public-landing relative min-h-[100dvh] text-zinc-900 overflow-x-hidden bg-zinc-100">
      <div className="landing-sunburst -z-10" aria-hidden />
      <div className="absolute inset-0 -z-20 bg-[linear-gradient(180deg,#fafafa_0%,#f4f4f5_45%,#ececee_100%)]" aria-hidden />
      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-center bg-cover opacity-[0.20]"
        style={{ backgroundImage: "url('/landing/photowall-light.png')" }}
        aria-hidden
      />

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
        <section className="mt-6 sm:mt-8 rounded-3xl border border-amber-200 bg-amber-50/70 p-6 sm:p-8 shadow-md shadow-amber-900/5">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-amber-800">Paid for your slot already?</p>
              <h3 className="mt-1 text-xl font-bold text-zinc-900">Confirm your booking and enter your details</h3>
              <ol className="mt-3 text-sm text-zinc-700 space-y-1">
                <li>1) Type your family name and select your first name or nickname from the list.</li>
                <li>2) Fill out your attendee details.</li>
                <li>3) Enter your preferred email, mobile number, and create your password for next logins.</li>
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

        {/* Hero — white-poster peg: magenta title, gold year, gold subline, CTA; Sulog poster as visual */}
        <section className="pt-10 sm:pt-14 lg:pt-16 grid lg:grid-cols-[1fr_min(48%,460px)] gap-10 lg:gap-12 items-center">
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
            <figure className="relative w-full max-w-[460px]">
              <div className="absolute -inset-3 rounded-[2rem] bg-gradient-to-br from-[#1d4ed8]/15 via-[#e11d74]/10 to-amber-400/25 blur-2xl" aria-hidden />
              <div className="relative overflow-hidden rounded-3xl border border-white shadow-2xl shadow-zinc-900/15 ring-1 ring-black/5 bg-zinc-50 aspect-[3/4]">
                {activePoster?.url ? (
                  <img
                    src={activePoster.url}
                    alt={activePoster.title || "Event poster"}
                    className="absolute inset-0 h-full w-full object-cover"
                    loading="eager"
                    decoding="async"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-zinc-500">
                    No poster uploaded yet
                  </div>
                )}
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-xs text-zinc-500">
                  {eventPosterSlides.length > 0 ? `Slide ${posterIdx + 1} of ${eventPosterSlides.length}` : "No slides configured"}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={eventPosterSlides.length <= 1}
                    onClick={() => setPosterIdx((i) => (i - 1 + eventPosterSlides.length) % eventPosterSlides.length)}
                    className="rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-zinc-700 hover:bg-zinc-50 disabled:opacity-40"
                  >
                    Prev
                  </button>
                  <button
                    type="button"
                    disabled={eventPosterSlides.length <= 1}
                    onClick={() => setPosterIdx((i) => (i + 1) % eventPosterSlides.length)}
                    className="rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-zinc-700 hover:bg-zinc-50 disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {eventPosterSlides.map((slide, idx) => (
                  <button
                    key={`${slide.url}-${idx}`}
                    type="button"
                    onClick={() => setPosterIdx(idx)}
                    className={`h-2.5 w-8 rounded-full transition-colors ${
                      idx === posterIdx ? "bg-[#e11d74]" : "bg-zinc-300 hover:bg-zinc-400"
                    }`}
                    aria-label={`Show poster ${idx + 1}`}
                    title={slide.title || `Poster ${idx + 1}`}
                  />
                ))}
              </div>
            </figure>
          </div>
        </section>

        {/* Quick facts — richer hierarchy and stronger CTA affordance */}
        <section className="mt-14 sm:mt-20 grid sm:grid-cols-3 gap-4">
          <article className="rounded-2xl bg-white border border-zinc-200/90 p-5 shadow-md shadow-zinc-900/5 hover:shadow-lg transition-shadow">
            <div className="w-11 h-11 rounded-xl bg-[#1d4ed8]/10 text-[#1d4ed8] flex items-center justify-center mb-3">
              <Calendar size={20} strokeWidth={2.2} />
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">Save the date</p>
            <h2 className="mt-1 font-extrabold text-zinc-900 text-sm uppercase tracking-wide">Dates</h2>
            <p className="mt-2 text-zinc-700 text-base font-bold leading-relaxed">{dateLabel}</p>
            <p className="mt-1 text-zinc-500 text-xs font-medium">Conference window for delegates and working team.</p>
          </article>
          <article className="rounded-2xl bg-white border border-zinc-200/90 p-5 shadow-md shadow-zinc-900/5 hover:shadow-lg transition-shadow">
            <div className="w-11 h-11 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center mb-3">
              <MapPin size={20} strokeWidth={2.2} />
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">Host property</p>
            <h2 className="mt-1 font-extrabold text-zinc-900 text-sm uppercase tracking-wide">Venue</h2>
            <p className="mt-2 text-zinc-700 text-sm font-semibold leading-relaxed">{venue}</p>
            <a
              href={`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(`${venue} photos`)}`}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center text-xs font-bold text-[#b91c1c] hover:text-[#991b1b] hover:underline"
            >
              View property photos
            </a>
          </article>
          <article className="rounded-2xl bg-white border border-zinc-200/90 p-5 shadow-md shadow-zinc-900/5 hover:shadow-lg transition-shadow">
            <div className="w-11 h-11 rounded-xl bg-[#e11d74]/10 text-[#be185d] flex items-center justify-center mb-3">
              <Sparkles size={20} strokeWidth={2.2} />
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">After sign-in</p>
            <h2 className="mt-1 font-extrabold text-zinc-900 text-sm uppercase tracking-wide">Portal</h2>
            <p className="mt-2 text-zinc-600 text-sm font-medium leading-relaxed">Delegates and working team get tailored screens for details, logistics, and claims.</p>
            <Link to="/sign-in" className="mt-2 inline-flex items-center text-xs font-bold text-[#e11d74] hover:text-[#be185d] hover:underline">
              Open sign-in
            </Link>
          </article>
        </section>

        {/* Rates + payment details */}
        <section id="rates" className="mt-14 sm:mt-16 scroll-mt-28 grid md:grid-cols-2 gap-5">
          <div className="rounded-3xl bg-white border border-zinc-200 p-6 sm:p-8 shadow-lg shadow-zinc-900/5">
            <h3 className="text-[#b91c1c] font-black text-xs uppercase tracking-[0.2em] mb-2">Discounted conference rates</h3>
            <p className="text-zinc-800 font-bold text-lg leading-snug">Current subsidized conference pricing</p>
            <ul className="mt-3 space-y-1 text-sm text-zinc-700 font-semibold">
              <li>PHP 8,500 - SUM / UM</li>
              <li>PHP 10,500 - AD / DD</li>
            </ul>
            <h4 className="mt-5 text-[#1f2937] font-black text-xs uppercase tracking-[0.18em]">Extra subsidized offer</h4>
            <ul className="mt-2 space-y-1 text-sm text-zinc-700 font-semibold">
              <li>3 monthly installments: PHP 2,850/mo - SUM / UM</li>
              <li>3 monthly installments: PHP 3,500/mo - AD / DD</li>
            </ul>
          </div>
          <div className="rounded-3xl bg-white border border-zinc-200 p-6 sm:p-8 shadow-lg shadow-zinc-900/5">
            <h3 className="text-zinc-900 font-black text-xs uppercase tracking-[0.2em] mb-2">PAMA accounts</h3>
            <div className="space-y-4 text-sm text-zinc-700">
              <div>
                <p className="font-bold uppercase tracking-wide text-zinc-900">BPI</p>
                <p className="font-semibold">Philam Life Agency Managers Association</p>
                <div className="mt-1 flex items-center gap-2">
                  <p className="font-mono font-bold text-zinc-900">1681001545</p>
                  <button
                    type="button"
                    onClick={() => copyValue("bpi", "1681001545")}
                    className="rounded-lg border border-zinc-200 px-2 py-1 text-[11px] font-bold text-zinc-700 hover:bg-zinc-50"
                  >
                    {copiedField === "bpi" ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>
              <div>
                <p className="font-bold uppercase tracking-wide text-zinc-900">GCash</p>
                <p className="font-semibold">RE*E ED****O J** D.</p>
                <div className="mt-1 flex items-center gap-2">
                  <p className="font-mono font-bold text-zinc-900">0915 423 3799</p>
                  <button
                    type="button"
                    onClick={() => copyValue("gcash", "09154233799")}
                    className="rounded-lg border border-zinc-200 px-2 py-1 text-[11px] font-bold text-zinc-700 hover:bg-zinc-50"
                  >
                    {copiedField === "gcash" ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>
            </div>
            <p className="mt-4 text-xs text-zinc-500">
              Verify account details with the finance team before sending payment. After payment, screenshot your confirmation and upload it in the attendee portal
              (“Payment proof screenshot” section) so staff can validate your payment.
            </p>
          </div>
        </section>

        {/* Alternate poster — clean white + gold + magenta reference */}
        <section className="mt-14 sm:mt-16 rounded-3xl bg-white border border-zinc-200 overflow-hidden shadow-xl shadow-zinc-900/8">
          <div className="grid md:grid-cols-2 gap-0">
            <div className="p-6 sm:p-10 flex flex-col justify-center space-y-4 bg-gradient-to-br from-white to-zinc-50">
              <p className="text-[#1d4ed8] font-extrabold text-xs uppercase tracking-[0.2em]">Your 2026 momentum starts here</p>
              <h2 className="text-2xl sm:text-3xl font-black text-zinc-900 leading-tight">Step into Cebu with your PAMA community and rise together</h2>
              <p className="text-zinc-600 leading-relaxed text-sm sm:text-base font-medium">
                Be in the room where insights, leadership conversations, and meaningful connections happen. Confirm your slot, complete your profile, and get event-ready in minutes.
              </p>
              <div className="space-y-1.5 text-xs sm:text-sm font-semibold text-zinc-700">
                <p>Fast 3-step booking confirmation</p>
                <p>Delegate profile and travel details in one place</p>
                <p>Access your attendee portal right after sign-in</p>
              </div>
              <div className="flex flex-wrap gap-3 pt-1">
                <Link
                  to="/sign-in#claim-seeded"
                  className="inline-flex w-fit items-center gap-2 rounded-full bg-[#e11d74] text-white font-black uppercase text-xs tracking-wide px-6 py-3 hover:bg-[#be185d] transition-colors"
                >
                  Confirm booking
                  <ArrowRight size={16} aria-hidden />
                </Link>
                <Link
                  to="/sign-in"
                  className="inline-flex w-fit items-center rounded-full border-2 border-[#e11d74]/70 bg-white px-6 py-3 text-xs font-black uppercase tracking-wide text-[#be185d] hover:bg-rose-50 transition-colors"
                >
                  Sign in
                </Link>
              </div>
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

      {copyToast ? (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-zinc-900/95 px-4 py-2 text-xs font-semibold text-white shadow-xl">
          {copyToast}
        </div>
      ) : null}
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

function getPosterSlidesFromEvent(eventRow) {
  const fallback = DEFAULT_ATTENDEE_PORTAL.posterImageUrls
    .filter((url) => String(url || "").trim())
    .map((url, idx) => ({ url: String(url), title: `Event Poster ${idx + 1}` }));
  if (!eventRow?.config_json) return fallback;
  try {
    const parsed = JSON.parse(eventRow.config_json);
    const raw = Array.isArray(parsed?.attendeePortal?.posterImageUrls) ? parsed.attendeePortal.posterImageUrls : [];
    const cleaned = raw
      .map((url) => String(url || "").trim())
      .filter(Boolean)
      .map((url, idx) => ({ url, title: `Event Poster ${idx + 1}` }));
    return cleaned.length > 0 ? cleaned : fallback;
  } catch {
    return fallback;
  }
}
