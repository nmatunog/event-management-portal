import { useMemo, useState } from "react";
import { UserPlus } from "lucide-react";
import { filterDelegatesByNameQuery } from "./delegateOnsite";
import {
  PORTAL_ROLE_OPTIONS,
  portalRoleLabel,
  resolveDelegatePortalEmail,
  workingTeamRoster,
} from "./delegatePortalAccess";

export default function DelegateWorkingTeamPanel({
  registrants,
  isSuperuser,
  committeeRoles,
  committeeRolesLoading,
  superUserEmails,
  onAssignRole,
  onInfo,
  onApiError,
}) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [emailDraft, setEmailDraft] = useState("");
  const [roleDraft, setRoleDraft] = useState("staff");
  const [saving, setSaving] = useState(false);

  const roster = useMemo(() => workingTeamRoster(committeeRoles, registrants), [committeeRoles, registrants]);
  const matches = useMemo(() => filterDelegatesByNameQuery(registrants, query, { minChars: 1, limit: 8 }), [registrants, query]);

  const selected = useMemo(
    () => (registrants || []).find((row) => String(row.id) === String(selectedId)) || null,
    [registrants, selectedId]
  );

  const selectDelegate = (row) => {
    setSelectedId(String(row.id));
    setQuery(String(row.name || "").trim());
    setEmailDraft(resolveDelegatePortalEmail(row));
  };

  const handleAssign = async () => {
    if (!isSuperuser || saving) return;
    const email = String(emailDraft || "").trim().toLowerCase();
    if (!email) {
      onApiError?.(new Error("Email required"), "Enter the delegate sign-in email before assigning a portal role.");
      return;
    }
    if (superUserEmails?.has?.(email)) {
      onApiError?.(new Error("Env superuser"), "This email is already a configured superuser and keeps full admin access.");
      return;
    }
    setSaving(true);
    try {
      await onAssignRole?.(email, roleDraft, selected?.name || "");
      onInfo?.(`${email} is now ${portalRoleLabel(roleDraft)} in the portal.`);
      setQuery("");
      setSelectedId("");
      setEmailDraft("");
      setRoleDraft("staff");
    } catch (error) {
      onApiError?.(error, "Could not update portal access.");
    } finally {
      setSaving(false);
    }
  };

  if (!isSuperuser) return null;

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-5 sm:p-6 border-b border-slate-100 bg-gradient-to-br from-violet-50/70 to-white">
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-violet-700">Superuser</p>
        <h3 className="text-lg font-semibold text-slate-900 mt-1">Working team access</h3>
        <p className="text-sm text-slate-500 mt-1 max-w-3xl">
          Promote delegates to Working Team so they can help with registration, check-in, and kit distribution in this portal.
        </p>
      </div>

      <div className="p-5 sm:p-6 grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="working-team-delegate-search">
              Pick delegate
            </label>
            <input
              id="working-team-delegate-search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (!e.target.value.trim()) setSelectedId("");
              }}
              placeholder="Search by first or family name…"
              className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 focus:outline-none focus:border-violet-300"
              autoComplete="off"
            />
          </div>
          {query.trim().length >= 1 ? (
            <ul className="rounded-2xl border border-slate-200 bg-white divide-y divide-slate-100 max-h-56 overflow-y-auto">
              {matches.length ? (
                matches.map((row) => (
                  <li key={row.id}>
                    <button
                      type="button"
                      onClick={() => selectDelegate(row)}
                      className={`w-full text-left px-4 py-3 hover:bg-slate-50 ${String(row.id) === String(selectedId) ? "bg-violet-50" : ""}`}
                    >
                      <p className="font-semibold text-slate-900">{row.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {resolveDelegatePortalEmail(row) || "No portal email on file yet"}
                      </p>
                    </button>
                  </li>
                ))
              ) : (
                <li className="px-4 py-3 text-sm text-slate-500">No matches yet.</li>
              )}
            </ul>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
            <label className="block sm:col-span-2">
              <span className="text-xs font-semibold text-slate-600">Portal sign-in email</span>
              <input
                value={emailDraft}
                onChange={(e) => setEmailDraft(e.target.value)}
                placeholder="delegate@email.com"
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-800"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Portal role</span>
              <select
                value={roleDraft}
                onChange={(e) => setRoleDraft(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-800"
              >
                {PORTAL_ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-end">
              <button
                type="button"
                disabled={saving || committeeRolesLoading}
                onClick={() => void handleAssign()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-violet-800 disabled:opacity-50"
              >
                <UserPlus size={16} aria-hidden />
                {saving ? "Saving…" : "Assign access"}
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Current working team</p>
          <div className="mt-3 space-y-2 max-h-72 overflow-y-auto">
            {committeeRolesLoading ? <p className="text-sm text-slate-500">Loading roles…</p> : null}
            {!committeeRolesLoading && roster.length === 0 ? (
              <p className="text-sm text-slate-500">No Working Team or Admin assignments yet.</p>
            ) : null}
            {!committeeRolesLoading
              ? roster.map((row) => (
                  <div key={row.email} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{row.email}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {row.delegateName ? row.delegateName : "No linked delegate row"}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full border border-violet-200 bg-violet-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-violet-800">
                      {portalRoleLabel(row.role)}
                    </span>
                  </div>
                ))
              : null}
          </div>
        </div>
      </div>
    </div>
  );
}
