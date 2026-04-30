export default function MetricCard({ title, value, helper, themeClasses }) {
  return (
    <div className={`rounded-2xl border p-5 shadow-sm ${themeClasses.panel} bg-white`}>
      <p className="text-xs uppercase tracking-wide text-slate-500">{title}</p>
      <p className="mt-2 text-3xl font-black text-slate-900">{value}</p>
      <p className="mt-1 text-sm text-slate-500">{helper}</p>
    </div>
  );
}
