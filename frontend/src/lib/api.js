const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8787";
let accessToken = null;
const DEFAULT_HEADERS = {
  "Content-Type": "application/json",
};

export function setAccessToken(token) {
  accessToken = token;
}

export async function pingApi() {
  const response = await fetch(`${API_BASE}/api/health`);
  if (!response.ok) {
    throw new Error("API health check failed");
  }
  return response.json();
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...DEFAULT_HEADERS,
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(options.headers ?? {}),
    },
  });
  if (!response.ok) {
    let message = `Request failed: ${response.status}`;
    try {
      const text = await response.text();
      if (text) {
        try {
          const parsed = JSON.parse(text);
          message = parsed?.message || parsed?.error || text;
        } catch {
          message = text;
        }
      }
    } catch {
      // no-op
    }
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

export function getEvents() {
  return request("/api/events");
}

export function createEvent(payload) {
  return request("/api/events", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function patchEvent(eventId, payload) {
  return request(`/api/events/${eventId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function getRegistrations(eventId) {
  return request(`/api/events/${eventId}/registrations`);
}

export function createRegistration(eventId, payload) {
  return request(`/api/events/${eventId}/registrations`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function patchRegistration(registrationId, payload) {
  return request(`/api/registrations/${registrationId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteRegistration(registrationId) {
  return request(`/api/registrations/${registrationId}`, { method: "DELETE" });
}

export function checkInRegistration(registrationId) {
  return request(`/api/registrations/${registrationId}/check-in`, {
    method: "PATCH",
  });
}

export function getAuthMe() {
  return request("/api/auth/me");
}

export function getSponsors(eventId) {
  return request(`/api/events/${eventId}/sponsors`);
}

export function createSponsor(eventId, payload) {
  return request(`/api/events/${eventId}/sponsors`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function deleteSponsor(sponsorId) {
  return request(`/api/sponsors/${sponsorId}`, { method: "DELETE" });
}

export function getExpenses(eventId) {
  return request(`/api/events/${eventId}/expenses`);
}

export function createExpense(eventId, payload) {
  return request(`/api/events/${eventId}/expenses`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function deleteExpense(expenseId) {
  return request(`/api/expenses/${expenseId}`, { method: "DELETE" });
}

export function getSpeakers(eventId) {
  return request(`/api/events/${eventId}/speakers`);
}

export function createSpeaker(eventId, payload) {
  return request(`/api/events/${eventId}/speakers`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function patchSpeaker(speakerId, payload) {
  return request(`/api/speakers/${speakerId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteSpeaker(speakerId) {
  return request(`/api/speakers/${speakerId}`, { method: "DELETE" });
}

export function getProgramSessions(eventId) {
  return request(`/api/events/${eventId}/program-sessions`);
}

export function createProgramSession(eventId, payload) {
  return request(`/api/events/${eventId}/program-sessions`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function generateInstallments(registrationId, payload) {
  return request(`/api/registrations/${registrationId}/installments/generate`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function postRegistrationPayment(registrationId, payload) {
  return request(`/api/registrations/${registrationId}/payments`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getInvitations(eventId) {
  return request(`/api/events/${eventId}/invitations`);
}

export function createInvitation(eventId, payload) {
  return request(`/api/events/${eventId}/invitations`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getUserRoles() {
  return request("/api/admin/user-roles");
}

export function upsertUserRole(payload) {
  return request("/api/admin/user-roles", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteUserRole(email) {
  return request(`/api/admin/user-roles/${encodeURIComponent(email)}`, {
    method: "DELETE",
  });
}
