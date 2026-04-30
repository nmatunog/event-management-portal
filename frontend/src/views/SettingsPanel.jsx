import { Activity, Briefcase, CreditCard, Layout, Palette } from "lucide-react";
import { THEME_PEGS } from "../config/portalData";

export default function SettingsPanel({ themePeg, setThemePeg, config, setConfig }) {
  const roleMatrix = [
    { feature: "Create / Edit Events", admin: true, staff: true, attendee: false },
    { feature: "Configure Wizard + Theme Pegs", admin: true, staff: false, attendee: false },
    { feature: "Check-In / Walk-In Actions", admin: true, staff: true, attendee: false },
    { feature: "View Registration Dashboard", admin: true, staff: true, attendee: true },
    { feature: "Broadcast Signage Alerts", admin: true, staff: true, attendee: false },
  ];

  const AccessPill = ({ enabled }) => (
    <span
      className={`inline-flex items-center justify-center min-w-16 rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-widest ${
        enabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"
      }`}
    >
      {enabled ? "Allow" : "Deny"}
    </span>
  );

  return (
    <div className="max-w-4xl mx-auto pb-20">
      <h3 className="text-5xl font-black text-slate-800 tracking-tighter italic mb-12">Wizard Configuration</h3>
      <section className="mb-16">
        <div className="flex items-center gap-4 mb-8">
          <div className={`p-3 rounded-2xl ${themePeg.light} ${themePeg.text}`}><Palette size={28} /></div>
          <h4 className="font-black text-2xl uppercase tracking-widest text-slate-800 italic">Branding Color Pegs</h4>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
          {THEME_PEGS.map((peg) => (
            <button key={peg.id} onClick={() => setThemePeg(peg)} className={`p-6 rounded-[32px] border-4 ${themePeg.id === peg.id ? `${themePeg.border} bg-white shadow-2xl` : "border-transparent bg-white shadow-sm opacity-60 hover:opacity-100"}`}>
              <div className={`w-12 h-12 mx-auto rounded-[14px] ${peg.bg}`} />
              <span className="text-[11px] font-black uppercase tracking-tighter text-slate-700 leading-tight mt-3 block">{peg.name}</span>
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mt-1 block">{peg.category}</span>
            </button>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {[
          { key: "hasSponsors", label: "Sponsorship Hub", desc: "Centralize partner tiers and ROI logs.", icon: Briefcase },
          { key: "hasInstallments", label: "Payment Logic", desc: "Automated installment and ledger flow.", icon: CreditCard },
          { key: "isExhibition", label: "Interactive Mapping", desc: "Dynamic floor plans and booth inventory.", icon: Layout },
          { key: "vibrantTheme", label: "UI Motion Engine", desc: "Immersive transitions and micro-interactions.", icon: Activity },
        ].map((item) => (
          <div key={item.key} className="flex flex-col p-8 bg-white rounded-[32px] shadow-xl border">
            <div className="flex justify-between items-start mb-6">
              <div className={`p-4 rounded-2xl ${config[item.key] ? `${themePeg.bg} text-white` : "bg-slate-100 text-slate-300"}`}><item.icon size={24} /></div>
              <button onClick={() => setConfig((prev) => ({ ...prev, [item.key]: !prev[item.key] }))} className={`w-16 h-9 rounded-full transition-all flex items-center px-1.5 ${config[item.key] ? themePeg.bg : "bg-slate-200"}`}>
                <div className={`w-6 h-6 bg-white rounded-full shadow-xl transition-transform ${config[item.key] ? "translate-x-7" : "translate-x-0"}`} />
              </button>
            </div>
            <h4 className="font-black text-2xl text-slate-800 tracking-tight italic">{item.label}</h4>
            <p className="text-[11px] text-slate-400 font-bold mt-3 leading-relaxed uppercase tracking-wide">{item.desc}</p>
          </div>
        ))}
      </div>

      <section className="mt-16">
        <h4 className="font-black text-2xl uppercase tracking-widest text-slate-800 italic mb-6">Role Access Matrix</h4>
        <div className="rounded-[32px] border border-slate-200 bg-white shadow-xl overflow-hidden">
          <div className="grid grid-cols-4 gap-0 border-b border-slate-100 bg-slate-50">
            <div className="p-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Capability</div>
            <div className="p-4 text-center text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Admin</div>
            <div className="p-4 text-center text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Staff</div>
            <div className="p-4 text-center text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Attendee</div>
          </div>
          {roleMatrix.map((row) => (
            <div key={row.feature} className="grid grid-cols-4 gap-0 border-b border-slate-50 last:border-b-0">
              <div className="p-4 text-sm font-semibold text-slate-700">{row.feature}</div>
              <div className="p-4 flex justify-center"><AccessPill enabled={row.admin} /></div>
              <div className="p-4 flex justify-center"><AccessPill enabled={row.staff} /></div>
              <div className="p-4 flex justify-center"><AccessPill enabled={row.attendee} /></div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
