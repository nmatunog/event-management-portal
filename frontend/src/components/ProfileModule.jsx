import { useEffect, useMemo, useState } from "react";
import { Edit3, Save, X } from "lucide-react";

const POSITION_OPTIONS = [
  { value: "DD", label: "District Director (DD)" },
  { value: "AD", label: "Agency Director (AD)" },
  { value: "SUM", label: "Senior Unit Manager (SUM)" },
  { value: "UM", label: "Unit Manager (UM)" },
];

function toDraft(profile) {
  return {
    lastName: profile?.lastName || "",
    firstName: profile?.firstName || "",
    middleName: profile?.middleName || "",
    mobileNumber: profile?.mobileNumber || "",
    positionCode: profile?.positionCode || "UM",
  };
}

export default function ProfileModule({ profile, onSave, saving = false, title = "Profile" }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => toDraft(profile));
  const positionLabel = useMemo(
    () => POSITION_OPTIONS.find((x) => x.value === (profile?.positionCode || "UM"))?.label || "Unit Manager (UM)",
    [profile?.positionCode]
  );

  useEffect(() => {
    if (!editing) setDraft(toDraft(profile));
  }, [profile, editing]);

  const commit = async () => {
    await onSave?.(draft);
    setEditing(false);
  };

  return (
    <section className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        {!editing ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Edit3 size={16} /> Edit profile
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                setDraft(toDraft(profile));
                setEditing(false);
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <X size={16} /> Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={commit}
              className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            >
              <Save size={16} /> {saving ? "Saving..." : "Save"}
            </button>
          </div>
        )}
      </div>

      {!editing ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <Field label="Last Name" value={profile?.lastName} />
          <Field label="First Name" value={profile?.firstName} />
          <Field label="Middle Name" value={profile?.middleName} />
          <Field label="Mobile Number" value={profile?.mobileNumber} />
          <Field label="Position" value={positionLabel} />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <Input label="Last Name" value={draft.lastName} onChange={(v) => setDraft((s) => ({ ...s, lastName: v }))} />
          <Input label="First Name" value={draft.firstName} onChange={(v) => setDraft((s) => ({ ...s, firstName: v }))} />
          <Input label="Middle Name" value={draft.middleName} onChange={(v) => setDraft((s) => ({ ...s, middleName: v }))} />
          <Input label="Mobile Number" value={draft.mobileNumber} onChange={(v) => setDraft((s) => ({ ...s, mobileNumber: v }))} />
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Position</p>
            <select
              value={draft.positionCode}
              onChange={(e) => setDraft((s) => ({ ...s, positionCode: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700"
            >
              {POSITION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </section>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700">{value || "Not set"}</p>
    </div>
  );
}

function Input({ label, value, onChange }) {
  return (
    <label className="space-y-1">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-red-400 focus:outline-none"
      />
    </label>
  );
}
