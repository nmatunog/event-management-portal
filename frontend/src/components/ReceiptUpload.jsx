import { useState } from "react";
import { Upload, X } from "lucide-react";
import { reencodeImageDataUrlAsJpeg } from "../lib/imageCompress";
import { normalizeReceiptImages } from "../lib/receiptImages";

const DEFAULT_MAX = 8;

/** Optional supplier official receipt images (one or more). */
export default function ReceiptUpload({
  value = [],
  onChange,
  disabled = false,
  label = "Upload official receipt (optional)",
  maxImages = DEFAULT_MAX,
}) {
  const [busy, setBusy] = useState(false);
  const images = normalizeReceiptImages(value);
  const atLimit = images.length >= maxImages;

  const processFiles = async (fileList) => {
    const files = [...(fileList || [])].filter((f) => f.type.startsWith("image/"));
    if (!files.length) return;
    const slots = maxImages - images.length;
    if (slots <= 0) return;

    setBusy(true);
    try {
      const added = [];
      for (const file of files.slice(0, slots)) {
        const raw = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ""));
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        const compact = await reencodeImageDataUrlAsJpeg(raw, 1280, 0.82);
        added.push(compact);
      }
      if (added.length) onChange?.([...images, ...added]);
    } finally {
      setBusy(false);
    }
  };

  const removeAt = (index) => {
    onChange?.(images.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      <span className="block text-[10px] font-black uppercase text-slate-400">{label}</span>
      {images.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {images.map((url, index) => (
            <div key={`${index}-${url.slice(0, 32)}`} className="relative rounded-2xl border bg-white p-2">
              <img src={url} alt={`Receipt ${index + 1}`} className="max-h-36 w-full object-contain" />
              {!disabled ? (
                <button
                  type="button"
                  onClick={() => removeAt(index)}
                  className="absolute top-1.5 right-1.5 rounded-full bg-slate-900/80 text-white p-1.5"
                  title="Remove image"
                  aria-label={`Remove receipt image ${index + 1}`}
                >
                  <X size={14} />
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
      {!disabled && !atLimit ? (
        <label
          className={`flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-6 ${
            busy ? "opacity-60 cursor-wait" : "cursor-pointer hover:border-blue-300 hover:bg-blue-50/40"
          }`}
        >
          <Upload className="text-slate-400" size={24} aria-hidden />
          <span className="text-xs font-black uppercase text-slate-600 text-center">
            {busy ? "Processing…" : images.length ? "Add more images" : "PNG or JPG — select one or more"}
          </span>
          {images.length > 0 ? (
            <span className="text-[10px] font-semibold text-slate-500">
              {images.length} of {maxImages}
            </span>
          ) : null}
          <input
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            disabled={busy}
            onChange={(e) => {
              void processFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
      ) : null}
      {atLimit ? <p className="text-[10px] font-semibold text-slate-500">Maximum {maxImages} images.</p> : null}
    </div>
  );
}
