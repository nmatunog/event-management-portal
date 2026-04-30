export default function ParticipantPanel({ eventDetails, program, registrations, mode = "home" }) {
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-3xl font-black text-slate-800">{mode === "schedule" ? "Participant Schedule" : "Participant Dashboard"}</h3>
        <p className="text-slate-500 mt-2">Welcome to {eventDetails.title}. This portal is focused on attendee essentials and event-day updates.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h4 className="text-xl font-black mb-3">{mode === "schedule" ? "Full Schedule" : "Program Highlights"}</h4>
          <div className="space-y-3">
            {program.length === 0 && <p className="text-slate-500 text-sm">Program updates will appear here.</p>}
            {program.map((item) => (
              <div key={item.id} className="rounded-xl border border-slate-100 p-3">
                <p className="text-xs font-black uppercase tracking-wider text-slate-400">{item.time || item.start_time || "TBA"}</p>
                <p className="font-bold text-slate-800">{item.title}</p>
                <p className="text-xs text-slate-500">{item.location}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h4 className="text-xl font-black mb-3">{mode === "schedule" ? "Participant Notes" : "Participation Status"}</h4>
          <p className="text-sm text-slate-600 mb-3">Total registrations loaded: {registrations.length}</p>
          <p className="text-sm text-slate-600">{mode === "schedule" ? "Schedule adjustments will be announced in real time on signage and this portal." : "Please contact admin desk for registration changes or payment concerns."}</p>
        </section>
      </div>
    </div>
  );
}
