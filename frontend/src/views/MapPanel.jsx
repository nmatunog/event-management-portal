export default function MapPanel({ sponsors, themePeg }) {
  return (
    <div className="max-w-7xl mx-auto">
      <h3 className="text-5xl font-black text-slate-800 tracking-tighter italic mb-8">Interactive Mapping</h3>
      <div className="bg-white p-16 rounded-[80px] shadow-2xl border border-slate-100 relative overflow-hidden">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-8 relative z-10">
          {[...Array(18)].map((_, i) => {
            const boothNum = `A${i + 1}`;
            const isSponsor = sponsors.find((s) => s.booth === boothNum);
            return (
              <div key={boothNum} className={`h-40 rounded-[40px] flex flex-col items-center justify-center border-4 transition-all cursor-pointer ${isSponsor ? `bg-slate-900 ${themePeg.border} text-white` : "bg-slate-50 border-slate-100 text-slate-300"}`}>
                <span className="text-[9px] font-black uppercase tracking-[0.2em] mb-3 opacity-60">{isSponsor?.tier || "Available"}</span>
                <span className="text-4xl font-black italic tracking-tighter">{boothNum}</span>
                <p className="text-[10px] font-bold mt-4 line-clamp-1 px-4">{isSponsor?.company || "---"}</p>
              </div>
            );
          })}
        </div>
        <div className="mt-16 w-full h-24 bg-slate-900 rounded-[40px] flex items-center justify-center font-black text-white uppercase tracking-[1.5em] text-[11px]">Main Plenary Lobby Entrance</div>
      </div>
    </div>
  );
}
