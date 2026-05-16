import { useEffect, useMemo, useState, useRef } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { claimSeededRegistration, getAuthMe, getEvents, setAccessToken, syncMyRegistrationProfile } from "./lib/api";
import { supabase } from "./lib/supabaseClient";
import PamaconApp from "./pamacon/PamaconApp";
import AttendeeSelfCheckInPage from "./pamacon/AttendeeSelfCheckInPage.jsx";
import AttendeeEvaluationPage from "./pamacon/AttendeeEvaluationPage.jsx";
import PublicLanding from "./pages/PublicLanding.jsx";
import SignInPage from "./pages/SignInPage.jsx";
import SupplierPaymentVoucherPage from "./pamacon/SupplierPaymentVoucherPage.jsx";

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
  const isSuperuser = superUserEmails.has(sessionEmail);
  const authRole = isSuperuser ? "admin" : authUser?.role ?? "attendee";
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
    const raw = String(error?.message || "").trim();
    const genericStatusOnly = /^Request failed: \d{3}$/.test(raw);
    const detail = raw && !genericStatusOnly ? raw : "";
    const message =
      detail && fallbackMessage ? `${fallbackMessage} ${detail}` : detail || fallbackMessage || "Something went wrong while contacting the server.";
    setApiBanner({ type: "error", message });
  };

  const showApiInfo = (message, type = "ok") => {
    setApiBanner({ type, message });
  };

  const apiBannerDismissRef = useRef(null);
  useEffect(() => {
    if (apiBannerDismissRef.current) {
      clearTimeout(apiBannerDismissRef.current);
      apiBannerDismissRef.current = null;
    }
    if (!apiBanner || apiBanner.type !== "ok") return;
    apiBannerDismissRef.current = setTimeout(() => {
      setApiBanner(null);
      apiBannerDismissRef.current = null;
    }, 4200);
    return () => {
      if (apiBannerDismissRef.current) {
        clearTimeout(apiBannerDismissRef.current);
        apiBannerDismissRef.current = null;
      }
    };
  }, [apiBanner]);

  const syncSeededRegistrationProfile = async (user, profileOverride = null) => {
    const email = String(user?.email || "").trim().toLowerCase();
    const seededDelegateName = String(user?.user_metadata?.seededDelegateName || "").trim();
    const seededRegistrationId = String(user?.user_metadata?.seededRegistrationId || "").trim();
    const firstName = String(profileOverride?.firstName ?? user?.user_metadata?.firstName ?? "").trim().toLowerCase();
    const lastName = String(profileOverride?.lastName ?? user?.user_metadata?.lastName ?? "").trim().toLowerCase();
    const nickname = String(profileOverride?.nickname ?? user?.user_metadata?.nickname ?? "").trim().toLowerCase();
    if (!email) return;

    const pinned = import.meta.env.VITE_PAMACON_EVENT_ID;
    const { items } = await getEvents();
    let ev = (items || []).find((x) => String(x.title || "").includes("PAMACON"));
    if (pinned) ev = (items || []).find((x) => x.id === pinned) || ev;
    if (!ev?.id) return;
    await syncMyRegistrationProfile(ev.id, {
      seededRegistrationId,
      seededDelegateName,
      profile: {
        ...(user?.user_metadata || {}),
        ...(profileOverride || {}),
        firstName,
        lastName,
        nickname,
      },
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
      if (!email) return;
      const guardKey = `${email}|${(seededDelegateName || `${firstName} ${lastName}` || "sync").toLowerCase()}`;
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
          seededDelegateName: fullName,
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
  const attendeeSyncHints = useMemo(
    () => ({
      seededRegistrationId: String(userMetadata.seededRegistrationId || "").trim(),
      seededDelegateName: String(userMetadata.seededDelegateName || "").trim(),
    }),
    [userMetadata.seededRegistrationId, userMetadata.seededDelegateName]
  );
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
    activityRegistrationConfirmed: Boolean(userMetadata.activityRegistrationConfirmed),
    activityPaymentMethod: userMetadata.activityPaymentMethod || "",
    activityPaymentReference: userMetadata.activityPaymentReference || "",
    activityPaymentAmount: userMetadata.activityPaymentAmount || "",
    activityPaymentSenderNumber: userMetadata.activityPaymentSenderNumber || "",
    activityPaymentProofScreenshotDataUrl: userMetadata.activityPaymentProofScreenshotDataUrl || "",
    activityPaymentProofUploadedAt: userMetadata.activityPaymentProofUploadedAt || "",
    activityPaymentConfirmedAt: userMetadata.activityPaymentConfirmedAt || "",
    activityPaymentStatus: userMetadata.activityPaymentStatus || "pending",
    paymentProofScreenshotDataUrl: userMetadata.paymentProofScreenshotDataUrl || "",
    paymentProofUploadedAt: userMetadata.paymentProofUploadedAt || "",
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
        activityRegistrationConfirmed: Boolean(nextProfile?.activityRegistrationConfirmed),
        activityPaymentMethod: String(nextProfile?.activityPaymentMethod || "").trim(),
        activityPaymentReference: String(nextProfile?.activityPaymentReference || "").trim(),
        activityPaymentAmount: String(nextProfile?.activityPaymentAmount || "").trim(),
        activityPaymentSenderNumber: String(nextProfile?.activityPaymentSenderNumber || "").trim(),
        activityPaymentProofScreenshotDataUrl: String(nextProfile?.activityPaymentProofScreenshotDataUrl || ""),
        activityPaymentProofUploadedAt: String(nextProfile?.activityPaymentProofUploadedAt || ""),
        activityPaymentConfirmedAt: String(nextProfile?.activityPaymentConfirmedAt || ""),
        activityPaymentStatus: String(nextProfile?.activityPaymentStatus || userMetadata.activityPaymentStatus || "pending"),
        paymentProofScreenshotDataUrl: String(nextProfile?.paymentProofScreenshotDataUrl || ""),
        paymentProofUploadedAt: String(nextProfile?.paymentProofUploadedAt || ""),
      };
      const { data, error } = await supabase.auth.updateUser({ data: nextMeta });
      if (error) throw error;
      if (data?.user) setSession((s) => (s ? { ...s, user: data.user } : s));
      let syncWarning = "";
      try {
        const currentUser = data?.user || session?.user;
        if (currentUser) {
          await syncSeededRegistrationProfile(currentUser, nextMeta);
        }
      } catch {
        syncWarning = "Profile saved, but admin sync is pending. Try Save to my account again in a few seconds.";
      }
      setApiBanner(syncWarning ? { type: "warn", message: syncWarning } : { type: "ok", message: "Profile updated." });
    } catch (error) {
      showApiError(error, "Failed to update profile.");
    } finally {
      setProfileSaving(false);
    }
  };

  const evaluationShell = (
    <div className="relative min-h-screen">
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
      <div className={apiBanner ? "pt-12" : ""}>
        <AttendeeEvaluationPage
          authEmail={session ? authUser?.email ?? session.user?.email ?? "" : ""}
          profile={session ? profile : {}}
          attendeeSyncHints={session ? attendeeSyncHints : {}}
          canManage={session ? canManage : false}
          onLogout={session ? handleLogout : undefined}
          onApiInfo={showApiInfo}
          onApiError={showApiError}
        />
      </div>
    </div>
  );

  const checkInShell = session ? (
    <div className="relative min-h-screen">
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
      <div className={apiBanner ? "pt-12" : ""}>
        <AttendeeSelfCheckInPage
          authEmail={authUser?.email ?? session.user?.email ?? ""}
          profile={profile}
          attendeeSyncHints={attendeeSyncHints}
          onLogout={handleLogout}
          onApiInfo={showApiInfo}
          onApiError={showApiError}
        />
      </div>
    </div>
  ) : null;

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
          isSuperuser={isSuperuser}
          profile={profile}
          attendeeSyncHints={attendeeSyncHints}
          onSaveProfile={handleSaveProfile}
          profileSaving={profileSaving}
          onApiInfo={showApiInfo}
          onApiError={showApiError}
          onLogout={handleLogout}
        />
      </div>
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
      <Route path="/supplier-voucher/:token" element={<SupplierPaymentVoucherPage />} />
      <Route path="/portal" element={session ? portalShell : <Navigate to="/sign-in?next=%2Fportal" replace />} />
      <Route path="/evaluation" element={evaluationShell} />
      <Route
        path="/check-in"
        element={session ? checkInShell : <Navigate to="/sign-in?next=%2Fcheck-in" replace />}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
