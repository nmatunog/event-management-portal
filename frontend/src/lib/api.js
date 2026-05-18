const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8787";
let accessToken = null;
const DEFAULT_HEADERS = {
  "Content-Type": "application/json",
};

export function setAccessToken(token) {
  accessToken = token;
}

const FETCH_MAX_ATTEMPTS = 3;
const FETCH_RETRY_BASE_MS = 400;

function isRetryableFetchError(error) {
  if (!error || typeof error !== "object") return false;
  if (error.name === "TypeError") {
    const msg = String(error.message || "").toLowerCase();
    return msg.includes("failed to fetch") || msg.includes("network") || msg.includes("load failed");
  }
  return false;
}

async function fetchWithRetry(url, options) {
  let lastError;
  for (let attempt = 0; attempt < FETCH_MAX_ATTEMPTS; attempt += 1) {
    try {
      return await fetch(url, options);
    } catch (error) {
      lastError = error;
      if (attempt < FETCH_MAX_ATTEMPTS - 1 && isRetryableFetchError(error)) {
        await new Promise((resolve) => {
          setTimeout(resolve, FETCH_RETRY_BASE_MS * (attempt + 1));
        });
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

export async function pingApi() {
  const response = await fetchWithRetry(`${API_BASE}/api/health`);
  if (!response.ok) {
    throw new Error("API health check failed");
  }
  return response.json();
}

async function request(path, options = {}) {
  const response = await fetchWithRetry(`${API_BASE}${path}`, {
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

export function getRegistration(registrationId) {
  return request(`/api/registrations/${registrationId}`);
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

export function getSpeakerMaterials(eventId, params = {}) {
  const q = new URLSearchParams();
  if (params.firstName) q.set("firstName", String(params.firstName));
  if (params.lastName) q.set("lastName", String(params.lastName));
  if (params.nickname) q.set("nickname", String(params.nickname));
  if (params.seededRegistrationId) q.set("seededRegistrationId", String(params.seededRegistrationId));
  if (params.seededDelegateName) q.set("seededDelegateName", String(params.seededDelegateName));
  const qs = q.toString();
  return request(`/api/events/${eventId}/speaker-materials${qs ? `?${qs}` : ""}`);
}

export function uploadSpeakerMaterialPdf(eventId, payload) {
  return request(`/api/events/${eventId}/speaker-materials/uploads`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function deleteSpeakerMaterialUpload(eventId, fileId) {
  return request(`/api/events/${eventId}/speaker-materials/uploads/${encodeURIComponent(fileId)}`, {
    method: "DELETE",
  });
}

function speakerMaterialFileQuery(params = {}) {
  const q = new URLSearchParams();
  if (params.firstName) q.set("firstName", String(params.firstName));
  if (params.lastName) q.set("lastName", String(params.lastName));
  if (params.nickname) q.set("nickname", String(params.nickname));
  if (params.seededRegistrationId) q.set("seededRegistrationId", String(params.seededRegistrationId));
  if (params.seededDelegateName) q.set("seededDelegateName", String(params.seededDelegateName));
  return q.toString();
}

/** Open or download an uploaded PDF (requires auth + delegate registration for attendees). */
export async function openSpeakerMaterialFile(eventId, fileId, { download = false, ...matchParams } = {}) {
  const qs = speakerMaterialFileQuery(matchParams);
  const suffix = download ? `${qs ? `${qs}&` : ""}download=1` : qs;
  const response = await fetchWithRetry(
    `${API_BASE}/api/events/${eventId}/speaker-materials/files/${encodeURIComponent(fileId)}${suffix ? `?${suffix}` : ""}`,
    {
      headers: {
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
    }
  );
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
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  if (download) {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "presentation.pdf";
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 120000);
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
  const response = await fetchWithRetry(`${API_BASE}${path}`, {
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

export function resequencePaymentVouchers(eventId) {
  return request(`/api/events/${eventId}/payment-vouchers/resequence`, { method: "POST" });
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

export function getMyEventFeedback(
  eventId,
  { firstName = "", lastName = "", nickname = "", seededRegistrationId = "", seededDelegateName = "" } = {}
) {
  const qs = new URLSearchParams();
  if (firstName) qs.set("firstName", firstName);
  if (lastName) qs.set("lastName", lastName);
  if (nickname) qs.set("nickname", nickname);
  if (seededRegistrationId) qs.set("seededRegistrationId", seededRegistrationId);
  if (seededDelegateName) qs.set("seededDelegateName", seededDelegateName);
  const q = qs.toString();
  return request(`/api/events/${eventId}/feedback/me${q ? `?${q}` : ""}`);
}

export function putMyEventFeedback(eventId, payload) {
  return request(`/api/events/${eventId}/feedback/me`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

/** Public evaluation — no sign-in; match by first + last name. */
export function getPublicEventFeedback(eventId, { firstName = "", lastName = "" } = {}) {
  const qs = new URLSearchParams();
  if (firstName) qs.set("firstName", firstName);
  if (lastName) qs.set("lastName", lastName);
  const q = qs.toString();
  return request(`/api/events/${eventId}/feedback/public${q ? `?${q}` : ""}`);
}

export function submitPublicEventFeedback(eventId, payload) {
  return request(`/api/events/${eventId}/feedback/public`, {
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
