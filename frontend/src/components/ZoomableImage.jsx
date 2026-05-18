import { useCallback, useEffect, useState } from "react";
import { ZoomIn } from "lucide-react";

export function ImageZoomLightbox({ src, alt, onClose }) {
  const handleClose = useCallback(() => onClose?.(), [onClose]);

  useEffect(() => {
    if (!src) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [src, handleClose]);

  if (!src) return null;

  return (
    <div
      className="fixed inset-0 z-[400] bg-black/90 p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={alt || "Image preview"}
      onClick={handleClose}
    >
      <div className="relative h-full w-full">
        <button
          type="button"
          onClick={handleClose}
          className="absolute right-0 top-0 z-10 rounded-xl border border-white/40 bg-black/50 px-3 py-2 text-sm font-semibold text-white hover:bg-black/70"
        >
          Close
        </button>
        <div className="flex h-full w-full items-center justify-center">
          <img
            src={src}
            alt={alt || ""}
            className="max-h-[90vh] max-w-[95vw] object-contain rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      </div>
    </div>
  );
}

/** Thumbnail that opens a fullscreen zoom preview on click. */
export default function ZoomableImage({
  src,
  alt = "",
  className = "",
  thumbnailClassName = "max-h-56 w-full object-contain border rounded-xl p-2 bg-white",
  showHint = true,
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  if (!src) return null;

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className={`group relative block w-full text-left rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${className}`}
        aria-label={`${alt}. Tap to zoom in`}
      >
        <img src={src} alt={alt} className={`${thumbnailClassName} ${disabled ? "" : "cursor-zoom-in"}`} />
        {showHint && !disabled ? (
          <span className="pointer-events-none absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-lg bg-slate-900/75 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
            <ZoomIn size={12} aria-hidden />
            Zoom
          </span>
        ) : null}
      </button>
      {open ? <ImageZoomLightbox src={src} alt={alt} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
