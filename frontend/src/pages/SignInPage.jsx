import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
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
  const location = useLocation();
  const [claimLoading, setClaimLoading] = useState(false);
  const [claimError, setClaimError] = useState("");
  const [delegates, setDelegates] = useState([]);
  const [familyName, setFamilyName] = useState("");
  const [selectedDelegateId, setSelectedDelegateId] = useState("");
  const [preferredEmail, setPreferredEmail] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [claimPassword, setClaimPassword] = useState("");
  const [confirmClaimPassword, setConfirmClaimPassword] = useState("");
  const [showClaimPassword, setShowClaimPassword] = useState(false);
  const [showConfirmClaimPassword, setShowConfirmClaimPassword] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [claimCompleted, setClaimCompleted] = useState(false);
  const [showClaimCard, setShowClaimCard] = useState(false);
  const [showClaimQuestion, setShowClaimQuestion] = useState(false);
  const [signInTried, setSignInTried] = useState(false);
  useEffect(() => {
    if (!signInTried) return;
    const wrongPw = /invalid login credentials|invalid email or password|invalid credentials/i.test(String(authError || ""));
    setShowClaimQuestion(wrongPw);
  }, [authError, signInTried]);


  const postSignInPath = useMemo(() => {
    const next = new URLSearchParams(location.search).get("next");
    if (!next || !next.startsWith("/") || next.startsWith("//")) return "/portal";
    return next;
  }, [location.search]);

  const isEvaluationSignIn = postSignInPath === "/evaluation";

  useEffect(() => {
    if (session) navigate(postSignInPath, { replace: true });
  }, [session, navigate, postSignInPath]);

  useEffect(() => {
    if (location.hash === "#claim-seeded") {
      setShowClaimCard(true);
      window.requestAnimationFrame(() => {
        const el = document.getElementById("claim-seeded");
        el?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } else {
      setShowClaimCard(false);
    }
  }, [location.hash]);

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
      setClaimCompleted(true);
      setFamilyName("");
      setSelectedDelegateId("");
      setPreferredEmail("");
      setMobileNumber("");
      setClaimPassword("");
      setConfirmClaimPassword("");
      window.requestAnimationFrame(() => {
        const el = document.getElementById("sign-in-card");
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    }
  };

  const handleSignInSubmit = async (e) => {
    setSignInTried(true);
    const ok = await onLogin?.(e);
    if (ok) {
      setShowClaimQuestion(false);
      setSignInTried(false);
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
      {isEvaluationSignIn ? (
        <section className="w-full max-w-lg mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-[11px] font-black uppercase tracking-wide text-red-800">Conference evaluation</p>
          <p className="mt-1 text-sm text-red-950 leading-relaxed">
            Sign-in is optional. You can{" "}
            <Link to="/evaluation" className="font-semibold underline hover:text-red-800">
              open the evaluation survey without an account
            </Link>{" "}
            by entering your first and family name.
          </p>
        </section>
      ) : null}
      {!claimCompleted && showClaimCard && (
        <>
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
                <div className="mt-1 flex items-center rounded-xl border border-slate-200 focus-within:border-amber-400">
                  <input
                    type={showClaimPassword ? "text" : "password"}
                    value={claimPassword}
                    onChange={(e) => setClaimPassword(e.target.value)}
                    className="w-full min-h-[44px] rounded-l-xl px-4 py-3 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowClaimPassword((prev) => !prev)}
                    className="mr-1 rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-slate-600 hover:bg-amber-50"
                  >
                    {showClaimPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </label>
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Confirm password</span>
                <div className="mt-1 flex items-center rounded-xl border border-slate-200 focus-within:border-amber-400">
                  <input
                    type={showConfirmClaimPassword ? "text" : "password"}
                    value={confirmClaimPassword}
                    onChange={(e) => setConfirmClaimPassword(e.target.value)}
                    className="w-full min-h-[44px] rounded-l-xl px-4 py-3 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmClaimPassword((prev) => !prev)}
                    className="mr-1 rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-slate-600 hover:bg-amber-50"
                  >
                    {showConfirmClaimPassword ? "Hide" : "Show"}
                  </button>
                </div>
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
        </>
      )}
      {claimCompleted && (
        <p className="w-full max-w-lg mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 text-center">
          Booking confirmed. Please sign in below using your new email and password.
        </p>
      )}
      <form id="sign-in-card" onSubmit={handleSignInSubmit} className="w-full max-w-lg bg-white rounded-3xl shadow-2xl p-8 space-y-4 border border-slate-200">
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
          <div className="mt-1 flex items-center rounded-xl border border-slate-200 focus-within:border-red-400">
            <input
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              type={showLoginPassword ? "text" : "password"}
              required
              autoComplete="current-password"
              className="w-full min-h-[44px] rounded-l-xl px-4 py-3 outline-none"
            />
            <button
              type="button"
              onClick={() => setShowLoginPassword((prev) => !prev)}
              className="mr-1 rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-slate-600 hover:bg-red-50"
            >
              {showLoginPassword ? "Hide" : "Show"}
            </button>
          </div>
        </label>
        {authError && <p className="text-sm text-rose-600 font-semibold">{authError}</p>}
        {authInfo && <p className="text-sm text-emerald-700 font-semibold">{authInfo}</p>}
        {showClaimQuestion && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900 space-y-2">
            <p className="font-semibold">Have you signed up already and set up your password?</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                onClick={() => setShowClaimQuestion(false)}
              >
                Yes
              </button>
              <button
                type="button"
                className="rounded-lg border border-amber-300 bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-900 hover:bg-amber-200"
                onClick={() => {
                  setShowClaimCard(true);
                  setShowClaimQuestion(false);
                  window.requestAnimationFrame(() => {
                    const el = document.getElementById("claim-seeded");
                    el?.scrollIntoView({ behavior: "smooth", block: "start" });
                  });
                }}
              >
                No, show claim form
              </button>
            </div>
          </div>
        )}
        {!showClaimCard && !claimCompleted && (
          <button
            type="button"
            className="w-full rounded-xl border border-amber-200 bg-amber-50 py-2.5 text-xs font-bold uppercase tracking-wide text-amber-900 hover:bg-amber-100"
            onClick={() => {
              setShowClaimCard(true);
              window.requestAnimationFrame(() => {
                const el = document.getElementById("claim-seeded");
                el?.scrollIntoView({ behavior: "smooth", block: "start" });
              });
            }}
          >
            Have you paid for your slot? Confirm booking here
          </button>
        )}
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
