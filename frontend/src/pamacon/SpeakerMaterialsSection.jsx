import { Link } from "react-router-dom";
import { Download, ExternalLink, FileText, Lock } from "lucide-react";
import { normalizeSpeakerMaterials } from "./speakerMaterials";

export default function SpeakerMaterialsSection({
  materials = [],
  loading = false,
  hasAccess = false,
  hasMaterials = true,
  registrationName = "",
  lockMessage = "",
}) {
  const items = normalizeSpeakerMaterials(materials);
  if (!hasMaterials && !loading) return null;

  return (
    <section id="speaker-materials" aria-labelledby="speaker-materials-heading" className="scroll-mt-24 space-y-4">
      <div className="space-y-1">
        <h2 id="speaker-materials-heading" className="text-lg sm:text-xl font-semibold text-slate-900 flex items-center gap-2">
          <FileText className="text-violet-600 shrink-0" size={22} aria-hidden />
          Speakers&apos; presentation copies
        </h2>
        <p className="text-sm text-slate-600 max-w-2xl">
          View or download slide decks and notes shared by the program team (Google Drive). Available to registered delegates who are signed in.
        </p>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          Checking your registration…
        </div>
      ) : !hasAccess ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
              <Lock size={20} aria-hidden />
            </span>
            <div className="min-w-0 space-y-2">
              <p className="text-sm font-semibold text-amber-950">Registration required</p>
              <p className="text-sm text-amber-900/90 leading-relaxed">
                {lockMessage ||
                  "Sign in with your delegate email and save your profile under Enter your details so we can match you to the delegate list."}
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <a
                  href="#attendee-details"
                  className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-amber-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-900"
                >
                  Complete your profile
                </a>
                <Link
                  to="/sign-in?next=%2Fportal"
                  className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-amber-300 bg-white px-4 py-2.5 text-sm font-semibold text-amber-900 hover:bg-amber-100"
                >
                  Sign in
                </Link>
              </div>
            </div>
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
          Presentation copies are not published yet. Check back after the committee uploads materials in Setup.
        </div>
      ) : (
        <>
          {registrationName ? (
            <p className="text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 w-fit">
              Access granted for {registrationName}
            </p>
          ) : null}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {items.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col gap-4"
              >
                <p className="text-sm font-bold text-slate-900 leading-snug">{item.title}</p>
                <div className="flex flex-wrap gap-2 mt-auto">
                  <a
                    href={item.viewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex flex-1 min-w-[120px] items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-black uppercase text-white hover:bg-violet-700"
                  >
                    <ExternalLink size={14} aria-hidden />
                    View
                  </a>
                  <a
                    href={item.downloadUrl || item.viewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    download
                    className="inline-flex flex-1 min-w-[120px] items-center justify-center gap-2 rounded-xl border-2 border-violet-200 bg-violet-50 px-4 py-2.5 text-xs font-black uppercase text-violet-800 hover:bg-violet-100"
                  >
                    <Download size={14} aria-hidden />
                    Download
                  </a>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
