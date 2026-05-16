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

export function claimSeededRegistration(registrationId, payload) {
  return request(`/api/registrations/${registrationId}/claim-seeded`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function syncMyRegistrationProfile(eventId, payload) {
  return request(`/api/events/${eventId}/registrations/sync-my-profile`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** Attendee: server resolves seeded vs public registration and payment-proof rules. */
export function getMyCheckInRegistration(eventId, params = {}) {
  const q = new URLSearchParams();
  if (params.seededRegistrationId) q.set("seededRegistrationId", String(params.seededRegistrationId));
  if (params.seededDelegateName) q.set("seededDelegateName", String(params.seededDelegateName));
  if (params.firstName) q.set("firstName", String(params.firstName));
  if (params.lastName) q.set("lastName", String(params.lastName));
  if (params.nickname) q.set("nickname", String(params.nickname));
  const qs = q.toString();
  return request(`/api/events/${eventId}/registrations/my-check-in${qs ? `?${qs}` : ""}`);
}

export function selfCheckInRegistration(eventId, payload) {
  return request(`/api/events/${eventId}/registrations/self-check-in`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getMyRegistrationRowSummary(eventId, params = {}) {
  const q = new URLSearchParams();
  if (params.seededRegistrationId) q.set("seededRegistrationId", String(params.seededRegistrationId));
  if (params.seededDelegateName) q.set("seededDelegateName", String(params.seededDelegateName));
  if (params.firstName) q.set("firstName", String(params.firstName));
  if (params.lastName) q.set("lastName", String(params.lastName));
  if (params.nickname) q.set("nickname", String(params.nickname));
  const qs = q.toString();
  return request(`/api/events/${eventId}/registrations/my-row-summary${qs ? `?${qs}` : ""}`);
}

export function harmonizeRegistrations(eventId) {
  return request(`/api/events/${eventId}/registrations/harmonize`, {
    method: "POST",
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

export function patchSponsor(sponsorId, payload) {
  return request(`/api/sponsors/${sponsorId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
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

export function patchExpense(expenseId, payload) {
  return request(`/api/expenses/${expenseId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
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

async function publicRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...DEFAULT_HEADERS,
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

export function getPaymentVouchers(eventId) {
  return request(`/api/events/${eventId}/payment-vouchers`);
}

export function createPaymentVoucher(eventId, payload) {
  return request(`/api/events/${eventId}/payment-vouchers`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getEventExpenseReport(eventId) {
  return request(`/api/events/${eventId}/expense-report`);
}

export function getPaymentVoucher(voucherId) {
  return request(`/api/payment-vouchers/${voucherId}`);
}

export function getPaymentVoucherReceipt(voucherId) {
  return request(`/api/payment-vouchers/${voucherId}/receipt`);
}

export function patchPaymentVoucherDetails(voucherId, payload) {
  return request(`/api/payment-vouchers/${voucherId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function voidPaymentVoucher(voucherId) {
  return request(`/api/payment-vouchers/${voucherId}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "void" }),
  });
}

export function deletePaymentVoucher(voucherId) {
  return request(`/api/payment-vouchers/${voucherId}`, { method: "DELETE" });
}

export function getPaymentVoucherSignature(voucherId) {
  return request(`/api/payment-vouchers/${voucherId}/signature`);
}

export function getPublicPaymentVoucher(token) {
  return publicRequest(`/api/payment-vouchers/public/${encodeURIComponent(token)}`);
}

export function confirmPublicPaymentVoucher(token, payload) {
  return publicRequest(`/api/payment-vouchers/public/${encodeURIComponent(token)}/confirm`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function supplierVoucherPublicUrl(token) {
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}/supplier-voucher/${token}`;
  }
  return `/supplier-voucher/${token}`;
}

export function getMyEventFeedback(eventId) {
  return request(`/api/events/${eventId}/feedback/me`);
}

export function putMyEventFeedback(eventId, payload) {
  return request(`/api/events/${eventId}/feedback/me`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function getEventFeedbackAnalytics(eventId) {
  return request(`/api/events/${eventId}/feedback/analytics`);
}

export function generateEventFeedbackAiStrategy(eventId) {
  return request(`/api/events/${eventId}/feedback/ai-strategy`, { method: "POST" });
}
