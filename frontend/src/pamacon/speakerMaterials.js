export const SPEAKER_MATERIALS_MAX = 24;

/** Admin-configured Google Drive (or any) links for speaker notes / slide PDFs. */
export function normalizeSpeakerMaterials(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((row, i) => {
      const viewUrl = String(row?.viewUrl ?? row?.url ?? "").trim();
      const downloadUrl = String(row?.downloadUrl ?? "").trim();
      const title = String(row?.title ?? "").trim() || `Speaker material ${i + 1}`;
      return {
        id: String(row?.id || `speaker-material-${i}`),
        title,
        viewUrl,
        downloadUrl: downloadUrl || viewUrl,
      };
    })
    .filter((r) => r.viewUrl)
    .slice(0, SPEAKER_MATERIALS_MAX);
}

export function emptySpeakerMaterialRow() {
  return {
    id: `sm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: "",
    viewUrl: "",
    downloadUrl: "",
  };
}
