/** Admin: Google Drive link for attendee event photos and videos. */
export default function EventMediaSetup({ driveUrl = "", label = "", canEdit, onChange }) {
  return (
    <div className="space-y-4 rounded-2xl border border-sky-200 p-4 bg-sky-50/40">
      <h5 className="text-[10px] font-black uppercase text-sky-800 tracking-[0.2em] leading-none">
        Event photos &amp; videos (Google Drive)
      </h5>
      <p className="text-[11px] text-slate-600 leading-relaxed">
        Paste a shared Google Drive <strong>folder</strong> link (recommended) or album link. Set sharing to &quot;Anyone with the link&quot;.
        Registered delegates see an open button beside the evaluation survey in the attendee portal.
      </p>
      <label className="block space-y-1">
        <span className="text-xs font-semibold text-slate-600">Button label (optional)</span>
        <input
          disabled={!canEdit}
          value={String(label || "")}
          onChange={(e) => onChange?.({ label: e.target.value })}
          placeholder="Event photos & videos"
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 disabled:opacity-50"
        />
      </label>
      <label className="block space-y-1">
        <span className="text-xs font-semibold text-slate-600">Google Drive link</span>
        <input
          type="url"
          disabled={!canEdit}
          value={String(driveUrl || "")}
          onChange={(e) => onChange?.({ driveUrl: e.target.value.trim() })}
          placeholder="https://drive.google.com/drive/folders/..."
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 disabled:opacity-50"
        />
      </label>
    </div>
  );
}
