export default function SignageView({ eventData }) {
  return (
    <section className="rounded-2xl border bg-slate-950 p-6 text-white">
      <p className="text-xs uppercase tracking-widest text-slate-400">Digital Signage Preview</p>
      <h2 className="mt-2 text-4xl font-black">{eventData.title}</h2>
      <p className="mt-1 text-slate-300">
        {eventData.startDate} - {eventData.endDate} • {eventData.venue}
      </p>
      <div className="mt-6 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl bg-slate-900 p-4">
          <p className="text-sm uppercase text-slate-400">Now Playing</p>
          <p className="mt-2 text-2xl font-bold">Opening Ceremony</p>
          <p className="text-sm text-slate-400">Hall A • Ends in 45 mins</p>
        </div>
        <div className="rounded-xl bg-slate-900 p-4">
          <p className="text-sm uppercase text-slate-400">Announcement</p>
          <p className="mt-2 text-2xl font-bold">Please proceed to registration desk.</p>
        </div>
      </div>
    </section>
  );
}
