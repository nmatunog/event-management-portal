export const PORTAL_ROLE_OPTIONS = [
  { value: "attendee", label: "Viewer" },
  { value: "staff", label: "Working Team" },
  { value: "admin", label: "Admin" },
];

export function portalRoleLabel(role) {
  const normalized = String(role || "attendee").trim().toLowerCase();
  if (normalized === "staff") return "Working Team";
  if (normalized === "admin") return "Admin";
  return "Viewer";
}

export function resolveDelegatePortalEmail(row) {
  return String(row?.attendeeClaimEmail || row?.staffClaimEmail || "").trim().toLowerCase();
}

export function delegateNameByPortalEmail(registrants, email) {
  const target = String(email || "").trim().toLowerCase();
  if (!target) return "";
  const match = (registrants || []).find((row) => resolveDelegatePortalEmail(row) === target);
  return match ? String(match.name || "").trim() : "";
}

export function workingTeamRoster(committeeRoles, registrants, { includeAdmins = true } = {}) {
  return (committeeRoles || [])
    .filter((row) => {
      const role = String(row?.role || "attendee").trim().toLowerCase();
      if (role === "staff") return true;
      return includeAdmins && role === "admin";
    })
    .map((row) => {
      const email = String(row?.email || "").trim().toLowerCase();
      return {
        email,
        role: String(row?.role || "attendee").trim().toLowerCase(),
        delegateName: delegateNameByPortalEmail(registrants, email),
      };
    })
    .sort((a, b) => a.email.localeCompare(b.email));
}
