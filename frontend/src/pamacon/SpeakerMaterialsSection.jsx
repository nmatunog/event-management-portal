import { Download, ExternalLink, FileText } from "lucide-react";
import { normalizeSpeakerMaterials } from "./speakerMaterials";

export default function SpeakerMaterialsSection({ materials }) {
  const items = normalizeSpeakerMaterials(materials);
  if (!items.length) return null;

  return (
    <section aria-labelledby="speaker-materials-heading" className="space-y-4">
      <div>
        <h2 id="speaker-materials-heading" className="text-lg sm:text-xl font-semibold text-slate-900 flex items-center gap-2">
          <FileText className="text-violet-600 shrink-0" size={22} aria-hidden />
          Speaker notes &amp; slides
        </h2>
        <p className="mt-1 text-sm text-slate-600 max-w-2xl">
          Open or download PDFs and slide decks shared by the program team (hosted on Google Drive).
        </p>
      </div>
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
                className="inline-flex flex-1 min-w-[120px] items-center justify-center gap-2 rounded-xl border-2 border-violet-200 bg-violet-50 px-4 py-2.5 text-xs font-black uppercase text-violet-800 hover:bg-violet-100"
              >
                <Download size={14} aria-hidden />
                Download
              </a>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
