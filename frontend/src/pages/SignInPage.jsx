import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

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
}) {
  const navigate = useNavigate();

  useEffect(() => {
    if (session) navigate("/portal", { replace: true });
  }, [session, navigate]);

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
        <p className="text-[11px] font-black uppercase tracking-wide text-amber-800">Seeded delegate account</p>
        <p className="mt-1 text-sm text-amber-900">
          If your name is in the preloaded delegate list, sign in first, complete your profile details, then the committee can quickly claim and verify your seeded record.
        </p>
      </section>
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
