export default function ClaimConfirmationFields({ draft, onChange, disabled = false }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 space-y-3">
      <p className="text-sm font-semibold text-slate-800">Have you claimed your:</p>
      <label className="flex items-start gap-3 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={Boolean(draft.conferenceKitClaimed)}
          disabled={disabled}
          onChange={(e) => onChange({ conferenceKitClaimed: e.target.checked })}
          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-300 disabled:opacity-50"
        />
        <span>1) Conference Kit</span>
      </label>
      <label className="flex items-start gap-3 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={Boolean(draft.tshirtClaimed)}
          disabled={disabled}
          onChange={(e) => onChange({ tshirtClaimed: e.target.checked })}
          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-300 disabled:opacity-50"
        />
        <span>2) Conference T-Shirt</span>
      </label>
    </div>
  );
}
