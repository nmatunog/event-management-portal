import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { getEvents, getRegistrations } from "../lib/api";

export default function SignInPage({
  session,
  authLoading,
  loginEmail,
  setLoginEmail,
  loginPassword,
  setLoginPassword,
  authError,
  authInfo,
  onLogin,
  onResetPassword,
  onSignUp,
  onClaimBooking,
}) {
  const navigate = useNavigate();
  const [claimLoading, setClaimLoading] = useState(false);
  const [claimError, setClaimError] = useState("");
  const [delegates, setDelegates] = useState([]);
  const [familyName, setFamilyName] = useState("");
  const [selectedDelegateId, setSelectedDelegateId] = useState("");
  const [preferredEmail, setPreferredEmail] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [claimPassword, setClaimPassword] = useState("");
  const [confirmClaimPassword, setConfirmClaimPassword] = useState("");

  useEffect(() => {
    if (session) navigate("/portal", { replace: true });
  }, [session, navigate]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pinned = import.meta.env.VITE_PAMACON_EVENT_ID;
        const { items } = await getEvents();
        let ev = (items || []).find((x) => String(x.title || "").includes("PAMACON"));
        if (pinned) ev = (items || []).find((x) => x.id === pinned) || ev;
        if (!ev?.id || cancelled) return;
        const regRes = await getRegistrations(ev.id);
        if (cancelled) return;
        const rows = (regRes.items || []).map((r) => {
          let meta = {};
          try {
            meta = r.metadata_json ? JSON.parse(r.metadata_json) : {};
          } catch {
            meta = {};
          }
          const fullName = String(r.full_name || "").trim();
          const parts = fullName.split(/\s+/).filter(Boolean);
          const lastName = String(meta.lastName || (parts.length ? parts[parts.length - 1] : "")).trim();
          const firstGuess = parts.length ? parts[0] : fullName;
          const firstName = String(meta.firstName || meta.nickname || firstGuess).trim();
          return {
            id: r.id,
            name: fullName,
            firstName,
            lastName,
          };
        });
        setDelegates(rows);
      } catch {
        setDelegates([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const familyOptions = useMemo(() => {
    const q = familyName.trim().toLowerCase();
    if (!q) return [];
    return delegates
      .filter((d) => String(d.lastName || "").toLowerCase().includes(q))
      .slice(0, 20);
  }, [delegates, familyName]);

  const selectedDelegate = useMemo(() => familyOptions.find((d) => d.id === selectedDelegateId) || null, [familyOptions, selectedDelegateId]);

  const handleClaimSubmit = async (e) => {
    e.preventDefault();
    setClaimError("");
    if (!selectedDelegate) {
      setClaimError("Please type your family name and select your name from the dropdown.");
      return;
    }
    if (!preferredEmail.trim()) {
      setClaimError("Preferred email is required.");
      return;
    }
    if (!mobileNumber.trim()) {
      setClaimError("Mobile number is required.");
      return;
    }
    if (claimPassword.length < 6) {
      setClaimError("Password must be at least 6 characters.");
      return;
    }
    if (claimPassword !== confirmClaimPassword) {
      setClaimError("Password confirmation does not match.");
      return;
    }
    setClaimLoading(true);
    const ok = await onClaimBooking?.({
      email: preferredEmail.trim(),
      password: claimPassword,
      mobileNumber: mobileNumber.trim(),
      delegate: selectedDelegate,
    });
    setClaimLoading(false);
    if (ok) {
      setFamilyName("");
      setSelectedDelegateId("");
      setPreferredEmail("");
      setMobileNumber("");
      setClaimPassword("");
      setConfirmClaimPassword("");
    }
  };

  return (
    <div className="min-h-[100dvh] bg-slate-100 flex flex-col items-center justify-center p-6">
      <Link
        to="/"
        className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-red-700 transition-colors self-start max-w-lg w-full"
      >
        <ArrowLeft size={16} aria-hidden />
        Back to home
      </Link>
      <section id="claim-seeded" className="w-full max-w-lg mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
        <p className="text-[11px] font-black uppercase tracking-wide text-amber-800">Have you paid for your slot?</p>
        <p className="mt-1 text-sm text-amber-900">Click here to confirm your booking and enter your details.</p>
        <ol className="mt-2 text-xs text-amber-900 space-y-0.5">
          <li>1) Enter your family name and pick your first name or nickname from the list.</li>
          <li>2) Fill out your attendee details.</li>
          <li>3) Enter your preferred email/mobile and create password for next logins.</li>
        </ol>
      </section>
      <form onSubmit={handleClaimSubmit} className="w-full max-w-lg mb-4 rounded-3xl border border-amber-200 bg-white p-6 space-y-3">
        <h2 className="text-base font-bold text-slate-900">Confirm booking (seeded delegate)</h2>
        <label className="block">
          <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Family name</span>
          <input
            value={familyName}
            onChange={(e) => {
              setFamilyName(e.target.value);
              setSelectedDelegateId("");
            }}
            placeholder="Type your last name"
            className="mt-1 w-full min-h-[44px] rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-amber-400"
          />
        </label>
        <label className="block">
          <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Choose your name (first name / nickname)</span>
          <select
            value={selectedDelegateId}
            onChange={(e) => setSelectedDelegateId(e.target.value)}
            className="mt-1 w-full min-h-[44px] rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-amber-400"
          >
            <option value="">Select from matching records…</option>
            {familyOptions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Preferred email</span>
            <input
              type="email"
              value={preferredEmail}
              onChange={(e) => setPreferredEmail(e.target.value)}
              className="mt-1 w-full min-h-[44px] rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-amber-400"
            />
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Mobile number</span>
            <input
              value={mobileNumber}
              onChange={(e) => setMobileNumber(e.target.value)}
              className="mt-1 w-full min-h-[44px] rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-amber-400"
            />
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Create password</span>
            <input
              type="password"
              value={claimPassword}
              onChange={(e) => setClaimPassword(e.target.value)}
              className="mt-1 w-full min-h-[44px] rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-amber-400"
            />
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Confirm password</span>
            <input
              type="password"
              value={confirmClaimPassword}
              onChange={(e) => setConfirmClaimPassword(e.target.value)}
              className="mt-1 w-full min-h-[44px] rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-amber-400"
            />
          </label>
        </div>
        {claimError && <p className="text-sm text-rose-600 font-semibold">{claimError}</p>}
        <button
          type="submit"
          disabled={claimLoading || authLoading}
          className="w-full bg-amber-600 hover:bg-amber-700 text-white rounded-xl py-3 text-sm font-black uppercase tracking-wide disabled:opacity-50 min-h-[48px]"
        >
          {claimLoading || authLoading ? "Please wait..." : "Confirm booking and create account"}
        </button>
      </form>
      <form onSubmit={onLogin} className="w-full max-w-lg bg-white rounded-3xl shadow-2xl p-8 space-y-4 border border-slate-200">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 bg-red-600 rounded-xl flex items-center justify-center font-black text-lg text-white">PA</div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">Sign in</h1>
            <p className="text-xs text-slate-500 font-semibold">Delegates and committee use the same secure login</p>
          </div>
        </div>
        <label className="block">
          <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Email</span>
          <input
            value={loginEmail}
            onChange={(e) => setLoginEmail(e.target.value)}
            type="email"
            required
            autoComplete="email"
            className="mt-1 w-full min-h-[44px] rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-red-400"
          />
        </label>
        <label className="block">
          <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Password</span>
          <input
            value={loginPassword}
            onChange={(e) => setLoginPassword(e.target.value)}
            type="password"
            required
            autoComplete="current-password"
            className="mt-1 w-full min-h-[44px] rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-red-400"
          />
        </label>
        {authError && <p className="text-sm text-rose-600 font-semibold">{authError}</p>}
        {authInfo && <p className="text-sm text-emerald-700 font-semibold">{authInfo}</p>}
        <button
          type="button"
          disabled={authLoading}
          onClick={onResetPassword}
          className="w-full border border-slate-200 text-slate-700 rounded-xl py-2.5 text-sm font-bold hover:bg-slate-50 disabled:opacity-50 min-h-[44px]"
        >
          Forgot password?
        </button>
        <button
          type="button"
          disabled={authLoading}
          onClick={onSignUp}
          className="w-full border border-slate-200 text-slate-700 rounded-xl py-2.5 text-sm font-bold hover:bg-slate-50 disabled:opacity-50 min-h-[44px]"
        >
          Create account (join)
        </button>
        <button
          disabled={authLoading}
          className="w-full bg-red-600 hover:bg-red-700 text-white rounded-xl py-3 font-black uppercase tracking-wide disabled:opacity-50 min-h-[48px]"
        >
          {authLoading ? "Please wait..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}
