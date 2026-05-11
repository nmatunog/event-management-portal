import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, LogOut, UserCheck } from "lucide-react";
import { getEvents, getMyCheckInRegistration, selfCheckInRegistration } from "../lib/api";
import {
  DELEGATE_CHECK_IN_PHASES,
  DELEGATE_ONSITE_POSITION_OPTIONS,
  delegateAgentCode,
  delegateContactNumber,
  delegateRoomNumber,
  getAutoCheckInPhaseForToday,
  isDelegatePhaseCheckedIn,
  isHallEntryQuickCheckIn,
  isVenueRegistrationCheckIn,
  mapRegistrationFromApi,
  normalizeCheckInPhase,
  SELF_CHECK_IN_DISCLAIMER,
} from "./delegateOnsite";
import { formatPositionShort } from "./positionCodes";

function emptyDraft() {
  return {
    positionCode: "UM",
    aiaAgentCode: "",
    mobileNumber: "",
    roomNumber: "",
  };
}

function draftFromRegistration(row) {
  if (!row) return emptyDraft();
  return {
    positionCode: formatPositionShort(row.role),
    aiaAgentCode: delegateAgentCode(row),
    mobileNumber: delegateContactNumber(row),
    roomNumber: delegateRoomNumber(row),
  };
}

export default function AttendeeSelfCheckInPage({
  authEmail,
  profile,
  attendeeSyncHints,
  onLogout,
  onApiError,
  onApiInfo,
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [eventId, setEventId] = useState("");
  const [registration, setRegistration] = useState(null);
  const [checkInPhase, setCheckInPhase] = useState(() => getAutoCheckInPhaseForToday() || "venue-arrival");
  const [draft, setDraft] = useState(emptyDraft());
  const [agentCodeTouched, setAgentCodeTouched] = useState(false);
  const [loadError, setLoadError] = useState("");

  const activePhase = normalizeCheckInPhase(checkInPhase);
  const activePhaseMeta = useMemo(
    () => DELEGATE_CHECK_IN_PHASES.find((phase) => phase.id === activePhase) || DELEGATE_CHECK_IN_PHASES[0],
    [activePhase]
  );
  const autoPhase = useMemo(() => getAutoCheckInPhaseForToday(), []);
  const isQuickHallCheckIn = isHallEntryQuickCheckIn(activePhase);
  const isRegistrationCheckIn = isVenueRegistrationCheckIn(activePhase);
  const requiresAgentCode = isRegistrationCheckIn;
  const missingAgentCode = !String(draft.aiaAgentCode || "").trim();
  const showAgentCodeAlert = requiresAgentCode && missingAgentCode && (agentCodeTouched || Boolean(registration));
  const selectedPhaseCheckedIn = registration ? isDelegatePhaseCheckedIn(registration, activePhase) : false;

  const reload = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const pinned = import.meta.env.VITE_PAMACON_EVENT_ID;
      const { items } = await getEvents();
      let ev = (items || []).find((x) => String(x.title || "").includes("PAMACON"));
      if (pinned) ev = (items || []).find((x) => x.id === pinned) || ev;
      if (!ev?.id) {
        setLoadError("PAMACON event is not available yet. Try again in a moment.");
        setRegistration(null);
        setEventId("");
        return;
      }
      setEventId(ev.id);
      const res = await getMyCheckInRegistration(ev.id, {
        seededRegistrationId: attendeeSyncHints?.seededRegistrationId,
        seededDelegateName: attendeeSyncHints?.seededDelegateName,
        firstName: profile?.firstName,
        lastName: profile?.lastName,
        nickname: profile?.nickname,
      });
      const nextPhase = normalizeCheckInPhase(res?.checkInPhase || getAutoCheckInPhaseForToday() || "venue-arrival");
      setCheckInPhase(nextPhase);
      const nextRow = res?.item ? mapRegistrationFromApi(res.item) : null;
      setRegistration(nextRow);
      setDraft(draftFromRegistration(nextRow));
      setAgentCodeTouched(false);
    } catch (error) {
      setLoadError("Could not load your registration for check-in.");
      onApiError?.(error, "Could not load your registration for check-in.");
    } finally {
      setLoading(false);
    }
  }, [attendeeSyncHints, onApiError, profile?.firstName, profile?.lastName, profile?.nickname]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!autoPhase) return;
    setCheckInPhase(autoPhase);
  }, [autoPhase]);

  const handleSelfCheckIn = async () => {
    if (!eventId || !registration?.id || saving || selectedPhaseCheckedIn) return;
    if (requiresAgentCode && missingAgentCode) {
      setAgentCodeTouched(true);
      onApiError?.(new Error("Agent code required"), "Enter your AIA agent code before the May 13 venue check-in.");
      return;
    }
    setSaving(true);
    try {
      const res = await selfCheckInRegistration(eventId, {
        checkInPhase: activePhase,
        seededRegistrationId: attendeeSyncHints?.seededRegistrationId,
        seededDelegateName: attendeeSyncHints?.seededDelegateName,
        profile: {
          firstName: profile?.firstName,
          lastName: profile?.lastName,
          nickname: profile?.nickname,
        },
        ...(isQuickHallCheckIn
          ? {}
          : {
              positionCode: formatPositionShort(draft.positionCode),
              aiaAgentCode: String(draft.aiaAgentCode || "").trim(),
              mobileNumber: String(draft.mobileNumber || "").trim(),
              roomNumber: String(draft.roomNumber || "").trim(),
            }),
      });
      const nextRow = res?.item ? mapRegistrationFromApi(res.item) : registration;
      setRegistration(nextRow);
      setDraft(draftFromRegistration(nextRow));
      onApiInfo?.(`You are checked in for ${activePhaseMeta.shortLabel}.`);
    } catch (error) {
      onApiError?.(error, "Could not complete self check-in.");
    } finally {
      setSaving(false);
    }
  };

  const displayName =
    String(registration?.name || "").trim() ||
    [profile?.firstName, profile?.lastName].filter(Boolean).join(" ").trim() ||
    authEmail ||
    "Delegate";

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-red-600">PAMACON self check-in</p>
            <h1 className="text-lg font-semibold text-slate-900">Scan to check in</h1>
            <p className="text-sm text-slate-500">Signed in as {authEmail}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link to="/portal" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Open portal
            </Link>
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700"
            >
              <LogOut size={16} aria-hidden />
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <div className="mb-4 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-semibold">Note</p>
          <p className="mt-1 leading-relaxed">{SELF_CHECK_IN_DISCLAIMER}</p>
        </div>
        {loading ? (
          <div className="rounded-3xl border border-slate-200 bg-white px-6 py-16 text-center text-sm text-slate-500">Loading your registration…</div>
        ) : loadError ? (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 px-6 py-8 text-sm text-rose-900">{loadError}</div>
        ) : !registration ? (
          <div className="rounded-3xl border border-amber-200 bg-amber-50 px-6 py-8 text-sm text-amber-950 space-y-3">
            <p className="font-semibold">We could not match this account to a delegate record.</p>
            <p>Open the portal and complete your profile, or ask registration to link your booking to {authEmail}.</p>
            <Link to="/portal" className="inline-flex rounded-xl bg-amber-800 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-900">
              Go to portal
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {autoPhase ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-950">
                <p className="font-semibold">Today&apos;s check-in window: {activePhaseMeta.label}</p>
                <p className="mt-1 text-red-900/80">{activePhaseMeta.description}</p>
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                Self check-in opens on May 13 for venue arrival and May 14 for hall entry. You can still review your status below.
              </div>
            )}

            <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Delegate</p>
                <p className="text-2xl font-semibold text-slate-900 mt-1">{displayName}</p>
                {selectedPhaseCheckedIn ? (
                  <p className="mt-2 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                    <CheckCircle2 size={14} aria-hidden />
                    Checked in for {activePhaseMeta.shortLabel}
                  </p>
                ) : null}
              </div>

              {isQuickHallCheckIn ? (
                <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950 space-y-1">
                  <p className="font-semibold">{formatPositionShort(registration.role)}</p>
                  <p>{delegateAgentCode(registration) ? `Agent code ${delegateAgentCode(registration)}` : "Agent code not yet captured on May 13"}</p>
                  <p>{delegateContactNumber(registration) ? `Contact ${delegateContactNumber(registration)}` : "No contact number on file"}</p>
                  <p>{delegateRoomNumber(registration) ? `Room ${delegateRoomNumber(registration)}` : "Room can stay blank until assigned"}</p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block sm:col-span-2">
                    <span className="text-xs font-semibold text-slate-600">Position</span>
                    <select
                      value={draft.positionCode}
                      disabled={saving || selectedPhaseCheckedIn}
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
                      disabled={saving || selectedPhaseCheckedIn}
                      onChange={(e) => {
                        setAgentCodeTouched(true);
                        setDraft((prev) => ({ ...prev, aiaAgentCode: e.target.value }));
                      }}
                      placeholder="Required for May 13 venue check-in"
                      className={`mt-1.5 w-full rounded-xl border bg-white px-3 py-2.5 text-sm font-medium text-slate-800 disabled:opacity-50 ${
                        showAgentCodeAlert ? "border-amber-400 ring-1 ring-amber-200" : "border-slate-200"
                      }`}
                    />
                    {showAgentCodeAlert ? (
                      <p className="mt-1.5 text-xs font-semibold text-amber-800">Agent code is required before the May 13 venue check-in.</p>
                    ) : null}
                  </label>

                  <label className="block">
                    <span className="text-xs font-semibold text-slate-600">Contact no.</span>
                    <input
                      value={draft.mobileNumber}
                      disabled={saving || selectedPhaseCheckedIn}
                      onChange={(e) => setDraft((prev) => ({ ...prev, mobileNumber: e.target.value }))}
                      placeholder="09xx xxx xxxx"
                      className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 disabled:opacity-50"
                    />
                  </label>

                  <label className="block">
                    <span className="text-xs font-semibold text-slate-600">Room no.</span>
                    <input
                      value={draft.roomNumber}
                      disabled={saving || selectedPhaseCheckedIn}
                      onChange={(e) => setDraft((prev) => ({ ...prev, roomNumber: e.target.value }))}
                      placeholder="Optional for now"
                      className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 disabled:opacity-50"
                    />
                  </label>
                </div>
              )}

              <button
                type="button"
                disabled={!autoPhase || saving || selectedPhaseCheckedIn}
                onClick={() => void handleSelfCheckIn()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-red-600 px-4 py-3 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50"
              >
                <UserCheck size={18} aria-hidden />
                {saving
                  ? "Saving…"
                  : !autoPhase
                  ? "Check-in opens on event days"
                  : selectedPhaseCheckedIn
                  ? `Already checked in for ${activePhaseMeta.shortLabel}`
                  : isQuickHallCheckIn
                  ? "Check in for May 14"
                  : "Register and check in for May 13"}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
