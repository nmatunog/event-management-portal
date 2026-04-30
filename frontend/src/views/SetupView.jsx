import { MODULE_DEFS } from "../config/constants";

export default function SetupView({ eventData }) {
  return (
    <section className="rounded-2xl border bg-white p-5">
      <h2 className="text-xl font-black">Current Event Modules</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {MODULE_DEFS.map((m) => (
          <div key={m.key} className="rounded-xl border p-4">
            <div className="flex items-center justify-between">
              <p className="font-semibold">{m.title}</p>
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  eventData.modules[m.key] ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                }`}
              >
                {eventData.modules[m.key] ? "Included" : "Excluded"}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-600">{m.caption}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
