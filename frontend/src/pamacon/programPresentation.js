/** Google Drive presentation links on program module rows (attendee portal). */

export function normalizeProgramModuleRow(row, index = 0) {
  const presentationViewUrl = String(row?.presentationViewUrl ?? row?.presentationUrl ?? "").trim();
  const presentationDownloadUrl = String(row?.presentationDownloadUrl ?? "").trim();
  return {
    day: String(row?.day || "").trim(),
    time: String(row?.time || "").trim(),
    program: String(row?.program || "").trim(),
    assigned: String(row?.assigned || "").trim(),
    presentationViewUrl,
    presentationDownloadUrl: presentationDownloadUrl || presentationViewUrl,
    hasPresentation: Boolean(presentationViewUrl),
    id: String(row?.id || `${index}-${String(row?.day || "")}-${String(row?.time || "")}`),
  };
}

export function emptyProgramModuleRow(day = "Day 2 - May 14") {
  return {
    day,
    time: "",
    program: "",
    assigned: "",
    presentationViewUrl: "",
    presentationDownloadUrl: "",
  };
}
