import { useCallback, useEffect, useState } from "react";
import { FileText, Trash2, Upload } from "lucide-react";
import { deleteSpeakerMaterialUpload, getSpeakerMaterials, uploadSpeakerMaterialPdf } from "../lib/api";
import { SPEAKER_MATERIALS_MAX } from "./speakerMaterials";

const MAX_PDF_MB = 5;

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Could not read PDF file."));
    reader.readAsDataURL(file);
  });
}

export default function SpeakerMaterialsUploadPanel({ eventId, canEdit, onInfo, onError }) {
  const [title, setTitle] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const reload = useCallback(async () => {
    if (!eventId) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await getSpeakerMaterials(eventId);
      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch (e) {
      onError?.(e, "Could not load presentation copies.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [eventId, onError]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const uploads = items.filter((row) => row.source === "upload");
  const driveLinks = items.filter((row) => row.source !== "upload");
  const atLimit = items.length >= SPEAKER_MATERIALS_MAX;

  const handleFile = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !canEdit || !eventId) return;
    void (async () => {
      const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
      if (!isPdf) {
        onError?.(new Error("Invalid file"), "Please choose a PDF file.");
        return;
      }
      if (file.size > MAX_PDF_MB * 1024 * 1024) {
        onError?.(new Error("File too large"), `PDF must be ${MAX_PDF_MB} MB or smaller.`);
        return;
      }
      if (atLimit) {
        onError?.(new Error("Limit reached"), `Maximum of ${SPEAKER_MATERIALS_MAX} presentation files per event.`);
        return;
      }
      setUploading(true);
      try {
        const dataUrl = await readFileAsDataUrl(file);
        if (typeof dataUrl !== "string") throw new Error("Could not read PDF file.");
        const res = await uploadSpeakerMaterialPdf(eventId, {
          title: title.trim() || file.name.replace(/\.pdf$/i, "") || "Presentation",
          fileName: file.name,
          dataBase64: dataUrl,
        });
        setItems(Array.isArray(res?.items) ? res.items : []);
        setTitle("");
        onInfo?.("Presentation PDF uploaded. Registered delegates can view it in the attendee portal.");
      } catch (e) {
        onError?.(e, "Could not upload PDF.");
      } finally {
        setUploading(false);
      }
    })();
  };

  const removeUpload = async (fileId) => {
    if (!canEdit || !eventId || !fileId) return;
    if (!window.confirm("Remove this uploaded PDF from the attendee portal?")) return;
    try {
      const res = await deleteSpeakerMaterialUpload(eventId, fileId);
      setItems(Array.isArray(res?.items) ? res.items : []);
      onInfo?.("Upload removed.");
    } catch (e) {
      onError?.(e, "Could not remove upload.");
    }
  };

  return (
    <div className="bg-white p-8 rounded-[40px] border-2 border-violet-200 shadow-sm space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4 min-w-0">
          <div className="w-14 h-14 bg-violet-50 rounded-2xl flex items-center justify-center text-violet-700 shrink-0">
            <Upload size={28} aria-hidden />
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-black uppercase text-slate-800 tracking-tight">Upload presentation copies</h3>
            <p className="text-sm text-slate-600 mt-1 max-w-2xl leading-relaxed">
              For large decks, prefer <strong>Program → Program Modules</strong> and paste a Google Drive view link on each session row. Use this upload
              only for smaller PDFs (max {MAX_PDF_MB} MB). Registered delegates need sign-in and a matched registration.
            </p>
          </div>
        </div>
        {loading ? <span className="text-xs font-semibold text-slate-400">Loading…</span> : null}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="block space-y-1.5">
          <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Title (optional)</span>
          <input
            type="text"
            disabled={!canEdit || uploading}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Day 1 keynote — slides"
            className="w-full rounded-2xl border-2 border-slate-100 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 disabled:opacity-50"
          />
        </label>
        <label className="flex flex-col justify-end">
          <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1.5">PDF file</span>
          <span className="inline-flex min-h-[48px] cursor-pointer items-center justify-center gap-2 rounded-2xl bg-violet-700 px-5 py-3 text-sm font-black uppercase text-white hover:bg-violet-800 disabled:opacity-40">
            <Upload size={18} aria-hidden />
            {uploading ? "Uploading…" : "Choose PDF"}
            <input
              type="file"
              accept="application/pdf,.pdf"
              className="sr-only"
              disabled={!canEdit || uploading || atLimit}
              onChange={handleFile}
            />
          </span>
        </label>
      </div>

      {atLimit ? (
        <p className="text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
          Event limit reached ({SPEAKER_MATERIALS_MAX} files). Remove an upload or a Setup link before adding more.
        </p>
      ) : null}

      <div className="space-y-3">
        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Uploaded PDFs ({uploads.length})</p>
        {uploads.length === 0 ? (
          <p className="text-sm text-slate-500 italic">No PDF uploads yet.</p>
        ) : (
          <ul className="space-y-2">
            {uploads.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-violet-100 bg-violet-50/50 px-4 py-3"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="text-violet-600 shrink-0" size={18} aria-hidden />
                  <span className="text-sm font-bold text-slate-800 truncate">{row.title}</span>
                  <span className="text-[10px] font-black uppercase text-violet-700 bg-white px-2 py-0.5 rounded-full border border-violet-200">
                    PDF
                  </span>
                </div>
                <button
                  type="button"
                  disabled={!canEdit}
                  onClick={() => void removeUpload(row.fileId)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-40"
                >
                  <Trash2 size={14} aria-hidden />
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {driveLinks.length > 0 ? (
        <p className="text-xs text-slate-500">
          {driveLinks.length} Google Drive link{driveLinks.length === 1 ? "" : "s"} from Setup are also published to delegates.
        </p>
      ) : null}
    </div>
  );
}
