import { Link } from "react-router-dom";
import { Award, Calendar, Camera, ChevronDown, ClipboardCheck, ClipboardList, Clock3, Film, ImageIcon, LogOut, MapPin, Music, Presentation, Sparkles, Star, User, Utensils } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getEventMedia, getSpeakerMaterials } from "../lib/api";
import EventMediaAccessButton from "./EventMediaAccessButton";
import { ATTENDEE_POSTER_MAX, DEFAULT_PAMACON_CONFIG, DEFAULT_ATTENDEE_PORTAL, PAMACON_TITLE } from "./defaultConfig";
import AttendeeDetailsForm from "./AttendeeDetailsForm";
import ProgramPresentationButtons from "./ProgramPresentationButtons";
import { normalizeProgramModuleRow } from "./programPresentation";
import SpeakerMaterialsSection from "./SpeakerMaterialsSection";
import { POST_EVENT_ATTENDEE_PORTAL, SHOW_CEBU_TOUR_ACTIVITIES } from "./attendeePortalFlags";

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

function isRockOfAgesFellowship(item) {
  const assigned = String(item?.assigned || "").trim().toLowerCase();
  const program = String(item?.program || "").trim().toLowerCase();
  return assigned.includes("rock of ages") || program.includes("fellowship");
}

/**
 * Participant-facing portal: marketing placeholders, promo video, and travel / shirt / tour form.
 * Layout is tuned for phones, tablets, and desktop (fluid max-width, touch-friendly controls).
 */
