import { useState } from "react";
import { Upload, X } from "lucide-react";
import { reencodeImageDataUrlAsJpeg } from "../lib/imageCompress";

/** Optional supplier official receipt (image). */
export default function ReceiptUpload({ value = "", onChange, disabled = false, label = "Upload official receipt (optional)" }) {
  const [busy, setBusy] = useState(false);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    setBusy(true);
    try {
      const raw = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const compact = await reencodeImageDataUrlAsJpeg(raw, 1280, 0.82);
      onChange?.(compact);
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <span className="block text-[10px] font-black uppercase text-slate-400">{label}</span>
      {value ? (
        <div className="relative rounded-2xl border bg-white p-3">
          <img src={value} alt="Receipt preview" className="max-h-48 mx-auto object-contain" />
          {!disabled ? (
            <button
              type="button"
              onClick={() => onChange?.("")}
              className="absolute top-2 right-2 rounded-full bg-slate-900/80 text-white p-1.5"
              title="Remove receipt"
            >
              <X size={14} />
            </button>
          ) : null}
        </div>
      ) : (
        <label
          className={`flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-6 ${
            disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:border-blue-300 hover:bg-blue-50/40"
          }`}
        >
          <Upload className="text-slate-400" size={24} aria-hidden />
          <span className="text-xs font-black uppercase text-slate-600">{busy ? "Processing…" : "PNG or JPG"}</span>
          <input type="file" accept="image/*" className="sr-only" disabled={disabled || busy} onChange={(e) => void handleFile(e)} />
        </label>
      )}
    </div>
  );
}
