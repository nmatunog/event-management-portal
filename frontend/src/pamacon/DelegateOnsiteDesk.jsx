import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Search, UserCheck } from "lucide-react";
import {
  countDelegatesPhaseCheckedIn,
  DELEGATE_CHECK_IN_PHASES,
  DELEGATE_ONSITE_POSITION_OPTIONS,
  delegateAgentCode,
  delegateContactNumber,
  delegateRoomNumber,
  filterDelegatesByNameQuery,
  getAutoCheckInPhaseForToday,
  getCheckInPhaseForToday,
  isDelegatePhaseCheckedIn,
  isHallEntryQuickCheckIn,
  isVenueRegistrationCheckIn,
  normalizeCheckInPhase,
} from "./delegateOnsite";
import ClaimConfirmationFields from "./ClaimConfirmationFields";
import { formatPositionShort } from "./positionCodes";

function emptyDraft() {
  return {
    positionCode: "UM",
    aiaAgentCode: "",
    mobileNumber: "",
    roomNumber: "",
    conferenceKitClaimed: false,
    tshirtClaimed: false,
  };
}

function draftFromDelegate(row) {
  if (!row) return emptyDraft();
  return {
    positionCode: formatPositionShort(row.role),
    aiaAgentCode: delegateAgentCode(row),
    mobileNumber: delegateContactNumber(row),
    roomNumber: delegateRoomNumber(row),
    conferenceKitClaimed: Boolean(row.conferenceKitClaimed),
    tshirtClaimed: Boolean(row.tshirtClaimed),
  };
}