export default function ParticipantPortal({
  config = DEFAULT_PAMACON_CONFIG,
  eventRow,
  eventId,
  attendeeSyncHints = {},
  authEmail,
  profile,
  onSaveProfile,
  profileSaving,
  onLogout,
  onApiInfo,
  onApiError,
}) {
  const title = eventRow?.title || PAMACON_TITLE;
  const theme = config?.theme || DEFAULT_PAMACON_CONFIG.theme;
  const venue = eventRow?.venue || "Waterfront Cebu Hotel and Casino";
  const start = eventRow?.start_date || "2026-05-13";
  const end = eventRow?.end_date || "2026-05-15";
  const portal = { ...DEFAULT_ATTENDEE_PORTAL, ...(config?.attendeePortal || {}) };
  const requestedPosterCount = Number(portal.posterDisplayCount);
  const posterCount = Number.isFinite(requestedPosterCount) ? Math.max(1, Math.min(ATTENDEE_POSTER_MAX, Math.trunc(requestedPosterCount))) : 3;
  const posterSlots = [...(portal.posterImageUrls || []), "", "", "", "", "", "", "", "", "", "", "", ""].slice(0, posterCount);
  const youtubeUrl =
    String(portal.youtubeUrl || "").trim() || String(import.meta.env.VITE_ATTENDEE_YOUTUBE_URL || "").trim();
  const embedSrc = youtubeEmbedSrc(youtubeUrl);
  const firstName = typeof profile?.firstName === "string" ? profile.firstName.trim() : "";
  const [speakerMaterialsState, setSpeakerMaterialsState] = useState({
    loading: true,
    hasMaterials: false,
    hasAccess: false,
    evaluationComplete: false,
    presentationUnlocked: false,
    items: [],
    registrationName: "",
    lockMessage: "",
  });
  const [eventMediaState, setEventMediaState] = useState({
    loading: true,
    configured: false,
    hasAccess: false,
    url: "",
    label: "",
    lockMessage: "",
  });

  const mediaMatchParams = useMemo(
    () => ({
      firstName: profile?.firstName,
      lastName: profile?.lastName,
      nickname: profile?.nickname,
      seededRegistrationId: attendeeSyncHints?.seededRegistrationId,
      seededDelegateName: attendeeSyncHints?.seededDelegateName,
    }),
    [profile, attendeeSyncHints]
  );

  const loadSpeakerMaterials = useCallback(async () => {
    if (!eventId || !authEmail) {
      setSpeakerMaterialsState({
        loading: false,
        hasMaterials: false,
        hasAccess: false,
        evaluationComplete: false,
        presentationUnlocked: false,
        items: [],
        registrationName: "",
        lockMessage: "",
      });
      return;
    }
    setSpeakerMaterialsState((prev) => ({ ...prev, loading: true }));
    try {
      const data = await getSpeakerMaterials(eventId, mediaMatchParams);
      setSpeakerMaterialsState({
        loading: false,
        hasMaterials: Boolean(data?.hasMaterials),
        hasAccess: Boolean(data?.hasAccess),
        evaluationComplete: Boolean(data?.evaluationComplete),
        presentationUnlocked: Boolean(data?.presentationUnlocked),
        items: Array.isArray(data?.items) ? data.items : [],
        registrationName: String(data?.registrationName || "").trim(),
        lockMessage: String(data?.message || "").trim(),
      });
    } catch (e) {
      onApiError?.(e, "Could not verify access to speaker presentation copies.");
      setSpeakerMaterialsState({
        loading: false,
        hasMaterials: false,
        hasAccess: false,
        evaluationComplete: false,
        presentationUnlocked: false,
        items: [],
        registrationName: "",
        lockMessage: "",
      });
    }
  }, [eventId, authEmail, mediaMatchParams, onApiError]);

  const loadEventMedia = useCallback(async () => {
    if (!eventId || !authEmail) {
      setEventMediaState({
        loading: false,
        configured: false,
        hasAccess: false,
        url: "",
        label: "",
        lockMessage: "",
      });
      return;
    }
    setEventMediaState((prev) => ({ ...prev, loading: true }));
    try {
      const data = await getEventMedia(eventId, mediaMatchParams);
      setEventMediaState({
        loading: false,
        configured: Boolean(data?.configured),
        hasAccess: Boolean(data?.hasAccess),
        url: String(data?.url || "").trim(),
        label: String(data?.label || "").trim(),
        lockMessage: String(data?.message || "").trim(),
      });
    } catch (e) {
      onApiError?.(e, "Could not verify access to event photos and videos.");
      setEventMediaState({
        loading: false,
        configured: false,
        hasAccess: false,
        url: "",
        label: "",
        lockMessage: "",
      });
    }
  }, [eventId, authEmail, mediaMatchParams, onApiError]);

  const reloadPortalAccess = useCallback(() => {
    void loadSpeakerMaterials();
    void loadEventMedia();
  }, [loadSpeakerMaterials, loadEventMedia]);

  useEffect(() => {
    void loadSpeakerMaterials();
    void loadEventMedia();
  }, [loadSpeakerMaterials, loadEventMedia]);

  useEffect(() => {
    const onFocus = () => reloadPortalAccess();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [reloadPortalAccess]);

  const scrollToSpeakerMaterials = () => {
    document.getElementById("speaker-materials")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const dateRangeLabel = formatDateRange(start, end);
  const [showVenueModal, setShowVenueModal] = useState(false);
  const [zoomPoster, setZoomPoster] = useState(null);
  const mapsQuery = useMemo(() => encodeURIComponent(`${venue}, Cebu`), [venue]);
  const mapsEmbedSrc = `https://www.google.com/maps?q=${mapsQuery}&output=embed`;
  const mapsOpenUrl = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;
  const mapsDirectionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${mapsQuery}`;
  const photosSearchUrl = `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(`${venue} photos`)}`;
  const presentationAccess = speakerMaterialsState.presentationUnlocked;
  const evaluationComplete = speakerMaterialsState.evaluationComplete;
  const programHasPresentations = useMemo(() => {
    const rows = Array.isArray(config?.programModules) ? config.programModules : [];
    return rows.some((row) => normalizeProgramModuleRow(row).hasPresentation);
  }, [config?.programModules]);
  const showPresentationHub = POST_EVENT_ATTENDEE_PORTAL
    ? true
    : speakerMaterialsState.hasMaterials || programHasPresentations;
  const showEventMediaHub = eventMediaState.configured || eventMediaState.loading;
  const programRows = useMemo(() => {
    const rows = Array.isArray(config?.programModules) ? config.programModules : [];
    const normalized = rows
      .map((row, idx) => normalizeProgramModuleRow(row, idx))
      .filter((row) => row.day || row.time || row.program || row.assigned);
    const hasWelcomeDinner = normalized.some((row) => String(row.program || "").toLowerCase().includes("welcome dinner"));
    const hasRockFellowship = normalized.some((row) => isRockOfAgesFellowship(row));
    if (!hasWelcomeDinner) {
      normalized.push(
        normalizeProgramModuleRow(
          {
            id: "fallback-welcome-dinner",
            day: "Day 1 - May 13",
            time: "6:00 PM",
            program: "Welcome Dinner",
            assigned: "Arctic Hall",
          },
          normalized.length
        )
      );
    }
    if (!hasRockFellowship) {
      normalized.push(
        normalizeProgramModuleRow(
          {
            id: "fallback-rock-of-ages",
            day: "Day 2 - May 14",
            time: "6:30 PM",
            program: "Fellowship Dinner",
            assigned: "Rock of Ages",
          },
          normalized.length
        )
      );
    }
    return normalized;
  }, [config?.programModules]);
  const groupedProgram = useMemo(() => {
    const order = [];
    const map = new Map();
    for (const row of programRows) {
      if (!map.has(row.day)) {
        map.set(row.day, []);
        order.push(row.day);
      }
      map.get(row.day).push(row);
    }
    return { order, map };
  }, [programRows]);
  const [activeProgramDay, setActiveProgramDay] = useState("");
  useEffect(() => {
    if (!groupedProgram.order.length) {
      setActiveProgramDay("");
      return;
    }
    if (!activeProgramDay || !groupedProgram.map.has(activeProgramDay)) {
      setActiveProgramDay(groupedProgram.order[0]);
    }
  }, [groupedProgram, activeProgramDay]);

  useEffect(() => {
    if (!zoomPoster) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") setZoomPoster(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [zoomPoster]);

  return (
    <div
      className="min-h-[100dvh] bg-gradient-to-b from-slate-50 to-slate-100 text-slate-800 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
      style={{ paddingLeft: "max(0px, env(safe-area-inset-left))", paddingRight: "max(0px, env(safe-area-inset-right))" }}
    >
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur-md shadow-sm">
        <div className={`mx-auto px-4 sm:px-6 py-4 sm:py-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${showPresentationHub ? "max-w-6xl" : "max-w-4xl"}`}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="rounded-2xl bg-white border border-slate-200 flex items-center gap-2 px-3 py-2 shadow-sm shrink-0">
              <img src="/branding/pama-symbol.png" alt="PAMA" className="h-8 w-8 object-contain" />
              <img src="/branding/pama-wordmark.png" alt="AIA PAMA" className="h-6 w-auto max-w-[170px] object-contain" />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <Link
              to="/"
              className="inline-flex items-center justify-center min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 shadow-sm"
            >
              Home
            </Link>
            <Link
              to="/evaluation"
              className="inline-flex items-center justify-center gap-1.5 min-h-[44px] rounded-xl border border-red-200 bg-red-50 px-3.5 py-2 text-sm font-semibold text-red-800 hover:bg-red-100 shadow-sm"
            >
              <ClipboardList size={16} aria-hidden />
              Evaluation survey
            </Link>
            {showEventMediaHub ? (
              <EventMediaAccessButton
                variant="header"
                configured={eventMediaState.configured}
                loading={eventMediaState.loading}
                hasAccess={eventMediaState.hasAccess}
                url={eventMediaState.url}
                label={eventMediaState.label}
                lockMessage={eventMediaState.lockMessage}
              />
            ) : null}
            {showPresentationHub ? (
              <button
                type="button"
                onClick={() => scrollToSpeakerMaterials()}
                className="inline-flex items-center justify-center gap-1.5 min-h-[44px] rounded-xl border border-violet-200 bg-violet-50 px-3.5 py-2 text-sm font-semibold text-violet-900 hover:bg-violet-100 shadow-sm"
              >
                <Presentation size={16} aria-hidden />
                Presentations
              </button>
            ) : null}
            {!POST_EVENT_ATTENDEE_PORTAL ? (
              <a
                href="#attendee-details"
                className="inline-flex items-center justify-center min-h-[44px] rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 shadow-sm"
              >
                Enter your details
              </a>
            ) : null}
            {typeof onLogout === "function" && (
              <button
                type="button"
                onClick={onLogout}
                className="inline-flex items-center justify-center gap-1.5 min-h-[44px] rounded-xl border border-red-200 bg-red-50 px-3.5 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 shadow-sm"
              >
                <LogOut size={16} aria-hidden />
                Logout
              </button>
            )}
            <p className="text-[11px] text-slate-500 truncate max-w-full sm:max-w-[14rem] text-left sm:text-right">{authEmail}</p>
          </div>
        </div>
      </header>

      <main className={`mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-8 sm:space-y-10 ${showPresentationHub ? "max-w-6xl" : "max-w-4xl"}`}>
        <section
          aria-labelledby="welcome-heading"
          className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-red-200/50 bg-gradient-to-br from-rose-50/95 via-white to-amber-50/70 p-5 sm:p-8 md:p-10 shadow-[0_20px_50px_-25px_rgba(185,28,28,0.25)]"
        >
          <div className="pointer-events-none absolute -top-28 -right-20 h-56 w-56 rounded-full bg-gradient-to-br from-red-400/20 to-fuchsia-400/15 blur-3xl" aria-hidden />
          <div className="pointer-events-none absolute -bottom-24 -left-16 h-48 w-48 rounded-full bg-gradient-to-tr from-amber-300/25 to-orange-200/20 blur-3xl" aria-hidden />
          <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[120%] w-[120%] opacity-[0.07] bg-[radial-gradient(circle_at_center,_#dc2626_0%,_transparent_55%)]" aria-hidden />

          <div className="relative flex flex-col gap-6 sm:gap-8">
            <div className={`grid gap-6 ${showPresentationHub ? "lg:grid-cols-[minmax(0,1fr)_minmax(280px,380px)] lg:items-start" : ""}`}>
            <div className="flex flex-col sm:flex-row sm:items-start gap-5 min-w-0">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-red-600 to-rose-600 text-white shadow-lg shadow-red-600/30 ring-4 ring-white/80">
                <Sparkles className="h-7 w-7" strokeWidth={2} aria-hidden />
              </div>
              <div className="min-w-0 flex-1 space-y-3">
                <p className="text-[11px] sm:text-xs font-bold uppercase tracking-[0.14em] text-red-700 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-2.5 py-1 text-[10px] sm:text-[11px] font-semibold tracking-wide text-red-800 shadow-sm ring-1 ring-red-100">
                    {POST_EVENT_ATTENDEE_PORTAL ? (
                      "PAMACON 2026 · Post-conference"
                    ) : (
                      <>
                        <span className="relative flex h-2 w-2" aria-hidden>
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                        </span>
                        Live · Your attendee hub
                      </>
                    )}
                  </span>
                </p>
                <h2 id="welcome-heading" className="text-2xl sm:text-3xl md:text-[2rem] font-bold text-slate-900 leading-[1.15] tracking-tight">
                  {POST_EVENT_ATTENDEE_PORTAL ? (
                    firstName ? (
                      <>
                        <span className="block text-red-700">Thank you, {firstName}!</span>
                        <span className="mt-1 block text-slate-900 font-extrabold">Your participation made PAMACON 2026 unforgettable</span>
                      </>
                    ) : (
                      <>
                        <span className="block text-red-700">Thank you for joining us!</span>
                        <span className="mt-1 block text-slate-900 font-extrabold">PAMACON 2026 — we appreciate you</span>
                      </>
                    )
                  ) : firstName ? (
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
                {POST_EVENT_ATTENDEE_PORTAL ? (
                  <>
                    <p className="text-sm sm:text-base text-slate-700 leading-relaxed max-w-2xl">
                      On behalf of the PAMA organizing committee, thank you for your energy, presence, and commitment throughout the conference.
                      We hope the sessions inspired you and strengthened our community.
                    </p>
                    <p className="text-sm sm:text-base text-slate-700 leading-relaxed max-w-2xl">
                      Please take a few minutes to share your feedback, browse event photos and videos, and explore speaker presentation materials made available for delegates.
                    </p>
                    <div
                      className={`grid grid-cols-1 gap-3 pt-1 ${
                        showEventMediaHub ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2"
                      }`}
                    >
                      <div className="rounded-2xl border border-red-200 bg-white/90 p-4 shadow-sm space-y-2">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-red-700">Now open</p>
                        <p className="text-sm font-bold text-slate-900">Conference evaluation survey</p>
                        <p className="text-xs text-slate-600 leading-relaxed">
                          Your honest feedback helps us improve future PAMACON events. Required before presentation downloads unlock.
                        </p>
                      </div>
                      <EventMediaAccessButton
                        variant="card"
                        configured={eventMediaState.configured || eventMediaState.loading}
                        loading={eventMediaState.loading}
                        hasAccess={eventMediaState.hasAccess}
                        url={eventMediaState.url}
                        label={eventMediaState.label}
                        lockMessage={eventMediaState.lockMessage}
                      />
                      <div className="rounded-2xl border border-violet-200 bg-white/90 p-4 shadow-sm space-y-2">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-violet-700">Available now</p>
                        <p className="text-sm font-bold text-slate-900">Speaker presentation materials</p>
                        <p className="text-xs text-slate-600 leading-relaxed">
                          Selected slide decks and notes from the program are being released for registered delegates after evaluation.
                        </p>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-sm sm:text-base text-slate-700 leading-relaxed max-w-2xl">
                    Browse the posters and welcome video, complete the conference evaluation, then unlock speakers&apos; presentation copies. Update your travel profile whenever you need to.
                  </p>
                )}
                <div className="mt-4 flex flex-col sm:flex-row flex-wrap gap-3">
                  <Link
                    to="/evaluation"
                    className="inline-flex w-full sm:w-auto flex-1 sm:flex-none items-center justify-center gap-2 min-h-[48px] rounded-2xl bg-red-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-red-600/25 hover:bg-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
                  >
                    <ClipboardList size={18} aria-hidden />
                    {POST_EVENT_ATTENDEE_PORTAL ? "Take the evaluation survey" : "Complete the conference evaluation survey"}
                  </Link>
                  {showEventMediaHub ? (
                    <EventMediaAccessButton
                      configured={eventMediaState.configured || eventMediaState.loading}
                      loading={eventMediaState.loading}
                      hasAccess={eventMediaState.hasAccess}
                      url={eventMediaState.url}
                      label={eventMediaState.label}
                      lockMessage={eventMediaState.lockMessage}
                    />
                  ) : null}
                  {showPresentationHub ? (
                    <button
                      type="button"
                      onClick={() => scrollToSpeakerMaterials()}
                      className={`inline-flex w-full sm:w-auto flex-1 sm:flex-none items-center justify-center gap-2 min-h-[48px] rounded-2xl border-2 px-6 py-3 text-sm font-bold shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
                        presentationAccess
                          ? "border-violet-300 bg-violet-50 text-violet-900 hover:bg-violet-100 focus-visible:outline-violet-600"
                          : "border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100 focus-visible:outline-slate-600"
                      }`}
                    >
                      <Presentation size={18} aria-hidden />
                      {presentationAccess ? "View presentation materials" : "Presentation materials (after evaluation)"}
                    </button>
                  ) : null}
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {POST_EVENT_ATTENDEE_PORTAL
                    ? "Sign in with your delegate account. Complete the evaluation first; presentation copies unlock once we match your registration."
                    : "Sign in and complete the evaluation survey first. Presentation copies unlock after we match you to a delegate registration."}
                </p>
              </div>
            </div>

            {showPresentationHub ? (
              <SpeakerMaterialsSection
                embedded
                eventId={eventId}
                materials={speakerMaterialsState.items}
                loading={speakerMaterialsState.loading}
                hasAccess={speakerMaterialsState.hasAccess}
                hasMaterials={showPresentationHub}
                evaluationComplete={evaluationComplete}
                registrationName={speakerMaterialsState.registrationName}
                lockMessage={speakerMaterialsState.lockMessage}
                attendeeSyncHints={attendeeSyncHints}
                profile={profile}
                onApiError={onApiError}
              />
            ) : null}
            </div>

            {!POST_EVENT_ATTENDEE_PORTAL ? (
            <div className={`relative grid grid-cols-1 sm:grid-cols-2 gap-3 ${SHOW_CEBU_TOUR_ACTIVITIES ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
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
              {SHOW_CEBU_TOUR_ACTIVITIES ? (
                <a
                  href="#tours-cards"
                  className="group flex gap-3 rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-4 shadow-sm ring-1 ring-emerald-200/60 transition-all duration-200 hover:-translate-y-0.5 hover:bg-white hover:shadow-md hover:ring-emerald-300/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-600/25">
                    <MapPin className="h-5 w-5" strokeWidth={2} aria-hidden />
                  </span>
                  <span className="min-w-0 text-left">
                    <span className="block text-[11px] font-bold uppercase tracking-wide text-emerald-700">Step 3</span>
                    <span className="mt-0.5 block text-sm font-bold text-emerald-950">Explore Cebu tours</span>
                    <span className="mt-1 block text-xs text-emerald-900/75 leading-snug">View expandable tour cards and choose activities.</span>
                  </span>
                </a>
              ) : null}
              <a
                href="#attendee-details"
                className="group flex gap-3 rounded-2xl border border-red-300/70 bg-gradient-to-br from-red-50 via-white to-rose-50/90 p-4 shadow-md shadow-red-600/10 ring-2 ring-red-200/70 transition-all duration-200 hover:-translate-y-0.5 hover:ring-red-400/80 hover:shadow-lg hover:shadow-red-600/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-red-600 to-rose-600 text-white shadow-md shadow-red-600/25">
                  <ClipboardCheck className="h-5 w-5" strokeWidth={2} aria-hidden />
                </span>
                <span className="min-w-0 text-left">
                  <span className="block text-[11px] font-bold uppercase tracking-wide text-red-700">
                    {SHOW_CEBU_TOUR_ACTIVITIES ? "Step 4 · Main event" : "Step 3"}
                  </span>
                  <span className="mt-0.5 block text-sm font-bold text-red-950">Complete your details</span>
                  <span className="mt-1 block text-xs text-red-950/75 leading-snug">Travel and shirt size on file for your profile.</span>
                </span>
              </a>
            </div>
            ) : null}
          </div>
        </section>

        {!POST_EVENT_ATTENDEE_PORTAL ? (
        <>
        <section className="grid gap-4 sm:grid-cols-3">
          <InfoCard
            icon={Sparkles}
            title="Theme"
            body={theme}
            accent="bg-gradient-to-br from-red-500 to-rose-500 text-white shadow-md shadow-red-500/25"
            chip="Event vibe"
          />
          <InfoCard
            icon={Calendar}
            title="Dates"
            body={dateRangeLabel}
            accent="bg-gradient-to-br from-slate-600 to-slate-700 text-white shadow-md shadow-slate-400/30"
            chip="Save the date"
          />
          <InfoCard
            icon={MapPin}
            title="Venue"
            body={venue}
            accent="bg-gradient-to-br from-sky-500 to-indigo-500 text-white shadow-md shadow-indigo-400/30"
            chip="Location"
            onClick={() => setShowVenueModal(true)}
            actionLabel="View venue details"
          />
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
              <div key={i} className="group rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden transition hover:shadow-md">
                <div className="relative w-full overflow-hidden bg-slate-100 aspect-[4/5]">
                  {src ? (
                    <button
                      type="button"
                      onClick={() => setZoomPoster({ src, label: `Poster ${i + 1}` })}
                      className="absolute inset-0"
                      aria-label={`Open poster ${i + 1} fullscreen`}
                    >
                      <img src={src} alt={`Event poster ${i + 1}`} className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]" loading="lazy" />
                    </button>
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
                  <span className="text-sm font-semibold text-slate-800">{src ? "Tap to zoom fullscreen" : "Waiting for artwork"}</span>
                  {src ? <ChevronDown className="h-5 w-5 shrink-0 text-slate-400 -rotate-90" aria-hidden /> : null}
                </div>
                <div className="border-t border-slate-100 px-3.5 pb-3.5 pt-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-600 leading-relaxed">
                    {src ? (
                      <>Tap the poster image to open a full-screen, size-optimized preview.</>
                    ) : (
                      <>
                        Set <code className="rounded bg-slate-200/80 px-1 py-0.5 text-[10px]">attendeePortal.posterImageUrls[{i}]</code> in event configuration to publish this slot.
                      </>
                    )}
                  </div>
                </div>
              </div>
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

        <section aria-labelledby="program-heading" className="space-y-4">
          <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="relative border-b border-slate-100 bg-gradient-to-r from-red-50 via-white to-blue-50 px-4 sm:px-6 py-5">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <h2 id="program-heading" className="text-lg sm:text-xl font-black tracking-tight text-slate-900 flex items-center gap-2">
                  <Clock3 className="text-red-600 shrink-0" size={22} aria-hidden />
                  Conference Program
                </h2>
                <div className="flex gap-1 bg-white/95 p-1 rounded-full border border-slate-200 shadow-sm">
                  {groupedProgram.order.map((day) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => setActiveProgramDay(day)}
                      className={`px-4 py-2 rounded-full font-black text-[10px] uppercase tracking-[0.2em] transition-all ${
                        activeProgramDay === day ? "bg-[#E31E24] text-white shadow" : "text-slate-500 hover:bg-slate-100"
                      }`}
                    >
                      {programDayLabel(day)}
                    </button>
                  ))}
                </div>
              </div>
              <p className="mt-2 text-sm text-slate-600">
                Tap <strong>View slides</strong> or <strong>Download</strong> on sessions with presentation materials (Google Drive). Requires sign-in and a matched delegate registration.
              </p>
            </div>

            <div className="p-4 sm:p-6">
              {activeProgramDay && groupedProgram.map.has(activeProgramDay) ? (
                <div className="space-y-3">
                  {groupedProgram.map.get(activeProgramDay).map((item, idx) => {
                    const variant = classifyProgramItem(item);
                    return (
                      <div
                        key={item.id}
                        className={`rounded-2xl border px-4 py-3.5 transition-all ${
                          variant.kind === "keynote"
                            ? "bg-gradient-to-r from-[#E31E24]/5 to-white border-[#E31E24]/25 shadow-sm"
                            : variant.kind === "special"
                            ? "bg-[#002F5D]/5 border-[#002F5D]/20"
                            : idx % 2 === 0
                            ? "bg-white border-slate-200"
                            : "bg-slate-50/70 border-slate-200/80"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="min-w-[4.5rem]">
                            <p className={`text-[11px] font-black tracking-wide ${variant.kind === "keynote" ? "text-[#E31E24]" : "text-slate-600"}`}>
                              {item.time || "TBD"}
                            </p>
                            <div className={`mt-1 h-2.5 w-2.5 rounded-full ${variant.kind === "keynote" ? "bg-[#E31E24]" : "bg-slate-300"}`} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              {variant.kind === "keynote" ? (
                                <span className="bg-[#E31E24] text-white text-[9px] font-black px-2 py-0.5 rounded-sm uppercase tracking-wide">Keynote</span>
                              ) : null}
                              <p className="text-sm sm:text-base font-black uppercase tracking-tight text-slate-900 leading-tight">
                                {item.program || "Program item"}
                              </p>
                              {variant.icon}
                            </div>
                            {isRockOfAgesFellowship(item) ? (
                              <div className="mt-1.5">
                                <img
                                  src="/landing/fellowship-rock-of-ages.png"
                                  alt="Rock of Ages fellowship theme"
                                  className="h-10 w-auto rounded-md border border-slate-200 bg-white object-contain"
                                  loading="lazy"
                                />
                              </div>
                            ) : item.assigned ? (
                              <div className="mt-1.5">
                                <p className={`inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider ${variant.kind === "keynote" ? "text-[#002F5D]" : "text-slate-500"}`}>
                                  <User size={11} />
                                  {item.assigned}
                                </p>
                              </div>
                            ) : null}
                            {item.hasPresentation ? (
                              <ProgramPresentationButtons
                                viewUrl={item.presentationViewUrl}
                                downloadUrl={item.presentationDownloadUrl}
                                hasAccess={speakerMaterialsState.hasAccess}
                                evaluationComplete={evaluationComplete}
                                hasPresentation
                                compact
                              />
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {groupedProgram
                    .map
                    .get(activeProgramDay)
                    .some((item) => isRockOfAgesFellowship(item)) ? (
                    <div className="mt-5 rounded-[2rem] bg-black p-7 text-center border-b-4 border-yellow-400 shadow-xl relative overflow-hidden">
                      <div className="absolute inset-0 opacity-25 bg-[radial-gradient(circle_at_50%_50%,_#E31E24_0%,_transparent_70%)]" />
                      <div className="relative z-10 flex flex-col items-center gap-3">
                        <p className="text-[#E31E24] font-black text-[11px] tracking-[0.45em] uppercase">Fellowship Night</p>
                        <img
                          src="/landing/fellowship-rock-of-ages.png"
                          alt="Rock of Ages fellowship night theme"
                          className="max-w-[320px] w-full h-auto object-contain"
                          loading="lazy"
                        />
                        <p className="text-[#FFD700] font-black uppercase text-[10px] tracking-[0.25em] inline-flex items-center gap-1.5">
                          <Award size={12} />
                          Unleash your inner rockstar
                        </p>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                  Program details will appear here once modules are configured.
                </div>
              )}
            </div>
          </div>
        </section>
        </>
        ) : null}

        {!POST_EVENT_ATTENDEE_PORTAL ? (
        <AttendeeDetailsForm
          profile={profile}
          authEmail={authEmail}
          onSaveProfile={onSaveProfile}
          profileSaving={profileSaving}
          quoteEmail={portal.quoteRequestEmail}
        />
        ) : null}
      </main>
      {!POST_EVENT_ATTENDEE_PORTAL && showVenueModal && (
        <div className="fixed inset-0 z-[120] bg-slate-900/60 backdrop-blur-sm p-4 sm:p-6" role="dialog" aria-modal="true" aria-label="Venue details">
          <div className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-100">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Venue</p>
                <h3 className="text-lg font-semibold text-slate-900">{venue}</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowVenueModal(false)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/70">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Property photos</p>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                <p className="text-sm text-slate-700 leading-relaxed">
                  View the latest hotel photos first (facade, lobby, rooms, and amenities) before opening maps.
                </p>
                <a
                  href={photosSearchUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex items-center justify-center min-h-[44px] rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                >
                  View property photos
                </a>
              </div>
            </div>
            <div className="aspect-video w-full bg-slate-100 border-b border-slate-100">
              <iframe title="Venue map preview" src={mapsEmbedSrc} className="h-full w-full" loading="lazy" />
            </div>
            <div className="px-5 py-4 flex flex-col sm:flex-row gap-2.5">
              <a
                href={mapsOpenUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center min-h-[44px] rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Open in Google Maps
              </a>
              <a
                href={mapsDirectionsUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center min-h-[44px] rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
              >
                Get directions
              </a>
            </div>
          </div>
        </div>
      )}
      {!POST_EVENT_ATTENDEE_PORTAL && zoomPoster && (
        <div
          className="fixed inset-0 z-[130] bg-black/90 p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label={`${zoomPoster.label} fullscreen preview`}
          onClick={() => setZoomPoster(null)}
        >
          <div className="relative h-full w-full">
            <button
              type="button"
              onClick={() => setZoomPoster(null)}
              className="absolute right-0 top-0 z-10 rounded-xl border border-white/40 bg-black/50 px-3 py-2 text-sm font-semibold text-white hover:bg-black/70"
            >
              Close
            </button>
            <div className="flex h-full w-full items-center justify-center">
              <img
                src={zoomPoster.src}
                alt={zoomPoster.label}
                className="max-h-[90vh] max-w-[95vw] object-contain rounded-xl shadow-2xl"
                onClick={(event) => event.stopPropagation()}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatDateRange(start, end) {
  const safeStart = String(start || "").trim();
  const safeEnd = String(end || "").trim();
  if (!safeStart || !safeEnd) return `${start} → ${end}`;
  const s = new Date(`${safeStart}T00:00:00`);
  const e = new Date(`${safeEnd}T00:00:00`);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return `${start} → ${end}`;
  const sameMonth = s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear();
  if (sameMonth) {
    return `${s.toLocaleDateString("en-US", { month: "short" })} ${s.getDate()}-${e.getDate()}, ${e.getFullYear()}`;
  }
  return `${s.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${e.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
}

function programDayLabel(day) {
  const src = String(day || "").toLowerCase();
  if (src.includes("day 1")) return "Day One";
  if (src.includes("day 2")) return "Day Two";
  return String(day || "Program");
}

function classifyProgramItem(item) {
  const title = String(item?.program || "").toLowerCase();
  if (title.includes("keynote")) return { kind: "keynote", icon: <Star size={14} className="text-[#E31E24]" /> };
  if (title.includes("photo")) return { kind: "normal", icon: <Camera size={14} className="text-slate-400" /> };
  if (title.includes("lunch") || title.includes("dinner")) return { kind: "normal", icon: <Utensils size={14} className="text-slate-400" /> };
  if (title.includes("fellowship")) return { kind: "special", icon: <Music size={14} className="text-slate-400" /> };
  if (title.includes("opening") || title.includes("closing")) return { kind: "special", icon: <Sparkles size={14} className="text-slate-400" /> };
  return { kind: "normal", icon: null };
}

function InfoCard({ icon, title, body, chip, onClick, actionLabel, accent = "bg-slate-100 text-slate-600" }) {
  const Glyph = icon;
  const asButton = typeof onClick === "function";
  const Wrapper = asButton ? "button" : "div";
  return (
    <Wrapper
      type={asButton ? "button" : undefined}
      onClick={asButton ? onClick : undefined}
      className={`rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 flex gap-3 sm:flex-col sm:gap-3 shadow-sm transition-shadow ${
        asButton
          ? "text-left hover:shadow-md hover:border-red-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
          : "hover:shadow-md"
      }`}
      aria-label={actionLabel || title}
    >
      <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${accent}`}>
        <Glyph size={20} aria-hidden />
      </div>
      <div className="min-w-0">
        {chip && <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{chip}</p>}
        <h3 className="font-semibold text-slate-900 text-sm sm:text-base">{title}</h3>
        <p className="text-slate-600 mt-1 text-sm leading-relaxed">{body}</p>
        {asButton && <p className="mt-1 text-xs font-semibold text-red-700">Tap to view map and directions</p>}
      </div>
    </Wrapper>
  );
}
