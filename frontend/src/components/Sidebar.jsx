import { Calendar, ChevronRight, ClipboardList, Layout, Megaphone, Plus, Settings, Smartphone, Users, X } from "lucide-react";

export default function Sidebar({
  isSidebarOpen,
  setSidebarOpen,
  view,
  setView,
  setWizardOpen,
  setShowSignage,
  themePeg,
  isAdmin,
  canManage,
}) {
  const adminItems = [
    { id: "admin-overview", icon: Layout, label: "Admin Overview" },
    { id: "admin-operations", icon: ClipboardList, label: "Operations Input" },
    { id: "admin-communications", icon: Megaphone, label: "Comms + Signage" },
    { id: "admin-setup", icon: Settings, label: "Event Setup Wizard", show: isAdmin },
  ].filter((item) => item.show !== false);

  const participantItems = [
    { id: "participant-home", icon: Users, label: "Participant Home" },
    { id: "participant-schedule", icon: Calendar, label: "Schedule" },
  ];

  const navItems = canManage ? adminItems : participantItems;

  return (
    <>
      {!isSidebarOpen && <div className="lg:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setSidebarOpen(true)} />}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-72 bg-slate-900 text-white flex flex-col transition-transform duration-300 ease-in-out ${isSidebarOpen ? "-translate-x-full lg:translate-x-0" : "translate-x-0"}`}>
        <div className="p-8 border-b border-slate-800 flex justify-between items-center">
          <div>
            <h1 className={`text-2xl font-black italic tracking-tighter ${themePeg.text}`}>VibeEvent Pro</h1>
            <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500 font-bold">{canManage ? "Admin Command Center" : "Participant Portal"}</p>
          </div>
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-slate-400 hover:text-white"><X size={24} /></button>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto custom-scrollbar">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setView(item.id);
                if (window.innerWidth < 1024) setSidebarOpen(true);
              }}
              className={`w-full flex items-center gap-4 p-4 rounded-[20px] transition-all duration-300 group ${view === item.id ? `${themePeg.bg} text-white shadow-xl ${themePeg.shadow}` : "text-slate-400 hover:bg-slate-800 hover:text-white"}`}
            >
              <item.icon size={22} className={`${view === item.id ? "scale-110" : "group-hover:scale-110"} transition-transform`} />
              <span className="font-bold text-sm tracking-tight">{item.label}</span>
              {view === item.id && <ChevronRight size={18} className="ml-auto opacity-40" />}
            </button>
          ))}
        </nav>

        <div className="p-6 bg-slate-950/50 border-t border-slate-800 space-y-3">
          {isAdmin && canManage && (
            <button onClick={() => setWizardOpen(true)} className={`w-full ${themePeg.bg} bg-opacity-10 hover:bg-opacity-100 ${themePeg.text} hover:text-white p-4 rounded-2xl flex items-center justify-center gap-3 font-black uppercase text-[10px] tracking-widest transition-all duration-300`}><Plus size={18} /> New Event</button>
          )}
          {canManage && (
            <button onClick={() => setShowSignage(true)} className="w-full bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white p-4 rounded-2xl flex items-center justify-center gap-3 font-black uppercase text-[10px] tracking-widest transition-all duration-300 shadow-lg"><Smartphone size={18} /> Open Big Screen</button>
          )}
        </div>
      </aside>
    </>
  );
}
