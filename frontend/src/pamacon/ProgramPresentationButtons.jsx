import { Download, ExternalLink, Lock } from "lucide-react";

export default function ProgramPresentationButtons({
  viewUrl,
  downloadUrl,
  hasAccess,
  hasPresentation = false,
  evaluationComplete = false,
  compact = false,
}) {
  if (!hasPresentation && !viewUrl) return null;

  if (!hasAccess) {
    return (
      <p className={`flex items-center gap-1.5 text-amber-800 ${compact ? "text-[10px] mt-2" : "text-xs mt-3"}`}>
        <Lock size={compact ? 11 : 13} aria-hidden />
        Presentation materials — sign in and match your registration to open.
      </p>
    );
  }

  if (!evaluationComplete) {
    return (
      <p className={`flex items-center gap-1.5 text-red-800 ${compact ? "text-[10px] mt-2" : "text-xs mt-3"}`}>
        <Lock size={compact ? 11 : 13} aria-hidden />
        Complete the evaluation survey to unlock slides for this session.
      </p>
    );
  }

  const btnClass = compact
    ? "inline-flex flex-1 min-w-[100px] items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[10px] font-black uppercase"
    : "inline-flex flex-1 min-w-[120px] items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black uppercase";

  return (
    <div className={`flex flex-wrap gap-2 ${compact ? "mt-2" : "mt-3"}`}>
      <a
        href={viewUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`${btnClass} bg-violet-600 text-white hover:bg-violet-700`}
      >
        <ExternalLink size={compact ? 12 : 14} aria-hidden />
        View slides
      </a>
      <a
        href={downloadUrl || viewUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`${btnClass} border-2 border-violet-200 bg-violet-50 text-violet-800 hover:bg-violet-100`}
      >
        <Download size={compact ? 12 : 14} aria-hidden />
        Download
      </a>
    </div>
  );
}
