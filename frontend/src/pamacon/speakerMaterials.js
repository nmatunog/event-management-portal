export const SPEAKER_MATERIALS_MAX = 24;

/** Featured deck shown first in the attendee presentation stack. */
export function isPinnedSpeakerMaterial(title) {
  const t = String(title || "").trim().toLowerCase();
  return t.includes("rise with the current") && (t.includes("eric nicdao") || t.includes("nicdao"));
}

export function sortSpeakerMaterialsPinnedFirst(items) {
  return [...items].sort((a, b) => {
    const aPinned = isPinnedSpeakerMaterial(a.title) ? 0 : 1;
    const bPinned = isPinnedSpeakerMaterial(b.title) ? 0 : 1;
    return aPinned - bPinned;
  });
}

/** Admin-configured Google Drive (or any) links for speaker notes / slide PDFs. */
export function normalizeSpeakerMaterials(value) {
  if (!Array.isArray(value)) return [];
  return sortSpeakerMaterialsPinnedFirst(
    value
    .map((row, i) => {
      const viewUrl = String(row?.viewUrl ?? row?.url ?? "").trim();
      const downloadUrl = String(row?.downloadUrl ?? "").trim();
      const title = String(row?.title ?? "").trim() || `Speaker material ${i + 1}`;
      const source = row?.source === "upload" ? "upload" : "link";
      return {
        id: String(row?.id || `speaker-material-${i}`),
        fileId: String(row?.fileId || "").trim(),
        title,
        viewUrl,
        downloadUrl: downloadUrl || viewUrl,
        source,
      };
    })
    .filter((r) => r.viewUrl)
    .slice(0, SPEAKER_MATERIALS_MAX)
  );
}

export function emptySpeakerMaterialRow() {
  return {
    id: `sm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: "",
    viewUrl: "",
    downloadUrl: "",
  };
}
