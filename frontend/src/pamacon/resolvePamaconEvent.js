import { getEvents } from "../lib/api";

/** Resolve the active PAMACON event row (pinned id or title match). */
export async function resolvePamaconEvent() {
  const pinned = import.meta.env.VITE_PAMACON_EVENT_ID;
  const { items } = await getEvents();
  let ev = (items || []).find((x) => String(x.title || "").includes("PAMACON"));
  if (pinned) ev = (items || []).find((x) => x.id === pinned) || ev;
  return ev || null;
}
