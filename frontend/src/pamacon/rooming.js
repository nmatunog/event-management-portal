/**
 * Room assignment logic aligned with the PAMACON reference portal.
 * @param {Array<{ id: string, name: string, gender: string, solo: boolean, manualPairId: string | null }>} registrants
 * @param {{ roomRate: number, soloUpgrade: number }} config
 * @param {{ autoPair?: boolean }} options
 */
export function buildRoomAssignments(registrants, config, options = {}) {
  const autoPair = Boolean(options.autoPair);
  const roomRate = Number(config.roomRate) || 3800;
  const soloUpgrade = Number(config.soloUpgrade) || 3800;
  const byId = new Map(registrants.map((r) => [r.id, r]));
  let unassigned = [...registrants];
  const rooms = [];
  let roomId = 101;
  const used = new Set();

  unassigned
    .filter((r) => r.solo)
    .forEach((r) => {
      rooms.push({
        id: roomId++,
        a: r,
        b: null,
        status: "Solo",
        pairType: "solo",
        price: roomRate + soloUpgrade,
      });
      used.add(r.id);
    });
  unassigned = unassigned.filter((r) => !used.has(r.id));

  // Respect explicit manual pairs first.
  unassigned.forEach((r) => {
    if (used.has(r.id) || !r.manualPairId) return;
    const p = byId.get(r.manualPairId);
    if (!p || used.has(p.id) || p.solo) return;
    if (p.id !== r.id) {
      rooms.push({
        id: roomId++,
        a: r,
        b: p,
        status: "Paired",
        pairType: "manual",
        price: roomRate * 2,
      });
      used.add(r.id);
      used.add(p.id);
    }
  });
  unassigned = unassigned.filter((r) => !used.has(r.id));

  if (autoPair) {
    const pairByGender = (g) => {
      const pool = unassigned.filter((r) => r.gender === g);
      while (pool.length >= 2) {
        const a = pool.pop();
        const b = pool.pop();
        if (!a || !b) break;
        if (!used.has(a.id) && !used.has(b.id)) {
          rooms.push({
            id: roomId++,
            a,
            b,
            status: "Paired",
            pairType: "auto",
            price: roomRate * 2,
          });
          used.add(a.id);
          used.add(b.id);
        }
      }
    };
    // Random pairing rule: gender-specific pools only.
    pairByGender("Male");
    pairByGender("Female");
    unassigned = unassigned.filter((r) => !used.has(r.id));
  }

  // Remaining non-solo delegates still need pairing.
  unassigned.forEach((r) => {
    rooms.push({
      id: roomId++,
      a: r,
      b: null,
      status: "Needs Pairing",
      pairType: "unpaired",
      price: roomRate,
    });
  });

  const order = { "Needs Pairing": 0, Solo: 1, Paired: 2 };
  return rooms.sort((x, y) => (order[x.status] ?? 9) - (order[y.status] ?? 9));
}
