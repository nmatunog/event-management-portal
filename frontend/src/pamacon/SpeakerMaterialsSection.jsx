import { Link } from "react-router-dom";
import { useState } from "react";
import { ClipboardList, Download, ExternalLink, FileText, Lock } from "lucide-react";
import { openSpeakerMaterialFile } from "../lib/api";
import { normalizeSpeakerMaterials } from "./speakerMaterials";

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
    ? "rounded-2xl border border-violet-200/80 bg-white/90 backdrop-blur-sm p-4 sm:p-5 shadow-sm space-y-3 h-full"
    : "scroll-mt-24 space-y-4";

  const titleClass = embedded
    ? "text-base font-bold text-slate-900 flex items-center gap-2"
    : "text-lg sm:text-xl font-semibold text-slate-900 flex items-center gap-2";

  const canShowMaterials = hasAccess && evaluationComplete;

  return (
    <section id="speaker-materials" aria-labelledby="speaker-materials-heading" className={shellClass}>
      <div className="space-y-1">
        <h2 id="speaker-materials-heading" className={titleClass}>
          <FileText className="text-violet-600 shrink-0" size={embedded ? 20 : 22} aria-hidden />
          Speakers&apos; presentation copies
        </h2>
        <p className={`text-slate-600 max-w-2xl ${embedded ? "text-xs leading-relaxed" : "text-sm"}`}>
          {embedded
            ? "Complete the evaluation survey to unlock view and download."
            : "Unlocked after you complete the evaluation survey and we match your registration."}
        </p>
      </div>

      {loading || evaluationLoading ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-6 text-center text-sm text-slate-500">
          Checking access…
        </div>
      ) : !hasAccess ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50/90 p-4 space-y-2">
          <div className="flex items-start gap-2">
            <Lock size={18} className="text-amber-800 shrink-0 mt-0.5" aria-hidden />
            <div className="min-w-0 space-y-2">
              <p className="text-sm font-semibold text-amber-950">Registration required</p>
              <p className="text-xs text-amber-900/90 leading-relaxed">
                {lockMessage || "Sign in and save your profile so we can match you to the delegate list."}
              </p>
              <a
                href="#attendee-details"
                className="inline-flex min-h-[40px] items-center justify-center rounded-lg bg-amber-800 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-900"
              >
                Complete your profile
              </a>
            </div>
          </div>
        </div>
      ) : !evaluationComplete ? (
        <div className="rounded-xl border border-red-200 bg-red-50/90 p-4 space-y-2">
          <div className="flex items-start gap-2">
            <Lock size={18} className="text-red-700 shrink-0 mt-0.5" aria-hidden />
            <div className="min-w-0 space-y-2">
              <p className="text-sm font-semibold text-red-950">Evaluation required first</p>
              <p className="text-xs text-red-900/90 leading-relaxed">
                Complete the conference evaluation survey to unlock these presentation materials.
              </p>
              <Link
                to="/evaluation"
                className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700"
              >
                <ClipboardList size={16} aria-hidden />
                Take evaluation survey
              </Link>
            </div>
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          Presentation copies are not published yet.
        </div>
      ) : (
        <>
          {registrationName && !embedded ? (
            <p className="text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 w-fit">
              Access granted for {registrationName}
            </p>
          ) : null}
          <div className={`grid gap-2 ${embedded ? "grid-cols-1 max-h-[min(420px,55vh)] overflow-y-auto pr-1" : "sm:grid-cols-2 gap-3"}`}>
            {items.map((item) => (
              <div
                key={item.id}
                className={`rounded-xl border border-slate-200 bg-white flex flex-col gap-3 ${embedded ? "p-3.5" : "p-5 shadow-sm"}`}
              >
                <p className={`font-bold text-slate-900 leading-snug ${embedded ? "text-xs" : "text-sm"}`}>{item.title}</p>
                <div className="flex flex-wrap gap-2 mt-auto">
                  {item.source === "upload" ? (
                    <>
                      <button
                        type="button"
                        disabled={!canShowMaterials || fileBusyId === item.id}
                        onClick={() => openUploadedFile(item, false)}
                        className="inline-flex flex-1 min-w-[100px] items-center justify-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-[10px] font-black uppercase text-white hover:bg-violet-700 disabled:opacity-50"
                      >
                        <ExternalLink size={12} aria-hidden />
                        {fileBusyId === item.id ? "…" : "View"}
                      </button>
                      <button
                        type="button"
                        disabled={!canShowMaterials || fileBusyId === item.id}
                        onClick={() => openUploadedFile(item, true)}
                        className="inline-flex flex-1 min-w-[100px] items-center justify-center gap-1.5 rounded-lg border-2 border-violet-200 bg-violet-50 px-3 py-2 text-[10px] font-black uppercase text-violet-800 hover:bg-violet-100 disabled:opacity-50"
                      >
                        <Download size={12} aria-hidden />
                        Download
                      </button>
                    </>
                  ) : (
                    <>
                      <a
                        href={canShowMaterials ? item.viewUrl : undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-disabled={!canShowMaterials}
                        className={`inline-flex flex-1 min-w-[100px] items-center justify-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-[10px] font-black uppercase text-white hover:bg-violet-700 ${!canShowMaterials ? "pointer-events-none opacity-50" : ""}`}
                      >
                        <ExternalLink size={12} aria-hidden />
                        View
                      </a>
                      <a
                        href={canShowMaterials ? item.downloadUrl || item.viewUrl : undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                        download
                        aria-disabled={!canShowMaterials}
                        className={`inline-flex flex-1 min-w-[100px] items-center justify-center gap-1.5 rounded-lg border-2 border-violet-200 bg-violet-50 px-3 py-2 text-[10px] font-black uppercase text-violet-800 hover:bg-violet-100 ${!canShowMaterials ? "pointer-events-none opacity-50" : ""}`}
                      >
                        <Download size={12} aria-hidden />
                        Download
                      </a>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
