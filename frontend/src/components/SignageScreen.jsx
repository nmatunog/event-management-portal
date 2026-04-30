import { AlertTriangle, X } from "lucide-react";

export default function SignageScreen({ showSignage, setShowSignage, themePeg, eventDetails, sponsors, program, announcement }) {
  if (!showSignage) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950 text-white flex flex-col overflow-hidden font-sans">
      <div className={`h-28 ${themePeg.bg} flex justify-between items-center px-16 shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative z-10`}>
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 bg-white rounded-[24px] flex items-center justify-center shadow-2xl transform rotate-12">
            <span className={`${themePeg.text} text-3xl font-black italic`}>{eventDetails.title.charAt(0)}</span>
          </div>
          <h2 className="text-4xl font-black tracking-tighter italic uppercase">{eventDetails.title}</h2>
        </div>
        <button onClick={() => setShowSignage(false)} className="bg-white/10 hover:bg-white/20 p-3 rounded-2xl transition-all group border border-white/10 shadow-xl"><X size={28} className="group-hover:rotate-90 transition-transform" /></button>
      </div>

      <main className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-12 p-16 overflow-hidden">
        <div className="col-span-1 md:col-span-8 space-y-12">
          <div className={`bg-white/5 border-l-[32px] ${themePeg.border} p-16 rounded-[72px] backdrop-blur-3xl shadow-[0_40px_80px_rgba(0,0,0,0.3)] border border-white/10`}>
            <p className={`${themePeg.text} font-black text-3xl mb-8 tracking-[0.3em]`}>HAPPENING NOW</p>
            <h1 className="text-6xl lg:text-8xl font-black leading-[1] mb-12 tracking-tighter uppercase">
              {program.length > 0 ? (program.find((p) => p.status === "current")?.title || "Networking Break") : "Event Loading..."}
            </h1>
            <span className="bg-white/10 border-2 border-white/10 px-10 py-4 rounded-[28px] text-2xl font-black backdrop-blur-md uppercase tracking-widest text-white/80">📍 {eventDetails.venue}</span>
          </div>
        </div>

        <div className="col-span-1 md:col-span-4 space-y-12 flex flex-col">
          <div className="bg-white p-12 rounded-[72px] text-center text-slate-900 shadow-2xl">
            <p className={`font-black mb-10 uppercase tracking-[0.5em] ${themePeg.text} text-sm`}>Join the Portal</p>
            <p className="mt-4 text-3xl font-black tracking-tighter text-slate-800">portal.vibeevent.com</p>
          </div>
          <div className="flex-1 bg-slate-900/50 rounded-[64px] p-12 border-2 border-white/5 overflow-hidden">
            <p className="text-slate-500 font-black text-center mb-10 uppercase tracking-[0.4em]">Our Partners</p>
            <div className="space-y-6">
              {sponsors.filter((s) => s.tier === "Platinum").map((s) => (
                <div key={s.id} className="h-28 bg-white/5 border-2 border-white/5 rounded-[36px] flex items-center justify-center font-black text-4xl text-slate-200 uppercase tracking-tighter">
                  {s.company}
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {announcement && (
        <div className="h-32 bg-rose-600 flex items-center overflow-hidden shadow-[0_-20px_60px_rgba(225,29,72,0.6)]">
          <div className="flex animate-marquee whitespace-nowrap text-6xl font-black uppercase tracking-tighter text-white">
            <span className="mx-16 flex items-center gap-8"><AlertTriangle size={56} /> {announcement}</span>
            <span className="mx-16 flex items-center gap-8"><AlertTriangle size={56} /> {announcement}</span>
          </div>
        </div>
      )}
    </div>
  );
}