export default function DelegateOnsiteDesk({ registrants, canEdit, authEmail, onSaveCheckIn, onInfo, onApiError }) {
  const [checkInPhase, setCheckInPhase] = useState(() => getCheckInPhaseForToday());
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState(emptyDraft());
  const [saving, setSaving] = useState(false);
  const [agentCodeTouched, setAgentCodeTouched] = useState(false);

  const autoPhase = useMemo(() => getAutoCheckInPhaseForToday(), []);
  const activePhase = normalizeCheckInPhase(checkInPhase);
  const activePhaseMeta = useMemo(
    () => DELEGATE_CHECK_IN_PHASES.find((phase) => phase.id === activePhase) || DELEGATE_CHECK_IN_PHASES[0],
    [activePhase]
  );

  useEffect(() => {
    if (!autoPhase) return;
    setCheckInPhase(autoPhase);
  }, [autoPhase]);

  const selected = useMemo(
    () => (registrants || []).find((row) => String(row.id) === String(selectedId)) || null,
    [registrants, selectedId]
  );

  const matches = useMemo(() => filterDelegatesByNameQuery(registrants, query, { minChars: 1, limit: 10 }), [registrants, query]);

  const phaseCounts = useMemo(
    () =>
      Object.fromEntries(
        DELEGATE_CHECK_IN_PHASES.map((phase) => [phase.id, countDelegatesPhaseCheckedIn(registrants, phase.id)])
      ),
    [registrants]
  );

  const selectedPhaseCheckedIn = selected ? isDelegatePhaseCheckedIn(selected, activePhase) : false;
  const isQuickHallCheckIn = isHallEntryQuickCheckIn(activePhase);
  const isRegistrationCheckIn = isVenueRegistrationCheckIn(activePhase);
  const requiresAgentCode = isRegistrationCheckIn;
  const missingAgentCode = !String(draft.aiaAgentCode || "").trim();
  const showAgentCodeAlert = requiresAgentCode && missingAgentCode && (agentCodeTouched || Boolean(selected));

  useEffect(() => {
    if (!selected) return;
    setDraft(draftFromDelegate(selected));
    setAgentCodeTouched(false);
  }, [selected?.id]);

  const selectDelegate = (row) => {
    setSelectedId(String(row.id));
    setDraft(draftFromDelegate(row));
    setAgentCodeTouched(false);
    setQuery(String(row.name || "").trim());
  };

  const handleSaveCheckIn = async () => {
    if (!canEdit || !selected || saving) return;
    if (requiresAgentCode && missingAgentCode) {
      setAgentCodeTouched(true);
      onApiError?.(new Error("Agent code required"), "Enter the AIA agent code before the May 13 venue check-in.");
      return;
    }
    setSaving(true);
    try {
      await onSaveCheckIn?.(
        selected,
        isQuickHallCheckIn
          ? {
              checkInPhase: activePhase,
              conferenceKitClaimed: Boolean(draft.conferenceKitClaimed),
              tshirtClaimed: Boolean(draft.tshirtClaimed),
              checkedInBy: String(authEmail || "").trim(),
            }
          : {
              ...draft,
              checkInPhase: activePhase,
              positionCode: formatPositionShort(draft.positionCode),
              aiaAgentCode: String(draft.aiaAgentCode || "").trim(),
              mobileNumber: String(draft.mobileNumber || "").trim(),
              roomNumber: String(draft.roomNumber || "").trim(),
              conferenceKitClaimed: Boolean(draft.conferenceKitClaimed),
              tshirtClaimed: Boolean(draft.tshirtClaimed),
              checkedInBy: String(authEmail || "").trim(),
            }
      );
      onInfo?.(`${selected.name} checked in for ${activePhaseMeta.shortLabel}.`);
      setSelectedId("");
      setQuery("");
      setDraft(emptyDraft());
      setAgentCodeTouched(false);
    } catch (error) {
      onApiError?.(error, "Could not save onsite registration.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div id="pamacon-onsite-desk" className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-5 sm:p-6 border-b border-slate-100 bg-gradient-to-br from-slate-50 to-white space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-red-600">Onsite desk</p>
            <h3 className="text-lg font-semibold text-slate-900 mt-1">Check-in and registration</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-2xl">
              This desk follows the Manila event calendar. On May 13, register and check in with full details. On May 14, use the same desk for quick hall check-in only.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {DELEGATE_CHECK_IN_PHASES.map((phase) => (
              <div key={phase.id} className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 min-w-[150px]">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700/80">{phase.shortLabel}</p>
                <p className="text-2xl font-semibold text-emerald-900 tabular-nums">{phaseCounts[phase.id] || 0}</p>
                <p className="text-[11px] text-emerald-800/80">of {(registrants || []).length} delegates</p>
              </div>
            ))}
          </div>
        </div>

        {autoPhase ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-950">
            <p className="font-semibold">Today&apos;s check-in window: {activePhaseMeta.label}</p>
            <p className="mt-1 text-red-900/80">{activePhaseMeta.description}</p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {DELEGATE_CHECK_IN_PHASES.map((phase) => (
                <button
                  key={phase.id}
                  type="button"
                  onClick={() => setCheckInPhase(phase.id)}
                  className={`rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wide border ${
                    activePhase === phase.id
                      ? "border-red-300 bg-red-50 text-red-700"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {phase.label}
                </button>
              ))}
            </div>
            <p className="text-sm text-slate-500">{activePhaseMeta.description}</p>
          </>
        )}
      </div>

      <div className="p-5 sm:p-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="space-y-3">
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="onsite-delegate-search">
            Find delegate
          </label>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
            <input
              id="onsite-delegate-search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (!e.target.value.trim()) setSelectedId("");
              }}
              placeholder="Start with last or first name…"
              className="w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-4 py-3 text-sm font-medium text-slate-800 focus:outline-none focus:border-red-300"
              autoComplete="off"
            />
          </div>
          {query.trim().length >= 1 ? (
            <ul className="rounded-2xl border border-slate-200 bg-white divide-y divide-slate-100 max-h-64 overflow-y-auto">
              {matches.length ? (
                matches.map((row) => {
                  const active = String(row.id) === String(selectedId);
                  const venueCheckedIn = isDelegatePhaseCheckedIn(row, "venue-arrival");
                  const hallCheckedIn = isDelegatePhaseCheckedIn(row, "hall-entry");
                  return (
                    <li key={row.id}>
                      <button
                        type="button"
                        onClick={() => selectDelegate(row)}
                        className={`w-full text-left px-4 py-3 hover:bg-slate-50 ${active ? "bg-red-50" : ""}`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 truncate">{row.name}</p>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {formatPositionShort(row.role)}
                              {delegateAgentCode(row) ? ` · ${delegateAgentCode(row)}` : " · Agent code missing"}
                            </p>
                          </div>
                          <div className="shrink-0 flex flex-col items-end gap-1">
                            {venueCheckedIn ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700 border border-emerald-200">
                                <CheckCircle2 size={12} aria-hidden />
                                May 13
                              </span>
                            ) : null}
                            {hallCheckedIn ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-sky-700 border border-sky-200">
                                <CheckCircle2 size={12} aria-hidden />
                                May 14
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })
              ) : (
                <li className="px-4 py-3 text-sm text-slate-500">No matches yet.</li>
              )}
            </ul>
          ) : (
            <p className="text-xs text-slate-500">Predictive matches appear after the first letter.</p>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5 space-y-4">
          {selected ? (
            <>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Selected delegate</p>
                <p className="text-lg font-semibold text-slate-900 mt-1">{selected.name}</p>
                {selectedPhaseCheckedIn ? (
                  <p className="text-xs text-emerald-700 mt-1">
                    {isQuickHallCheckIn
                      ? `Already checked in for ${activePhaseMeta.shortLabel}.`
                      : `Already checked in for ${activePhaseMeta.shortLabel}. Saving updates details and claim status.`}
                  </p>
                ) : isQuickHallCheckIn ? (
                  <p className="text-xs text-slate-600 mt-1">May 14 hall check-in only. Registration details from May 13 stay on file.</p>
                ) : null}
              </div>

              {isQuickHallCheckIn ? (
                <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950 space-y-1">
                  <p className="font-semibold">{formatPositionShort(selected.role)}</p>
                  <p>{delegateAgentCode(selected) ? `Agent code ${delegateAgentCode(selected)}` : "Agent code not yet captured on May 13"}</p>
                  <p>{delegateContactNumber(selected) ? `Contact ${delegateContactNumber(selected)}` : "No contact number on file"}</p>
                  <p>{delegateRoomNumber(selected) ? `Room ${delegateRoomNumber(selected)}` : "Room can stay blank until assigned"}</p>
                </div>
              ) : (
              <>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block sm:col-span-2">
                  <span className="text-xs font-semibold text-slate-600">Position</span>
                  <select
                    value={draft.positionCode}
                    disabled={!canEdit || saving}
                    onChange={(e) => setDraft((prev) => ({ ...prev, positionCode: e.target.value }))}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 disabled:opacity-50"
                  >
                    {DELEGATE_ONSITE_POSITION_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block sm:col-span-2">
                  <span className="text-xs font-semibold text-slate-600">AIA agent code</span>
                  <input
                    value={draft.aiaAgentCode}
                    disabled={!canEdit || saving}
                    onChange={(e) => {
                      setAgentCodeTouched(true);
                      setDraft((prev) => ({ ...prev, aiaAgentCode: e.target.value }));
                    }}
                    placeholder={requiresAgentCode ? "Required for May 13 venue check-in" : "Optional for hall entry"}
                    className={`mt-1.5 w-full rounded-xl border bg-white px-3 py-2.5 text-sm font-medium text-slate-800 disabled:opacity-50 ${
                      showAgentCodeAlert ? "border-amber-400 ring-1 ring-amber-200" : "border-slate-200"
                    }`}
                  />
                  {showAgentCodeAlert ? (
                    <p className="mt-1.5 text-xs font-semibold text-amber-800">Agent code is required before the May 13 venue check-in.</p>
                  ) : delegateAgentCode(selected) ? (
                    <p className="mt-1.5 text-xs text-slate-500">Loaded from the delegate record.</p>
                  ) : null}
                </label>

                <label className="block">
                  <span className="text-xs font-semibold text-slate-600">Contact no.</span>
                  <input
                    value={draft.mobileNumber}
                    disabled={!canEdit || saving}
                    onChange={(e) => setDraft((prev) => ({ ...prev, mobileNumber: e.target.value }))}
                    placeholder="09xx xxx xxxx"
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 disabled:opacity-50"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-semibold text-slate-600">Room no.</span>
                  <input
                    value={draft.roomNumber}
                    disabled={!canEdit || saving}
                    onChange={(e) => setDraft((prev) => ({ ...prev, roomNumber: e.target.value }))}
                    placeholder="Optional for now"
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 disabled:opacity-50"
                  />
                </label>
              </div>

              </>
              )}

              <ClaimConfirmationFields
                draft={draft}
                disabled={!canEdit || saving}
                onChange={(next) => setDraft((prev) => ({ ...prev, ...next }))}
              />

              <button
                type="button"
                disabled={!canEdit || saving || (isQuickHallCheckIn && selectedPhaseCheckedIn)}
                onClick={() => void handleSaveCheckIn()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-red-600 px-4 py-3 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50"
              >
                <UserCheck size={18} aria-hidden />
                {saving
                  ? "Saving…"
                  : isQuickHallCheckIn
                  ? selectedPhaseCheckedIn
                    ? "Already checked in for May 14"
                    : "Check in for May 14"
                  : selectedPhaseCheckedIn
                  ? `Save updates for ${activePhaseMeta.shortLabel}`
                  : `Register and check in for ${activePhaseMeta.shortLabel}`}
              </button>
            </>
          ) : (
            <div className="h-full min-h-[220px] flex items-center justify-center text-sm text-slate-500 text-center px-4">
              Select a delegate from the matches list to open the quick registration form.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
