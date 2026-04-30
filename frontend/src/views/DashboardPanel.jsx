import { Activity, Bell, Clock, CreditCard, Layout, PieChart, Users, Zap } from "lucide-react";

export default function DashboardPanel({
  themePeg,
  eventDetails,
  financials,
  sponsors,
  registrations,
  program,
  announcement,
  setAnnouncement,
  handleBroadcast,
  setView,
}) {
  return (
    <div className="max-w-7xl mx-auto space-y-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-5">
          <div className={`p-4 rounded-3xl ${themePeg.light} ${themePeg.text}`}><Activity size={32} /></div>
          <div>
            <h3 className="text-4xl font-black text-slate-800 tracking-tight">Performance Intelligence</h3>
            <p className="text-slate-400 font-bold text-xs uppercase tracking-[0.3em] mt-1">Real-time yield & engagement matrix</p>
          </div>
        </div>
        <div className="bg-white px-8 py-3 rounded-full border-2 border-slate-100 shadow-sm">
          <p className="text-[11px] font-black uppercase tracking-widest text-slate-600">{eventDetails.organizer}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-8">
        {[
          { label: "Total Gross Revenue", value: `₱${financials.totalRev.toLocaleString()}`, icon: CreditCard, color: themePeg.text, sub: `${sponsors.length} Paid Partners` },
          { label: "Net Profit Margin", value: `₱${financials.netProfit.toLocaleString()}`, icon: PieChart, color: "text-emerald-600", sub: "Projected EBITDA" },
          { label: "Attendee Progress", value: `${registrations.length} / ${eventDetails.attendeeGoal}`, icon: Layout, color: "text-white", sub: "Capacity Utilization", isDark: true, goal: eventDetails.attendeeGoal },
          { label: "Live Presence", value: registrations.filter((r) => r.status === "checked-in").length, icon: Users, color: "text-amber-500", sub: "Active On-Site" },
        ].map((stat, i) => (
          <div key={i} className={`${stat.isDark ? "bg-slate-900 text-white" : "bg-white text-slate-800"} p-10 rounded-[48px] shadow-2xl border border-slate-100`}>
            <div className="flex justify-between items-start mb-6">
              <p className={`${stat.isDark ? themePeg.text : "text-slate-400"} text-[11px] font-black uppercase tracking-[0.3em]`}>{stat.label}</p>
              <div className={`${stat.isDark ? "bg-white/10" : "bg-slate-50"} p-3 rounded-2xl`}><stat.icon size={22} className={stat.color} /></div>
            </div>
            <h3 className="text-4xl font-black tracking-tighter leading-none">{stat.value}</h3>
            <p className={`text-[10px] font-black uppercase mt-3 tracking-widest ${stat.isDark ? "text-slate-500" : "text-slate-400"}`}>{stat.sub}</p>
            {stat.isDark && (
              <div className="mt-6 h-2.5 bg-white/10 rounded-full overflow-hidden">
                <div className={`h-full ${themePeg.bg}`} style={{ width: `${Math.min((registrations.length / Math.max(stat.goal, 1)) * 100, 100)}%` }} />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className={`lg:col-span-2 bg-gradient-to-br ${themePeg.bg} to-indigo-900 p-12 rounded-[64px] text-white`}>
          <div className="flex items-center gap-5 mb-10">
            <div className="bg-white/20 p-4 rounded-3xl"><Bell className="animate-bounce" size={32} /></div>
            <h3 className="text-4xl font-black tracking-tighter">Broadcast Center</h3>
          </div>
          <textarea className="w-full bg-white/10 border-2 border-white/10 rounded-[40px] p-8 text-white placeholder:text-white/20 outline-none text-xl font-bold" placeholder="Announcement..." value={announcement} onChange={(e) => setAnnouncement(e.target.value)} rows={4} />
          <div className="flex flex-wrap gap-5 mt-8">
            <button onClick={() => handleBroadcast(announcement)} className="bg-white text-indigo-900 px-12 py-5 rounded-full font-black uppercase tracking-[0.2em] text-xs">Trigger System Broadcast</button>
            <button onClick={() => setAnnouncement("")} className="px-8 py-5 font-black uppercase tracking-widest text-xs text-white/50 hover:text-white">Clear Field</button>
          </div>
        </div>

        <div className="bg-white p-12 rounded-[64px] shadow-2xl border border-slate-100 flex flex-col">
          <div className="flex justify-between items-center mb-12">
            <h3 className="text-2xl font-black text-slate-800 tracking-tighter flex items-center gap-4"><Clock size={28} className={themePeg.text} /> Session Flow</h3>
            <div className="bg-emerald-50 text-emerald-600 p-2 rounded-xl"><Zap size={16} /></div>
          </div>
          <div className="space-y-8 flex-1">
            {program.map((item, idx) => (
              <div key={item.id} className="relative flex items-start gap-6">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black ${item.status === "current" ? `${themePeg.bg} text-white` : "bg-white text-slate-300 border-2 border-slate-50"}`}>{item.status === "current" ? "▶" : idx + 1}</div>
                <div>
                  <p className={`text-[10px] font-black uppercase tracking-[0.3em] ${item.status === "current" ? themePeg.text : "text-slate-300"}`}>{item.time}</p>
                  <h4 className="font-black text-xl leading-tight tracking-tight mt-1 text-slate-800">{item.title}</h4>
                  <p className="text-[10px] text-slate-400 font-bold uppercase mt-2 tracking-widest">{item.location}</p>
                </div>
              </div>
            ))}
          </div>
          <button onClick={() => setView("admin-operations")} className="mt-10 w-full py-4 border-2 border-slate-100 rounded-[24px] text-slate-400 font-black uppercase tracking-[0.3em] text-[10px] hover:border-indigo-100 hover:text-indigo-600">Go To Operations Input</button>
        </div>
      </div>
    </div>
  );
}
