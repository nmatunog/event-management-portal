import { Link } from "react-router-dom";
import { useState } from "react";
import { ClipboardList, Download, ExternalLink, FileText, Lock, Sparkles } from "lucide-react";
import { openSpeakerMaterialFile } from "../lib/api";
import { POST_EVENT_ATTENDEE_PORTAL } from "./attendeePortalFlags";
import { isPinnedSpeakerMaterial, normalizeSpeakerMaterials } from "./speakerMaterials";

export default function SpeakerMaterialsSection({
  eventId,
  materials = [],
  loading = false,
  hasAccess = false,
  hasMaterials = true,
  evaluationComplete = false,
  evaluationLoading = false,
  registrationName = "",
  lockMessage = "",
  attendeeSyncHints = {},
  profile = {},
  onApiError,
  embedded = false,
}) {
  const [fileBusyId, setFileBusyId] = useState("");
  const items = normalizeSpeakerMaterials(materials);

  const fileMatchParams = {
    firstName: profile?.firstName,
    lastName: profile?.lastName,
    nickname: profile?.nickname,
    seededRegistrationId: attendeeSyncHints?.seededRegistrationId,
    seededDelegateName: attendeeSyncHints?.seededDelegateName,
  };

  const openUploadedFile = (item, download) => {
    if (!eventId || !item.fileId) return;
    setFileBusyId(item.id);
    void openSpeakerMaterialFile(eventId, item.fileId, { download, ...fileMatchParams })
      .catch((e) => onApiError?.(e, download ? "Could not download PDF." : "Could not open PDF."))
      .finally(() => setFileBusyId(""));
  };

  if (!hasMaterials && !loading && !evaluationLoading) return null;

  const shellClass = embedded
    ? "rounded-2xl border border-violet-200/90 bg-white/95 backdrop-blur-sm p-4 sm:p-5 shadow-md shadow-violet-900/5 space-y-3 lg:sticky lg:top-24"
    : "scroll-mt-24 space-y-4";

  const canShowMaterials = hasAccess && evaluationComplete;

  return (
    <section id="speaker-materials" aria-labelledby="speaker-materials-heading" className={shellClass}>
      <div className="space-y-1">
        <h2 id="speaker-materials-heading" className="text-base font-bold text-slate-900 flex items-center gap-2">
          <FileText className="text-violet-600 shrink-0" size={20} aria-hidden />
          Presentation decks
        </h2>
        {!embedded ? (
          <p className="text-sm text-slate-600 max-w-2xl">
            Unlocked after you complete the evaluation survey and we match your registration.
          </p>
        ) : null}
      </div>

      {loading || evaluationLoading ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-5 text-center">
          <div className="mx-auto h-8 w-8 rounded-full border-2 border-violet-200 border-t-violet-600 animate-spin" aria-hidden />
          <p className="mt-3 text-sm text-slate-500">Checking access…</p>
        </div>
      ) : !hasAccess ? (
        <LockPanel
          tone="amber"
          title="Registration required"
          message={lockMessage || "Sign in and save your profile so we can match you to the delegate list."}
          href={POST_EVENT_ATTENDEE_PORTAL ? "" : "#attendee-details"}
          cta={POST_EVENT_ATTENDEE_PORTAL ? "" : "Complete your profile"}
        />
      ) : !evaluationComplete ? (
        <LockPanel
          tone="red"
          title="One step away"
          message="Complete the quick evaluation survey to unlock every deck below."
          href="/evaluation"
          cta="Take evaluation"
          icon={ClipboardList}
        />
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600 text-center">
          Slides will appear here when published.
        </div>
      ) : (
        <>
          <div className="rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-3.5 py-2.5 text-white shadow-sm">
            <p className="flex items-center gap-2 text-xs font-bold">
              <Sparkles size={14} aria-hidden />
              {items.length} deck{items.length === 1 ? "" : "s"} ready — tap View to open
            </p>
            {registrationName && !embedded ? (
              <p className="mt-1 text-[11px] text-violet-100">Access for {registrationName}</p>
            ) : null}
          </div>
          <ul
            className={`space-y-2 ${embedded ? "max-h-[min(480px,58vh)] overflow-y-auto pr-0.5 scroll-smooth" : "sm:grid sm:grid-cols-2 sm:gap-3 sm:space-y-0"}`}
          >
            {items.map((item, index) => {
              const featured = isPinnedSpeakerMaterial(item.title);
              const busy = fileBusyId === item.id;
              return (
                <li
                  key={item.id}
                  className={`rounded-xl border bg-white transition-shadow ${
                    embedded ? "p-3" : "p-4 shadow-sm"
                  } ${featured ? "border-violet-300 ring-2 ring-violet-200/80 shadow-sm" : "border-slate-200"}`}
                >
                  <div className="flex items-start gap-2.5">
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-black ${
                        featured ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-600"
                      }`}
                      aria-hidden
                    >
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={`font-bold text-slate-900 leading-snug ${embedded ? "text-xs" : "text-sm"}`}>
                        {item.title}
                        {featured ? (
                          <span className="ml-1.5 inline-block text-[9px] font-black uppercase tracking-wide text-violet-600 align-middle">
                            Featured
                          </span>
                        ) : null}
                      </p>
                      <div className="mt-2 flex gap-2">
                        {item.source === "upload" ? (
                          <>
                            <MaterialBtn
                              primary
                              busy={busy}
                              disabled={!canShowMaterials}
                              onClick={() => openUploadedFile(item, false)}
                              label={busy ? "Opening…" : "View"}
                              icon={ExternalLink}
                            />
                            <MaterialBtn
                              busy={busy}
                              disabled={!canShowMaterials}
                              onClick={() => openUploadedFile(item, true)}
                              label="Save"
                              icon={Download}
                            />
                          </>
                        ) : (
                          <>
                            <MaterialBtn
                              primary
                              disabled={!canShowMaterials}
                              href={item.viewUrl}
                              label="View"
                              icon={ExternalLink}
                            />
                            <MaterialBtn
                              disabled={!canShowMaterials}
                              href={item.downloadUrl || item.viewUrl}
                              download
                              label="Save"
                              icon={Download}
                            />
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}

function LockPanel({ tone, title, message, href, cta, icon: Icon = Lock }) {
  const tones = {
    amber: "border-amber-200 bg-amber-50 text-amber-950",
    red: "border-red-200 bg-red-50 text-red-950",
  };
  return (
    <div className={`rounded-xl border p-4 space-y-2 ${tones[tone] || tones.red}`}>
      <p className="text-sm font-bold flex items-center gap-2">
        <Icon size={16} aria-hidden />
        {title}
      </p>
      <p className="text-xs leading-relaxed opacity-90">{message}</p>
      {href && cta ? (
        href.startsWith("/") ? (
          <Link
            to={href}
            className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800"
          >
            {cta}
          </Link>
        ) : (
          <a
            href={href}
            className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800"
          >
            {cta}
          </a>
        )
      ) : null}
    </div>
  );
}

function MaterialBtn({ primary, href, download, label, icon: Icon, disabled, busy, onClick }) {
  const className = primary
    ? "inline-flex flex-1 min-h-[36px] items-center justify-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-[11px] font-black uppercase text-white hover:bg-violet-700 disabled:opacity-45"
    : "inline-flex min-h-[36px] items-center justify-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-[11px] font-black uppercase text-violet-800 hover:bg-violet-100 disabled:opacity-45";

  if (href && !disabled) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" download={download || undefined} className={className}>
        <Icon size={12} aria-hidden />
        {label}
      </a>
    );
  }

  return (
    <button type="button" disabled={disabled || busy} onClick={onClick} className={className}>
      <Icon size={12} aria-hidden />
      {label}
    </button>
  );
}
