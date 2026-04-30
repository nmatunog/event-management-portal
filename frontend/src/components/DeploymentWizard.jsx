import { useState } from "react";
import { AlertTriangle, Briefcase, ChevronRight, CreditCard, Hotel, Layout, X, Zap } from "lucide-react";
import { THEME_PEGS } from "../config/portalData";

export default function DeploymentWizard({
  isOpen,
  setWizardOpen,
  deployNewEvent,
  eventDetails,
  config,
  themePeg,
}) {
  if (!isOpen) return null;
  const [step, setStep] = useState(1);
  const totalSteps = 5;
  const [formData, setFormData] = useState({ ...eventDetails });
  const [moduleConfig, setModuleConfig] = useState({ ...config });
  const [selectedThemeId, setSelectedThemeId] = useState(eventDetails.themeId ?? themePeg.id);
  const [registrationFees, setRegistrationFees] = useState(
    eventDetails.registrationFees ?? [
      { label: "Member", amount: 8000, inclusions: "2-day access, kit, meals" },
      { label: "Non-member", amount: 9500, inclusions: "2-day access, kit, meals" },
      { label: "Student", amount: 4500, inclusions: "sessions + certificate" },
    ]
  );
  const [sponsorshipPackages, setSponsorshipPackages] = useState(
    eventDetails.sponsorshipPackages ?? [
      { tier: "Platinum", amount: 250000, inclusions: "Prime booth, stage mention, full-page ad" },
      { tier: "Gold", amount: 150000, inclusions: "Booth, session mention, half-page ad" },
      { tier: "Silver", amount: 100000, inclusions: "Booth, logo placement" },
    ]
  );
  const [projection, setProjection] = useState(
    eventDetails.financialProjection ?? {
      projectedCollections: 560000,
      projectedAdditionalCollections: 0,
      projectedSponsorshipA: 250000,
      projectedSponsorshipB: 100000,
      projectedExpenses: 866286,
    }
  );

  const setForm = (key, value) => setFormData((prev) => ({ ...prev, [key]: value }));
  const setModule = (key, value) => setModuleConfig((prev) => ({ ...prev, [key]: value }));

  const stepTitle = {
    1: "Event Identity",
    2: "Audience & Registration",
    3: "Program Design",
    4: "Finance & Commercial",
    5: "Logistics, Theme & Review",
  }[step];

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-xl flex items-center justify-center p-6">
      <div className={`bg-white w-full max-w-4xl max-h-[92vh] rounded-[64px] shadow-2xl overflow-hidden border-8 ${themePeg.light} flex flex-col`}>
        <div className={`${themePeg.bg} p-12 text-white relative overflow-hidden`}>
          <button onClick={() => setWizardOpen(false)} className="absolute top-8 right-8 p-3 hover:bg-white/10 rounded-full transition-colors z-20"><X size={28} /></button>
          <div className="relative z-10">
            <div className="flex items-center gap-4 mb-3">
              <Zap className="text-white fill-white" size={32} />
              <h2 className="text-4xl font-black italic tracking-tighter uppercase leading-none">Event Provisioning</h2>
            </div>
            <p className="font-bold opacity-80 uppercase text-xs tracking-[0.3em]">Step {step} of {totalSteps} — {stepTitle}</p>
          </div>
        </div>

        <div className="p-12 overflow-y-auto custom-scrollbar flex-1">
          {step === 1 && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="space-y-2 md:col-span-2">
                  <span className="text-xs font-black uppercase tracking-widest text-slate-400">Event Title</span>
                  <input type="text" value={formData.title} className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl outline-none" onChange={(e) => setForm("title", e.target.value)} />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-black uppercase tracking-widest text-slate-400">Organizer</span>
                  <input type="text" value={formData.organizer || ""} className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl outline-none" onChange={(e) => setForm("organizer", e.target.value)} />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-black uppercase tracking-widest text-slate-400">Event Type</span>
                  <input type="text" value={formData.eventType || "Corporate Conference"} className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl outline-none" onChange={(e) => setForm("eventType", e.target.value)} />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-black uppercase tracking-widest text-slate-400">Start Date</span>
                  <input type="date" value={formData.startDate} className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl outline-none" onChange={(e) => setForm("startDate", e.target.value)} />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-black uppercase tracking-widest text-slate-400">End Date</span>
                  <input type="date" value={formData.endDate} className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl outline-none" onChange={(e) => setForm("endDate", e.target.value)} />
                </label>
                <label className="space-y-2 md:col-span-2">
                  <span className="text-xs font-black uppercase tracking-widest text-slate-400">Venue</span>
                  <input type="text" value={formData.venue} className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl outline-none" onChange={(e) => setForm("venue", e.target.value)} />
                </label>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="space-y-2">
                  <span className="text-xs font-black uppercase tracking-widest text-slate-400">Attendee Goal</span>
                  <input type="number" value={formData.attendeeGoal} className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl outline-none" onChange={(e) => setForm("attendeeGoal", Number(e.target.value || 0))} />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-black uppercase tracking-widest text-slate-400">Registration Mode</span>
                  <select className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl outline-none" value={formData.registrationMode || "open"} onChange={(e) => setForm("registrationMode", e.target.value)}>
                    <option value="open">Open registration</option>
                    <option value="approval">Approval required</option>
                    <option value="invite">Invitation only</option>
                  </select>
                </label>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-5 rounded-2xl border">
                  <div>
                    <p className="font-black">Enable Installment Billing</p>
                    <p className="text-xs text-slate-500">Useful for corporate delegates with staggered payments.</p>
                  </div>
                  <button onClick={() => setModule("hasInstallments", !moduleConfig.hasInstallments)} className={`w-14 h-8 rounded-full flex items-center px-1 ${moduleConfig.hasInstallments ? themePeg.bg : "bg-slate-200"}`}>
                    <span className={`h-6 w-6 rounded-full bg-white transition-transform ${moduleConfig.hasInstallments ? "translate-x-6" : ""}`} />
                  </button>
                </div>
                <div className="flex items-center justify-between p-5 rounded-2xl border">
                  <div>
                    <p className="font-black">Enable Invitation Module</p>
                    <p className="text-xs text-slate-500">Send curated invitations for key clients and executives.</p>
                  </div>
                  <button onClick={() => setModule("invitations", !moduleConfig.invitations)} className={`w-14 h-8 rounded-full flex items-center px-1 ${moduleConfig.invitations ? themePeg.bg : "bg-slate-200"}`}>
                    <span className={`h-6 w-6 rounded-full bg-white transition-transform ${moduleConfig.invitations ? "translate-x-6" : ""}`} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <label className="space-y-2">
                  <span className="text-xs font-black uppercase tracking-widest text-slate-400">Tracks</span>
                  <input type="number" value={formData.programTracks || 1} className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl outline-none" onChange={(e) => setForm("programTracks", Number(e.target.value || 1))} />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-black uppercase tracking-widest text-slate-400">Avg Session (mins)</span>
                  <input type="number" value={formData.sessionDuration || 45} className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl outline-none" onChange={(e) => setForm("sessionDuration", Number(e.target.value || 45))} />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-black uppercase tracking-widest text-slate-400">Plenary Count</span>
                  <input type="number" value={formData.plenaryCount || 1} className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl outline-none" onChange={(e) => setForm("plenaryCount", Number(e.target.value || 1))} />
                </label>
              </div>
              <div className="flex items-center justify-between p-5 rounded-2xl border">
                <div>
                  <p className="font-black">Enable Program Flow Module</p>
                  <p className="text-xs text-slate-500">Required for multi-session corporate events.</p>
                </div>
                <button onClick={() => setModule("enableProgram", !moduleConfig.enableProgram)} className={`w-14 h-8 rounded-full flex items-center px-1 ${moduleConfig.enableProgram ? themePeg.bg : "bg-slate-200"}`}>
                  <span className={`h-6 w-6 rounded-full bg-white transition-transform ${moduleConfig.enableProgram ? "translate-x-6" : ""}`} />
                </button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="space-y-2">
                  <span className="text-xs font-black uppercase tracking-widest text-slate-400">Budget Goal (PHP)</span>
                  <input type="number" value={formData.budgetGoal} className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl outline-none" onChange={(e) => setForm("budgetGoal", Number(e.target.value || 0))} />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-black uppercase tracking-widest text-slate-400">Payment Terms</span>
                  <input type="text" value={formData.paymentTerms || "Net 30"} className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl outline-none" onChange={(e) => setForm("paymentTerms", e.target.value)} />
                </label>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { key: "hasSponsors", label: "Enable Sponsorship Module", desc: "Track partner tiers and contracts", icon: Briefcase },
                  { key: "hasInstallments", label: "Enable Payment Installments", desc: "Allow staged attendee payments", icon: CreditCard },
                ].map((mod) => (
                  <div key={mod.key} className="flex items-center justify-between p-5 rounded-2xl border">
                    <div className="flex items-center gap-3">
                      <mod.icon size={18} />
                      <div>
                        <p className="font-black text-sm">{mod.label}</p>
                        <p className="text-xs text-slate-500">{mod.desc}</p>
                      </div>
                    </div>
                    <button onClick={() => setModule(mod.key, !moduleConfig[mod.key])} className={`w-14 h-8 rounded-full flex items-center px-1 ${moduleConfig[mod.key] ? themePeg.bg : "bg-slate-200"}`}>
                      <span className={`h-6 w-6 rounded-full bg-white transition-transform ${moduleConfig[mod.key] ? "translate-x-6" : ""}`} />
                    </button>
                  </div>
                ))}
              </div>

              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="font-black text-sm mb-3">Registration Fees</p>
                <div className="space-y-2">
                  {registrationFees.map((fee, idx) => (
                    <div key={`${fee.label}-${idx}`} className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <input className="rounded-xl border px-3 py-2" value={fee.label} onChange={(e) => setRegistrationFees((prev) => prev.map((f, i) => (i === idx ? { ...f, label: e.target.value } : f)))} placeholder="Tier label" />
                      <input type="number" className="rounded-xl border px-3 py-2" value={fee.amount} onChange={(e) => setRegistrationFees((prev) => prev.map((f, i) => (i === idx ? { ...f, amount: Number(e.target.value || 0) } : f)))} placeholder="Amount" />
                      <input className="rounded-xl border px-3 py-2" value={fee.inclusions} onChange={(e) => setRegistrationFees((prev) => prev.map((f, i) => (i === idx ? { ...f, inclusions: e.target.value } : f)))} placeholder="Inclusions" />
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setRegistrationFees((prev) => [...prev, { label: "Custom Tier", amount: 0, inclusions: "" }])}
                  className="mt-3 text-xs font-bold px-3 py-2 rounded-lg border hover:bg-slate-50"
                >
                  + Add Registration Tier
                </button>
              </div>

              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="font-black text-sm mb-3">Sponsorship Levels & Inclusions</p>
                <div className="space-y-2">
                  {sponsorshipPackages.map((pkg, idx) => (
                    <div key={`${pkg.tier}-${idx}`} className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <input className="rounded-xl border px-3 py-2" value={pkg.tier} onChange={(e) => setSponsorshipPackages((prev) => prev.map((p, i) => (i === idx ? { ...p, tier: e.target.value } : p)))} placeholder="Tier" />
                      <input type="number" className="rounded-xl border px-3 py-2" value={pkg.amount} onChange={(e) => setSponsorshipPackages((prev) => prev.map((p, i) => (i === idx ? { ...p, amount: Number(e.target.value || 0) } : p)))} placeholder="Amount" />
                      <input className="rounded-xl border px-3 py-2" value={pkg.inclusions} onChange={(e) => setSponsorshipPackages((prev) => prev.map((p, i) => (i === idx ? { ...p, inclusions: e.target.value } : p)))} placeholder="Inclusions" />
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setSponsorshipPackages((prev) => [...prev, { tier: "Custom", amount: 0, inclusions: "" }])}
                  className="mt-3 text-xs font-bold px-3 py-2 rounded-lg border hover:bg-slate-50"
                >
                  + Add Sponsorship Tier
                </button>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { key: "hasHotel", label: "Hotel & Travel Logistics", icon: Hotel },
                  { key: "isExhibition", label: "Exhibitor Floor Mapping", icon: Layout },
                ].map((mod) => (
                  <div key={mod.key} className="flex items-center justify-between p-5 rounded-2xl border">
                    <div className="flex items-center gap-3">
                      <mod.icon size={18} />
                      <p className="font-black text-sm">{mod.label}</p>
                    </div>
                    <button onClick={() => setModule(mod.key, !moduleConfig[mod.key])} className={`w-14 h-8 rounded-full flex items-center px-1 ${moduleConfig[mod.key] ? themePeg.bg : "bg-slate-200"}`}>
                      <span className={`h-6 w-6 rounded-full bg-white transition-transform ${moduleConfig[mod.key] ? "translate-x-6" : ""}`} />
                    </button>
                  </div>
                ))}
              </div>

              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2 mb-3">Corporate Event Theme</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {THEME_PEGS.map((theme) => (
                    <button key={theme.id} onClick={() => setSelectedThemeId(theme.id)} className={`rounded-2xl border p-3 text-left ${selectedThemeId === theme.id ? `${theme.border} bg-white shadow-md` : "border-slate-200 bg-slate-50"}`}>
                      <div className="flex items-center gap-2">
                        <span className={`inline-block h-3 w-3 rounded-full ${theme.bg}`} />
                        <span className="text-xs font-black text-slate-700">{theme.name}</span>
                      </div>
                      <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-wide">{theme.category}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="font-black text-sm mb-2">Review Summary</p>
                <p className="text-sm text-slate-600">{formData.title} • {formData.venue} • {formData.startDate} to {formData.endDate}</p>
                <p className="text-xs text-slate-500 mt-1">Attendee goal: {formData.attendeeGoal} • Budget goal: PHP {formData.budgetGoal}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="font-black text-sm mb-2">Financial Projection (Corporate Template)</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label className="text-xs font-bold text-slate-500">
                    Collections from members
                    <input type="number" className="mt-1 w-full rounded-xl border px-3 py-2" value={projection.projectedCollections} onChange={(e) => setProjection((p) => ({ ...p, projectedCollections: Number(e.target.value || 0) }))} />
                  </label>
                  <label className="text-xs font-bold text-slate-500">
                    Additional collections (solo rooms, etc.)
                    <input type="number" className="mt-1 w-full rounded-xl border px-3 py-2" value={projection.projectedAdditionalCollections} onChange={(e) => setProjection((p) => ({ ...p, projectedAdditionalCollections: Number(e.target.value || 0) }))} />
                  </label>
                  <label className="text-xs font-bold text-slate-500">
                    Sponsorship projection A
                    <input type="number" className="mt-1 w-full rounded-xl border px-3 py-2" value={projection.projectedSponsorshipA} onChange={(e) => setProjection((p) => ({ ...p, projectedSponsorshipA: Number(e.target.value || 0) }))} />
                  </label>
                  <label className="text-xs font-bold text-slate-500">
                    Sponsorship projection B
                    <input type="number" className="mt-1 w-full rounded-xl border px-3 py-2" value={projection.projectedSponsorshipB} onChange={(e) => setProjection((p) => ({ ...p, projectedSponsorshipB: Number(e.target.value || 0) }))} />
                  </label>
                  <label className="text-xs font-bold text-slate-500 md:col-span-2">
                    Total projected expenses
                    <input type="number" className="mt-1 w-full rounded-xl border px-3 py-2" value={projection.projectedExpenses} onChange={(e) => setProjection((p) => ({ ...p, projectedExpenses: Number(e.target.value || 0) }))} />
                  </label>
                </div>
                <p className="mt-3 text-sm font-bold text-slate-700">
                  Projected net surplus: PHP{" "}
                  {(
                    projection.projectedCollections +
                    projection.projectedAdditionalCollections +
                    projection.projectedSponsorshipA +
                    projection.projectedSponsorshipB -
                    projection.projectedExpenses
                  ).toLocaleString()}
                </p>
              </div>
              <div className="bg-rose-50 p-4 rounded-2xl border border-rose-100 flex gap-3">
                <AlertTriangle className="text-rose-500 flex-shrink-0" size={20} />
                <p className="text-[11px] font-bold text-rose-800 leading-relaxed uppercase italic">Deploying will reset current in-memory working data to start this new event cleanly.</p>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-slate-100 bg-white px-12 py-6">
          {step < totalSteps ? (
            <div className="flex justify-between gap-4">
              <button onClick={() => setStep((prev) => Math.max(1, prev - 1))} className={`px-8 py-4 rounded-full font-black uppercase tracking-widest text-xs ${step === 1 ? "text-slate-300 cursor-not-allowed" : "text-slate-500 hover:bg-slate-50"}`} disabled={step === 1}>
                Back
              </button>
              <button onClick={() => setStep((prev) => Math.min(totalSteps, prev + 1))} className={`${themePeg.bg} text-white px-10 py-4 rounded-full font-black uppercase tracking-widest text-xs flex items-center gap-3`}>
                Next Step <ChevronRight size={18} />
              </button>
            </div>
          ) : (
            <div className="flex gap-4">
              <button onClick={() => setStep(totalSteps - 1)} className="flex-1 py-4 rounded-full font-black uppercase tracking-widest text-xs text-slate-400 hover:bg-slate-50 transition-all italic">Go Back</button>
              <button
                onClick={() =>
                  deployNewEvent(
                    {
                      ...formData,
                      themeId: selectedThemeId,
                      registrationFees,
                      sponsorshipPackages,
                      financialProjection: projection,
                    },
                    moduleConfig
                  )
                }
                className={`flex-[2] ${themePeg.bg} text-white py-4 rounded-full font-black uppercase tracking-widest text-xs flex items-center justify-center gap-3`}
              >
                <Zap size={18} /> Deploy Event Architecture
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
