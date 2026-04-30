/** Initial delegate rows for PAMACON 2026 (reference dataset). */

/**
 * Position from amount paid (seed only). Admin can override in the app (incl. DD).
 * - ₱10,000+ → AD
 * - ₱8,200–₱9,999 → SUM
 * - Below → UM
 */
function inferSeedRole(paid) {
  const p = Number(paid) || 0;
  if (p >= 10000) return "AD";
  if (p >= 8200) return "SUM";
  return "UM";
}

const PAMACON_SEED_DELEGATES_RAW = [
  { name: "Sheila Lu", lastName: "Lu", gender: "Female", paid: 10000, mode: "Full", solo: false },
  { name: "James Capili", lastName: "Capili", gender: "Male", paid: 10000, mode: "Full", solo: false },
  { name: "Christine Dimaliuat", lastName: "Dimaliuat", gender: "Female", paid: 8000, mode: "Full", solo: false },
  { name: "Slochin Gragas", lastName: "Gragas", gender: "Male", paid: 8000, mode: "Full", solo: false },
  { name: "Edna Gan", lastName: "Gan", gender: "Female", paid: 10000, mode: "Full", solo: false },
  { name: "DJ Dimaliuat", lastName: "Dimaliuat", gender: "Male", paid: 10000, mode: "Full", solo: false },
  { name: "Elmer Jamora", lastName: "Jamora", gender: "Male", paid: 10000, mode: "Full", solo: true },
  { name: "Rosemarie Dallo", lastName: "Dallo", gender: "Female", paid: 10000, mode: "Full", solo: false },
  { name: "Maricel Fernando", lastName: "Fernando", gender: "Female", paid: 10000, mode: "Full", solo: false },
  { name: "Leah Gan", lastName: "Gan", gender: "Female", paid: 8000, mode: "Full", solo: false },
  { name: "Christine Elalrdo", lastName: "Elalrdo", gender: "Female", paid: 8000, mode: "Full", solo: false },
  { name: "Dion Reyes", lastName: "Reyes", gender: "Male", paid: 8000, mode: "Full", solo: false },
  { name: "Iza Antonio", lastName: "Antonio", gender: "Female", paid: 10000, mode: "Full", solo: false },
  { name: "Mac De Villa", lastName: "De Villa", gender: "Male", paid: 8000, mode: "Full", solo: false },
  { name: "Carlos Veneracion", lastName: "Veneracion", gender: "Male", paid: 10000, mode: "Full", solo: false },
  { name: "Prescy Dalumpines", lastName: "Dalumpines", gender: "Female", paid: 8000, mode: "Full", solo: false },
  { name: "Ma Daryl", lastName: "Daryl", gender: "Female", paid: 8000, mode: "Full", solo: false },
  { name: "Bernadette Cabio", lastName: "Cabio", gender: "Female", paid: 8000, mode: "Full", solo: false },
  { name: "Belmar Guilanda", lastName: "Guilanda", gender: "Male", paid: 10000, mode: "Full", solo: false },
  { name: "Ez Matunog", lastName: "Matunog", gender: "Male", paid: 10000, mode: "Full", solo: false },
  { name: "Mel Vergel De Dios", lastName: "Vergel De Dios", gender: "Male", paid: 8000, mode: "Full", solo: false },
  { name: "Leo Bartolome", lastName: "Bartolome", gender: "Male", paid: 8000, mode: "Full", solo: false },
  { name: "Renel Simeon", lastName: "Simeon", gender: "Male", paid: 8000, mode: "Full", solo: false },
  { name: "Melinda Ocampo", lastName: "Ocampo", gender: "Female", paid: 10000, mode: "Full", solo: false },
  { name: "Vienne Latonio", lastName: "Latonio", gender: "Female", paid: 8000, mode: "Full", solo: false },
  { name: "Leica Cruz", lastName: "Cruz", gender: "Female", paid: 6000, mode: "Partial", solo: false },
  { name: "James Velasquez", lastName: "Velasquez", gender: "Male", paid: 8000, mode: "Full", solo: false },
  { name: "Amy Yap", lastName: "Yap", gender: "Female", paid: 10000, mode: "Full", solo: false },
  { name: "Grace Acuin", lastName: "Acuin", gender: "Female", paid: 8000, mode: "Full", solo: false },
  { name: "Alvin Mendoza", lastName: "Mendoza", gender: "Male", paid: 8200, mode: "Full", solo: false },
  { name: "Aida Caharian", lastName: "Caharian", gender: "Female", paid: 8200, mode: "Full", solo: false },
  { name: "Analie Corteza", lastName: "Corteza", gender: "Female", paid: 10200, mode: "Full", solo: false },
  { name: "Chita Lagan", lastName: "Lagan", gender: "Female", paid: 8200, mode: "Full", solo: false },
  { name: "Emman Paras", lastName: "Paras", gender: "Male", paid: 10200, mode: "Full", solo: false },
  { name: "Ane Vergel De Dios", lastName: "Vergel De Dios", gender: "Female", paid: 10500, mode: "Full", solo: false },
  { name: "Shirley Ordillo", lastName: "Ordillo", gender: "Female", paid: 8200, mode: "Full", solo: false },
  { name: "Bonna Clyde Susarno", lastName: "Susarno", gender: "Female", paid: 5200, mode: "Partial", solo: false },
  { name: "Normie Veneracion", lastName: "Veneracion", gender: "Female", paid: 8200, mode: "Full", solo: false },
  { name: "Mae Ann Ang", lastName: "Ang", gender: "Female", paid: 8500, mode: "Full", solo: false },
  { name: "Henry Evangelista", lastName: "Evangelista", gender: "Male", paid: 10500, mode: "Full", solo: false },
  { name: "Michael Masirag", lastName: "Masirag", gender: "Male", paid: 2850, mode: "Installment", solo: false },
  { name: "Eric Dionisio", lastName: "Dionisio", gender: "Male", paid: 2850, mode: "Installment", solo: false },
  { name: "Abbie Villarosa", lastName: "Villarosa", gender: "Female", paid: 10000, mode: "Full", solo: false },
  { name: "Jaqueline Esquerra", lastName: "Esquerra", gender: "Female", paid: 8000, mode: "Full", solo: false },
  { name: "Julieta Alfaro", lastName: "Alfaro", gender: "Female", paid: 8000, mode: "Full", solo: false },
  { name: "Melanie Alisbo", lastName: "Alisbo", gender: "Female", paid: 2850, mode: "Installment", solo: false },
  { name: "Jason Tonog", lastName: "Tonog", gender: "Male", paid: 2850, mode: "Installment", solo: false },
  { name: "Edna Garcia", lastName: "Garcia", gender: "Female", paid: 2850, mode: "Installment", solo: false },
  { name: "Grace Regis", lastName: "Regis", gender: "Female", paid: 6500, mode: "Partial", solo: false, remarks: "no room" },
  { name: "Anniefe Rodriguez", lastName: "Rodriguez", gender: "Female", paid: 2850, mode: "Installment", solo: false, remarks: "UM installment 1/3" },
  { name: "Winston Veloso", lastName: "Veloso", gender: "Male", paid: 2850, mode: "Installment", solo: false, remarks: "UM installment 1/3" },
  { name: "Sarah Recla", lastName: "Recla", gender: "Female", paid: 2850, mode: "Installment", solo: false, remarks: "UM installment 1/3" },
  { name: "Belinda Manliquez", lastName: "Manliquez", gender: "Female", paid: 8500, mode: "Full", solo: false },
  { name: "Genie Melendres", lastName: "Melendres", gender: "Female", paid: 2850, mode: "Installment", solo: false, remarks: "UM installment 1/3" },
];

function uniqDelegateSeedRows(rows) {
  const seen = new Set();
  const out = [];
  for (const d of rows) {
    const k = `${String(d.name).trim().toLowerCase()}|${String(d.lastName).trim().toLowerCase()}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(d);
  }
  return out;
}

/** Deduped by full name + last name; `role` derived from paid (see inferSeedRole). */
export const PAMACON_SEED_DELEGATES = uniqDelegateSeedRows(
  PAMACON_SEED_DELEGATES_RAW.map((row) => ({
    ...row,
    role: inferSeedRole(row.paid),
  }))
);

export function modeToPaymentPlan(mode) {
  if (mode === "Installment") return "installment";
  if (mode === "Partial") return "partial";
  return "full";
}
