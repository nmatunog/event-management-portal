const STORAGE_KEY = "pamacon_delegate_identity_v1";

export function saveDelegateIdentity(identity) {
  if (typeof window === "undefined") return;
  const email = String(identity?.email || "").trim().toLowerCase();
  const firstName = String(identity?.firstName || "").trim();
  const lastName = String(identity?.lastName || "").trim();
  if (!email && !firstName && !lastName) return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        email,
        firstName,
        lastName,
        agency: String(identity?.agency || "").trim(),
        nickname: String(identity?.nickname || "").trim(),
        savedAt: new Date().toISOString(),
      })
    );
  } catch {
    // Private mode or quota — ignore.
  }
}

export function loadDelegateIdentity() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return {
      email: String(parsed.email || "").trim().toLowerCase(),
      firstName: String(parsed.firstName || "").trim(),
      lastName: String(parsed.lastName || "").trim(),
      agency: String(parsed.agency || "").trim(),
      nickname: String(parsed.nickname || "").trim(),
      savedAt: parsed.savedAt || null,
    };
  } catch {
    return null;
  }
}

export function clearDelegateIdentity() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // no-op
  }
}

export function mergeDelegateProfile(profile = {}, saved = null) {
  const fromSaved = saved || loadDelegateIdentity();
  return {
    firstName: String(profile?.firstName || fromSaved?.firstName || "").trim(),
    lastName: String(profile?.lastName || fromSaved?.lastName || "").trim(),
    agency: String(profile?.agency || fromSaved?.agency || "").trim(),
    nickname: String(profile?.nickname || fromSaved?.nickname || "").trim(),
    email: String(profile?.email || fromSaved?.email || "").trim().toLowerCase(),
  };
}
