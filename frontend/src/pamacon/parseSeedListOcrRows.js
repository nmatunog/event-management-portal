/**
 * Turn OCR text from a numbered participant list into rows suitable for createRegistration.
 * Tuned for lines like: "49. Anniefe Rodriguez - 2.85k (1/3)" or "50 Winston Veloso 8.5k".
 */

function inferPaidModeFromBlob(blob) {
  const t = String(blob || "").toLowerCase();
  const installment = /\(1\/3\)|1\s*\/\s*3/.test(t);
  let paid = 0;
  const k = t.match(/([\d,]+\.?\d*)\s*k\b/);
  if (k) paid = Math.round(Number(k[1].replace(/,/g, "")) * 1000);
  if (!paid) {
    const p = t.match(/₱\s*([\d,]+)/);
    if (p) paid = Number(p[1].replace(/,/g, ""));
  }
  if (!paid) paid = 8000;
  let mode = "Full";
  let remarks = "";
  if (installment || paid === 2850) {
    mode = "Installment";
    remarks = installment ? "UM installment 1/3" : "";
  } else if (paid > 0 && paid < 7000) {
    mode = "Partial";
  }
  return { paid, mode, remarks };
}

function parseSeedListOcrLine(line) {
  if (!line || typeof line !== "string") return null;
  const trimmed = line.trim();
  if (trimmed.length < 5) return null;
  if (/^(page|list|participants?|name|no\.?|#|total)\b/i.test(trimmed) && trimmed.length < 36) return null;

  let s = trimmed.replace(/^\s*#?\s*\d+\s*[.)]?\s+/i, "").trim();
  if (!s) return null;

  let namePart = s;
  let tail = "";
  const dashMatch = s.match(/^(.+?)\s+[-–—]\s+(.+)$/);
  if (dashMatch) {
    namePart = dashMatch[1].trim();
    tail = dashMatch[2].trim();
  } else {
    const amountMatch = s.match(/^(.+?)\s+([\d,]+\.?\d*\s*k)(.*)$/i);
    if (amountMatch) {
      namePart = amountMatch[1].trim();
      tail = `${amountMatch[2]}${amountMatch[3] || ""}`.trim();
    }
  }

  namePart = namePart.replace(/[,;:|]+$/g, "").trim();
  if (namePart.length < 3) return null;
  if (/^[\d\s$€£.,]+$/i.test(namePart)) return null;
  const words = namePart.split(/\s+/).filter(Boolean);
  if (words.length < 2) return null;

  const { paid, mode, remarks } = inferPaidModeFromBlob(`${tail} ${s}`);
  const lastName = words[words.length - 1];

  return {
    fullName: words.join(" "),
    lastName,
    paid,
    mode,
    remarks,
    gender: "Unspecified",
    solo: false,
  };
}

export function parseSeedListOcrRows(raw) {
  if (!raw || typeof raw !== "string") return [];
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.replace(/[\t\u00a0]+/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const seen = new Set();
  const out = [];
  for (const line of lines) {
    const row = parseSeedListOcrLine(line);
    if (!row) continue;
    const k = row.fullName.trim().toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(row);
  }
  return out;
}
