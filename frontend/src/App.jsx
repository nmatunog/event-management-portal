import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { claimSeededRegistration, getAuthMe, getEvents, getRegistrations, setAccessToken } from "./lib/api";
import { supabase } from "./lib/supabaseClient";
import PamaconApp from "./pamacon/PamaconApp";
import PublicLanding from "./pages/PublicLanding.jsx";
import SignInPage from "./pages/SignInPage.jsx";

export default function App() {
  const [session, setSession] = useState(null);
  const [authUser, setAuthUser] = useState(null);
  const [authError, setAuthError] = useState("");
  const [authInfo, setAuthInfo] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [apiBanner, setApiBanner] = useState(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [seedClaimSyncDoneFor, setSeedClaimSyncDoneFor] = useState("");

  const superUserEmails = new Set(
    String(import.meta.env.VITE_SUPERUSER_EMAILS || "")
      .split(",")
      .map((x) => x.trim().toLowerCase())
      .filter(Boolean)
  );
  const sessionEmail = String(authUser?.email ?? session?.user?.email ?? "").toLowerCase();
  const authRole = superUserEmails.has(sessionEmail) ? "admin" : authUser?.role ?? "attendee";
  const canManage = authRole === "admin" || authRole === "staff";

  const showApiError = (error, fallbackMessage) => {
    const status = error?.status;
    if (status === 401) {
      setApiBanner({ type: "error", message: "Your session is invalid or expired. Please sign in again." });
      return;
    }
    if (status === 403) {
      setApiBanner({ type: "warn", message: "You do not have permission to perform this action." });
      return;
    }
    setApiBanner({ type: "error", message: fallbackMessage || error?.message || "Something went wrong while contacting the server." });
  };

  const showApiInfo = (message, type = "ok") => {
    setApiBanner({ type, message });
  };

  const syncSeededRegistrationProfile = async (user, profileOverride = null) => {
    const email = String(user?.email || "").trim().toLowerCase();
    const seededDelegateName = String(user?.user_metadata?.seededDelegateName || "").trim();
    const firstName = String(profileOverride?.firstName ?? user?.user_metadata?.firstName ?? "").trim().toLowerCase();
    const lastName = String(profileOverride?.lastName ?? user?.user_metadata?.lastName ?? "").trim().toLowerCase();
    if (!email || (!seededDelegateName && !(firstName && lastName))) return;

    const pinned = import.meta.env.VITE_PAMACON_EVENT_ID;
    const { items } = await getEvents();
    let ev = (items || []).find((x) => String(x.title || "").includes("PAMACON"));
    if (pinned) ev = (items || []).find((x) => x.id === pinned) || ev;
    if (!ev?.id) return;

    const regRes = await getRegistrations(ev.id);
    const normalizedTarget = seededDelegateName.toLowerCase();
    const match =
      (regRes.items || []).find((r) => String(r.full_name || "").trim().toLowerCase() === normalizedTarget) ||
      (regRes.items || []).find((r) => {
        const full = String(r.full_name || "").trim().toLowerCase();
        if (!full || !firstName || !lastName) return false;
        const hasFirst = full.startsWith(`${firstName} `) || full.includes(` ${firstName} `);
        const hasLast = full.endsWith(` ${lastName}`) || full.includes(` ${lastName} `);
        return hasFirst && hasLast;
      });
    if (!match?.id) return;

    await claimSeededRegistration(match.id, {
      email,
      mobileNumber: String(profileOverride?.mobileNumber ?? user?.user_metadata?.mobileNumber ?? "").trim(),
      attendeeProfile: profileOverride || user?.user_metadata || {},
    });
  };

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(async ({ data }) => {
      const currentSession = data.session;
      setSession(currentSession);
      setAccessToken(currentSession?.access_token ?? null);
      if (currentSession?.access_token) {
        try {
          const me = await getAuthMe();
          setAuthUser(me.user);
        } catch {
          setAuthUser(null);
        }
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession);
      setAccessToken(nextSession?.access_token ?? null);
      if (nextSession?.access_token) {
        try {
          const me = await getAuthMe();
          setAuthUser(me.user);
        } catch {
          setAuthUser(null);
        }
      } else {
        setAuthUser(null);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const syncSeedClaim = async () => {
      const user = session?.user;
      const email = String(user?.email || "").trim().toLowerCase();
      const seededDelegateName = String(user?.user_metadata?.seededDelegateName || "").trim();
      const firstName = String(user?.user_metadata?.firstName || "").trim().toLowerCase();
      const lastName = String(user?.user_metadata?.lastName || "").trim().toLowerCase();
      if (!email || (!seededDelegateName && !(firstName && lastName))) return;
      const guardKey = `${email}|${(seededDelegateName || `${firstName} ${lastName}`).toLowerCase()}`;
      if (seedClaimSyncDoneFor === guardKey) return;
      try {
        await syncSeededRegistrationProfile(user);
      } catch {
        // Silent fallback: attendee can still proceed even if sync fails.
      } finally {
        setSeedClaimSyncDoneFor(guardKey);
      }
    };
    syncSeedClaim();
  }, [session, seedClaimSyncDoneFor]);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!supabase) {
      setAuthError("Supabase env vars are missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
      return false;
    }
    setAuthLoading(true);
    setAuthError("");
    setAuthInfo("");
    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    });
    if (error) setAuthError(error.message);
    setAuthLoading(false);
    return !error;
  };

  const handleResetPassword = async () => {
    if (!supabase) {
      setAuthError("Supabase env vars are missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
      return;
    }
    if (!loginEmail.trim()) {
      setAuthError("Enter your email first, then click Forgot password.");
      return;
    }
    setAuthLoading(true);
    setAuthError("");
    setAuthInfo("");
    const { error } = await supabase.auth.resetPasswordForEmail(loginEmail.trim(), {
      redirectTo: `${window.location.origin}/sign-in`,
    });
    if (error) {
      setAuthError(error.message);
    } else {
      setAuthInfo("Password reset email sent. Check your inbox.");
    }
    setAuthLoading(false);
  };

  const handleSignUp = async () => {
    if (!supabase) {
      setAuthError("Supabase env vars are missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
      return;
    }
    if (!loginEmail.trim() || !loginPassword) {
      setAuthError("Enter email and password first, then click Create account.");
      return;
    }
    setAuthLoading(true);
    setAuthError("");
    setAuthInfo("");
    const { error } = await supabase.auth.signUp({
      email: loginEmail.trim(),
      password: loginPassword,
    });
    if (error) {
      setAuthError(error.message);
    } else {
      setAuthInfo("Account created. Check your email if confirmation is required, then sign in.");
    }
    setAuthLoading(false);
  };

  const handleClaimBooking = async ({ email, password, mobileNumber, delegate }) => {
    if (!supabase) {
      setAuthError("Supabase env vars are missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
      return false;
    }
    const safeEmail = String(email || "").trim();
    const safePassword = String(password || "");
    if (!safeEmail || !safePassword) {
      setAuthError("Email and password are required to claim your booking.");
      return false;
    }
    const fullName = String(delegate?.name || "").trim();
    const nameParts = fullName.split(/\s+/).filter(Boolean);
    const lastName = String(delegate?.lastName || (nameParts.length ? nameParts[nameParts.length - 1] : "")).trim();
    const firstName = String(delegate?.firstName || (nameParts.length ? nameParts[0] : "")).trim();

    setAuthLoading(true);
    setAuthError("");
    setAuthInfo("");
    const { error } = await supabase.auth.signUp({
      email: safeEmail,
      password: safePassword,
      options: {
        data: {
          lastName,
          firstName,
          mobileNumber: String(mobileNumber || "").trim(),
          seededDelegateName: fullName,
        },
      },
    });
    if (error) {
      setAuthError(error.message);
      setAuthLoading(false);
      return false;
    }
    try {
      if (delegate?.id) {
        await claimSeededRegistration(delegate.id, {
          email: safeEmail,
          mobileNumber: String(mobileNumber || "").trim(),
        });
      }
    } catch {
      setAuthInfo("Account created, but we could not mark your seeded booking as claimed yet. Please notify staff to link it.");
      setAuthLoading(false);
      return true;
    }
    setAuthInfo("Booking claim started. Check your email if confirmation is required, then sign in.");
    setLoginEmail(safeEmail);
    setLoginPassword("");
    setAuthLoading(false);
    return true;
  };

  const handleLogout = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setApiBanner(null);
  };

  const userMetadata = session?.user?.user_metadata || {};
  const profile = {
    lastName: userMetadata.lastName || "",
    firstName: userMetadata.firstName || "",
    nickname: userMetadata.nickname || "",
    aiaAgentCode: userMetadata.aiaAgentCode || "",
    middleName: userMetadata.middleName || "",
    middleInitial:
      userMetadata.middleInitial ||
      (userMetadata.middleName ? String(userMetadata.middleName).trim().slice(0, 1) : ""),
    mobileNumber: userMetadata.mobileNumber || "",
    positionCode: userMetadata.positionCode || "UM",
    positionOther: userMetadata.positionOther || "",
    age: userMetadata.age ?? "",
    gender: userMetadata.gender || "",
    shirtSize: userMetadata.shirtSize || "",
    shirtSizeOther: userMetadata.shirtSizeOther || "",
    arrivalCebu: userMetadata.arrivalCebu || "",
    departureCebu: userMetadata.departureCebu || "",
    extraIslandHopping: Boolean(userMetadata.extraIslandHopping),
    extraCityTour: Boolean(userMetadata.extraCityTour),
    extraMountainTour: Boolean(userMetadata.extraMountainTour),
    extraSafari: Boolean(userMetadata.extraSafari),
    extraOtherRequest: userMetadata.extraOtherRequest || "",
  };

  const handleSaveProfile = async (nextProfile) => {
    if (!supabase) return;
    setProfileSaving(true);
    try {
      const mi = String(nextProfile?.middleInitial ?? nextProfile?.middleName ?? "").trim();
      const nextMeta = {
        ...userMetadata,
        lastName: String(nextProfile?.lastName || "").trim(),
        firstName: String(nextProfile?.firstName || "").trim(),
        nickname: String(nextProfile?.nickname || "").trim(),
        aiaAgentCode: String(nextProfile?.aiaAgentCode || "").trim(),
        middleName: String(nextProfile?.middleName || mi).trim().slice(0, 120),
        middleInitial: mi.slice(0, 4),
        mobileNumber: String(nextProfile?.mobileNumber || "").trim(),
        positionCode: String(nextProfile?.positionCode || "UM"),
        positionOther: String(nextProfile?.positionOther || "").trim(),
        age: nextProfile?.age === "" || nextProfile?.age == null ? "" : String(nextProfile.age).trim(),
        gender: String(nextProfile?.gender || "").trim(),
        shirtSize: String(nextProfile?.shirtSize || "").trim(),
        shirtSizeOther: String(nextProfile?.shirtSizeOther || "").trim(),
        arrivalCebu: String(nextProfile?.arrivalCebu || "").trim(),
        departureCebu: String(nextProfile?.departureCebu || "").trim(),
        extraIslandHopping: Boolean(nextProfile?.extraIslandHopping),
        extraCityTour: Boolean(nextProfile?.extraCityTour),
        extraMountainTour: Boolean(nextProfile?.extraMountainTour),
        extraSafari: Boolean(nextProfile?.extraSafari),
        extraOtherRequest: String(nextProfile?.extraOtherRequest || "").trim(),
      };
      const { data, error } = await supabase.auth.updateUser({ data: nextMeta });
      if (error) throw error;
      if (data?.user) setSession((s) => (s ? { ...s, user: data.user } : s));
      try {
        const currentUser = data?.user || session?.user;
        if (currentUser) {
          await syncSeededRegistrationProfile(currentUser, nextMeta);
        }
      } catch {
        // Do not block profile save success when registration sync fails.
      }
      setApiBanner({ type: "ok", message: "Profile updated." });
    } catch (error) {
      showApiError(error, "Failed to update profile.");
    } finally {
      setProfileSaving(false);
    }
  };

  const portalShell = session ? (
    <div className={canManage ? "relative h-screen overflow-hidden" : "relative h-screen overflow-y-auto"}>
      {apiBanner && (
        <button
          type="button"
          className={`absolute top-0 left-0 right-0 z-[200] px-4 py-2 text-sm font-semibold border-b text-left w-full ${
            apiBanner.type === "warn"
              ? "border-amber-200 bg-amber-50 text-amber-800"
              : apiBanner.type === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-700"
          }`}
          onClick={() => setApiBanner(null)}
          title="Dismiss"
        >
          {apiBanner.message}
        </button>
      )}
      <div className={canManage ? (apiBanner ? "pt-12 h-full" : "h-full") : apiBanner ? "pt-12 pb-6" : "pb-6"}>
        <PamaconApp
          canEdit={canManage}
          authEmail={authUser?.email ?? session.user?.email ?? ""}
          authRole={authRole}
          profile={profile}
          onSaveProfile={handleSaveProfile}
          profileSaving={profileSaving}
          onApiInfo={showApiInfo}
          onApiError={showApiError}
          onLogout={handleLogout}
        />
      </div>
      {canManage && (
        <button
          type="button"
          onClick={handleLogout}
          className="fixed bottom-4 right-4 z-[200] rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold shadow-lg hover:bg-slate-50"
        >
          Logout
        </button>
      )}
    </div>
  ) : null;

  return (
    <Routes>
      <Route path="/" element={<PublicLanding />} />
      <Route
        path="/sign-in"
        element={
          <SignInPage
            session={session}
            authLoading={authLoading}
            loginEmail={loginEmail}
            setLoginEmail={setLoginEmail}
            loginPassword={loginPassword}
            setLoginPassword={setLoginPassword}
            authError={authError}
            authInfo={authInfo}
            onLogin={handleLogin}
            onResetPassword={handleResetPassword}
            onSignUp={handleSignUp}
            onClaimBooking={handleClaimBooking}
          />
        }
      />
      <Route path="/portal" element={session ? portalShell : <Navigate to="/sign-in" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
