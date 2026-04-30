import { MODULE_DEFS, THEME_PEGS } from "../config/constants";

export default function NewEventWizard({
  open,
  wizardStep,
  setWizardStep,
  workingDraft,
  setWorkingDraft,
  onClose,
  onDeploy,
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-3xl rounded-2xl bg-white p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-xl font-black">New Event Wizard</h3>
          <span className="text-sm text-slate-500">Step {wizardStep} of 2</span>
        </div>

        {wizardStep === 1 && (
          <div className="grid gap-4 md:grid-cols-2">
            {[
              ["Event Title", "title", "text"],
              ["Venue", "venue", "text"],
              ["Date From", "startDate", "date"],
              ["Date To", "endDate", "date"],
              ["Attendee Goal", "attendeeGoal", "number"],
              ["Budget Goal (PHP)", "budgetGoal", "number"],
            ].map(([label, field, type]) => (
              <label className="block" key={field}>
                <span className="mb-1 block text-sm font-semibold">{label}</span>
                <input
                  type={type}
                  min={type === "number" ? 0 : undefined}
                  className="w-full rounded-lg border px-3 py-2"
                  value={workingDraft[field]}
                  onChange={(e) =>
                    setWorkingDraft((prev) => ({
                      ...prev,
                      [field]: type === "number" ? Number(e.target.value || 0) : e.target.value,
                    }))
                  }
                />
              </label>
            ))}
          </div>
        )}

        {wizardStep === 2 && (
          <div className="space-y-4">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              Deploying a new event resets local in-memory records for registrations, sponsors, and expenses.
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold">Branding / Color Peg</p>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                {Object.entries(THEME_PEGS).map(([key, peg]) => (
                  <button
                    key={key}
                    onClick={() => setWorkingDraft((prev) => ({ ...prev, theme: key }))}
                    className={`rounded-lg border px-3 py-2 text-sm ${
                      workingDraft.theme === key ? "border-slate-900" : "border-slate-200"
                    }`}
                  >
                    {peg.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {MODULE_DEFS.map((m) => (
                <button
                  key={m.key}
                  onClick={() =>
                    setWorkingDraft((prev) => ({
                      ...prev,
                      modules: { ...prev.modules, [m.key]: !prev.modules[m.key] },
                    }))
                  }
                  className={`rounded-xl border p-4 text-left ${
                    workingDraft.modules[m.key] ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">{m.title}</p>
                    <span className="text-xs font-bold">
                      {workingDraft.modules[m.key] ? "Include" : "Exclude"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">{m.caption}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-5 flex justify-between">
          <button
            onClick={() => (wizardStep === 1 ? onClose() : setWizardStep(1))}
            className="rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-slate-100"
          >
            {wizardStep === 1 ? "Cancel" : "Back"}
          </button>
          <button
            onClick={() => (wizardStep === 1 ? setWizardStep(2) : onDeploy())}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
          >
            {wizardStep === 1 ? "Next: Provision Modules" : "Deploy Event"}
          </button>
        </div>
      </div>
    </div>
  );
}
