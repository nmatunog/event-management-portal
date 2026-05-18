import { Link } from "react-router-dom";
import { Camera, CheckCircle2, ChevronRight, ClipboardList, Lock, Presentation, Sparkles } from "lucide-react";
/**
 * Post-conference attendee hub: low-copy hero, 3-step progress, one-tap action tiles.
 */
export default function PostEventWelcomeHub({
  firstName = "",
  evaluationComplete = false,
  presentationAccess = false,
  presentationCount = 0,
  eventMediaState = {},
  onOpenPresentations,
}) {
  const mediaReady = eventMediaState.hasAccess && eventMediaState.url;
  const steps = [
    {
      id: "eval",
      label: "Evaluate",
      done: evaluationComplete,
      active: !evaluationComplete,
    },
    {
      id: "photos",
      label: "Photos",
      done: mediaReady,
      active: evaluationComplete && eventMediaState.configured && !mediaReady,
    },
    {
      id: "slides",
      label: "Slides",
      done: presentationAccess,
      active: evaluationComplete && !presentationAccess,
    },
  ];

  return (
    <div className="space-y-5 min-w-0">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-red-600 to-rose-500 text-white shadow-lg shadow-red-600/25">
          <Sparkles className="h-6 w-6" strokeWidth={2} aria-hidden />
        </div>
        <div className="min-w-0 space-y-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-red-700">PAMACON 2026</p>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 leading-tight">
            {firstName ? `Thank you, ${firstName}!` : "Thank you for joining us!"}
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Three quick stops — feedback, memories, and slides. Most delegates finish in under 5 minutes.
          </p>
        </div>
      </div>

      <ol className="flex items-center gap-1 sm:gap-2" aria-label="Your progress">
        {steps.map((step, idx) => (
          <li key={step.id} className="flex flex-1 items-center gap-1 sm:gap-2 min-w-0">
            <span
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-2 sm:px-3 py-1.5 text-[10px] sm:text-xs font-bold uppercase tracking-wide transition-colors ${
                step.done
                  ? "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200"
                  : step.active
                  ? "bg-red-100 text-red-800 ring-2 ring-red-300"
                  : "bg-slate-100 text-slate-500 ring-1 ring-slate-200"
              }`}
            >
              {step.done ? <CheckCircle2 size={14} className="shrink-0" aria-hidden /> : null}
              <span className="truncate">{step.label}</span>
            </span>
            {idx < steps.length - 1 ? (
              <span className="hidden sm:block h-px w-3 bg-slate-300 shrink-0" aria-hidden />
            ) : null}
          </li>
        ))}
      </ol>

      <div className="space-y-2.5" role="list" aria-label="Quick actions">
        <ActionTile
          step={1}
          done={evaluationComplete}
          icon={ClipboardList}
          accent="red"
          title={evaluationComplete ? "Evaluation complete" : "Share your feedback"}
          subtitle={
            evaluationComplete
              ? "Thank you — your voice shapes the next PAMACON."
              : "Required to unlock presentation downloads."
          }
          href="/evaluation"
          asLink
          cta={evaluationComplete ? "View / edit" : "Start survey"}
        />

        {eventMediaState.configured || eventMediaState.loading ? (
          <EventMediaTile eventMediaState={eventMediaState} step={2} />
        ) : null}

        <ActionTile
          step={showEventMediaStep(eventMediaState) ? 3 : 2}
          done={presentationAccess}
          locked={!evaluationComplete}
          icon={Presentation}
          accent="violet"
          title="Speaker presentations"
          subtitle={
            presentationAccess
              ? `${presentationCount || "Your"} deck${presentationCount === 1 ? "" : "s"} ready to view`
              : evaluationComplete
              ? "Scroll to open your copies →"
              : "Unlocks right after evaluation"
          }
          onClick={presentationAccess || evaluationComplete ? onOpenPresentations : undefined}
          href={!evaluationComplete ? "/evaluation" : undefined}
          asLink={!evaluationComplete}
          cta={presentationAccess ? "Open list" : evaluationComplete ? "View decks" : "Complete step 1"}
        />
      </div>

      {evaluationComplete && presentationAccess ? (
        <p className="flex items-center gap-2 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
          <CheckCircle2 size={16} aria-hidden />
          You&apos;re all set — enjoy the photos and slides from PAMACON 2026.
        </p>
      ) : null}
    </div>
  );
}

function showEventMediaStep(eventMediaState) {
  return Boolean(eventMediaState?.configured || eventMediaState?.loading);
}

function EventMediaTile({ eventMediaState, step }) {
  const ready = eventMediaState.hasAccess && eventMediaState.url;
  const openDrive = () => {
    if (eventMediaState.url) window.open(eventMediaState.url, "_blank", "noopener,noreferrer");
  };

  if (eventMediaState.loading) {
    return (
      <div className="rounded-2xl border border-sky-200 bg-white p-4 text-sm text-slate-500">Checking photo access…</div>
    );
  }

  if (!eventMediaState.hasAccess) {
    return (
      <ActionTile
        step={step}
        icon={Camera}
        accent="sky"
        title={eventMediaState.label || "Event photos & videos"}
        subtitle={eventMediaState.lockMessage || "Match your registration to open the album."}
        locked
        cta="Registration required"
      />
    );
  }

  return (
    <ActionTile
      step={step}
      done={ready}
      icon={Camera}
      accent="sky"
      title={eventMediaState.label || "Event photos & videos"}
      subtitle="Official conference album on Google Drive"
      onClick={openDrive}
      cta="Open album"
    />
  );
}

function ActionTile({
  step,
  done = false,
  locked = false,
  icon: Icon,
  accent = "red",
  title,
  subtitle,
  cta,
  href,
  asLink = false,
  onClick,
}) {
  const accentMap = {
    red: {
      ring: "ring-red-200 hover:ring-red-300",
      bg: "bg-gradient-to-r from-red-50 to-white",
      icon: "bg-red-600 text-white",
      cta: "text-red-700",
    },
    sky: {
      ring: "ring-sky-200 hover:ring-sky-300",
      bg: "bg-gradient-to-r from-sky-50 to-white",
      icon: "bg-sky-600 text-white",
      cta: "text-sky-700",
    },
    violet: {
      ring: "ring-violet-200 hover:ring-violet-300",
      bg: "bg-gradient-to-r from-violet-50 to-white",
      icon: "bg-violet-600 text-white",
      cta: "text-violet-700",
    },
  };
  const tone = accentMap[accent] || accentMap.red;

  const inner = (
    <>
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone.icon} shadow-sm`}>
        {locked && !done ? <Lock size={18} aria-hidden /> : <Icon size={18} aria-hidden />}
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Step {step}</span>
          {done ? (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold uppercase text-emerald-700">
              <CheckCircle2 size={12} aria-hidden /> Done
            </span>
          ) : null}
        </span>
        <span className="mt-0.5 block text-sm font-bold text-slate-900">{title}</span>
        <span className="mt-0.5 block text-xs text-slate-600 leading-snug">{subtitle}</span>
      </span>
      <span className={`flex shrink-0 items-center gap-1 text-xs font-bold ${tone.cta}`}>
        {cta}
        {!locked || done ? <ChevronRight size={16} aria-hidden /> : null}
      </span>
    </>
  );

  const className = `group w-full flex items-center gap-3 rounded-2xl border bg-white p-3.5 sm:p-4 shadow-sm ring-2 transition-all duration-200 ${tone.bg} ${tone.ring} ${
    locked && !done ? "opacity-90" : "hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99]"
  } focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500`;

  if (asLink && href) {
    return (
      <Link to={href} className={className} role="listitem">
        {inner}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className} role="listitem">
        {inner}
      </button>
    );
  }

  return (
    <div className={`${className} cursor-default`} role="listitem">
      {inner}
    </div>
  );
}
