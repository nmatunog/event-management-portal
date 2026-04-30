import { CheckCircle, Download, Filter, Plus } from "lucide-react";

export default function RegistrationPanel({ registrations, themePeg, handleCheckIn, canManage }) {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
        <div>
          <h3 className="text-5xl font-black text-slate-800 tracking-tighter">Attendee Database</h3>
          <p className="text-slate-400 font-bold uppercase tracking-[0.4em] text-[10px] mt-2 italic">Live Presence Tracking & Tier Management</p>
        </div>
        {canManage && (
          <div className="flex gap-4">
            <button className={`${themePeg.bg} text-white px-10 py-5 rounded-[30px] font-black uppercase tracking-widest text-[10px] flex items-center gap-3`}><Plus size={20} /> On-Site Walk-In</button>
          </div>
        )}
      </div>
      <div className="bg-white rounded-[64px] shadow-[0_40px_80px_rgba(0,0,0,0.05)] overflow-hidden border border-slate-100">
        <div className="p-10 border-b border-slate-50 flex flex-wrap gap-4 items-center justify-between bg-slate-50/30">
          <div className="flex gap-3">
            {["All Units", "Checked-In", "Pending", "VIP Only"].map((tab) => (
              <button key={tab} className={`px-8 py-3 rounded-full text-[10px] font-black uppercase tracking-widest ${tab === "All Units" ? `${themePeg.bg} text-white` : "bg-white text-slate-400 border border-slate-100"}`}>{tab}</button>
            ))}
          </div>
          <div className="flex items-center gap-4 text-slate-300"><Filter size={18} /><Download size={18} /></div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[900px]">
            <thead>
              <tr className="bg-white text-slate-300 uppercase text-[9px] font-black tracking-[0.3em]">
                <th className="px-12 py-8">Full Name / Identification</th>
                <th className="px-12 py-8">Registration Status</th>
                <th className="px-12 py-8">Financial Position</th>
                <th className="px-12 py-8 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {registrations.map((r) => (
                <tr key={r.id} className="hover:bg-indigo-50/20 transition-all">
                  <td className="px-12 py-10">
                    <p className="font-black text-xl tracking-tighter text-slate-800">{r.name}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 italic">{r.type} Access</p>
                  </td>
                  <td className="px-12 py-10">
                    <span className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-black text-[10px] uppercase tracking-[0.2em] ${r.status === "checked-in" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"}`}>
                      {r.status === "checked-in" && <CheckCircle size={14} />}
                      {r.status.replace("-", " ")}
                    </span>
                  </td>
                  <td className="px-12 py-10"><p className="font-mono font-bold text-lg text-slate-700">₱{r.paid.toLocaleString()}</p></td>
                  <td className="px-12 py-10 text-right">
                    {r.status !== "checked-in" && canManage ? (
                      <button onClick={() => handleCheckIn(r.id)} className={`${themePeg.bg} text-white px-8 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest`}>Confirm Check-In</button>
                    ) : (
                      <button className="text-slate-200 hover:text-indigo-400"><Download size={24} /></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
