import { Plus, Trash2 } from "lucide-react";
import { emptySpeakerMaterialRow, SPEAKER_MATERIALS_MAX } from "./speakerMaterials";

/** Admin UI in Setup → paste Google Drive links for attendee portal. */
export default function SpeakerMaterialsSetup({ rows = [], canEdit, onChange }) {
  const list = Array.isArray(rows) ? rows : [];

  return (
    <div className="space-y-4 rounded-2xl border border-violet-200 p-4 bg-violet-50/40">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h5 className="text-[10px] font-black uppercase text-violet-800 tracking-[0.2em] leading-none">
          Extra materials (Google Drive — optional)
        </h5>
        <button
          type="button"
          disabled={!canEdit || list.length >= SPEAKER_MATERIALS_MAX}
          onClick={() => onChange?.([...list, emptySpeakerMaterialRow()])}
          className="inline-flex items-center gap-1.5 rounded-xl bg-violet-700 px-3 py-1.5 text-[10px] font-black uppercase text-white hover:bg-violet-800 disabled:opacity-40"
        >
          <Plus size={14} aria-hidden />
          Add link
        </button>
      </div>
      <p className="text-[11px] text-slate-600 leading-relaxed">
        For talks on the schedule, use <strong>Program → Program Modules</strong> and add a Drive link on each row. Use this section only for extra
        materials not tied to a program slot. Set sharing to &quot;Anyone with the link&quot;.
      </p>
      {list.length === 0 ? (
        <p className="text-sm text-slate-500 italic">No speaker materials yet.</p>
      ) : (
        <div className="space-y-4">
          {list.map((row, idx) => (
            <div key={row.id || idx} className="rounded-xl border border-violet-100 bg-white p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-black uppercase text-slate-400">Item {idx + 1}</span>
                <button
                  type="button"
                  disabled={!canEdit}
                  onClick={() => onChange?.(list.filter((_, i) => i !== idx))}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"
                  title="Remove"
                >
                  <Trash2 size={16} aria-hidden />
                </button>
              </div>
              <label className="block space-y-1">
                <span className="text-xs font-semibold text-slate-600">Title (e.g. Talk 1 — slides)</span>
                <input
                  disabled={!canEdit}
                  value={String(row.title || "")}
                  onChange={(e) => {
                    const next = list.map((r, i) => (i === idx ? { ...r, title: e.target.value } : r));
                    onChange?.(next);
                  }}
                  placeholder="Speaker notes / PDF title"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 disabled:opacity-50"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-semibold text-slate-600">View link (Google Drive)</span>
                <input
                  type="url"
                  disabled={!canEdit}
                  value={String(row.viewUrl ?? row.url ?? "")}
                  onChange={(e) => {
                    const next = list.map((r, i) =>
                      i === idx ? { ...r, viewUrl: e.target.value.trim(), url: undefined } : r
                    );
                    onChange?.(next);
                  }}
                  placeholder="https://drive.google.com/file/d/.../view"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 disabled:opacity-50"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-semibold text-slate-600">Download link (optional)</span>
                <input
                  type="url"
                  disabled={!canEdit}
                  value={String(row.downloadUrl || "")}
                  onChange={(e) => {
                    const next = list.map((r, i) => (i === idx ? { ...r, downloadUrl: e.target.value.trim() } : r));
                    onChange?.(next);
                  }}
                  placeholder="Leave blank to use view link for both buttons"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 disabled:opacity-50"
                />
              </label>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
