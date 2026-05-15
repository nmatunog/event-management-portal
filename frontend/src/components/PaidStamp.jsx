/** Rotated "PAID" stamp shown on confirmed payment vouchers. */
export function formatPaidStampDate(dateReceived) {
  const raw = String(dateReceived ?? "").trim();
  if (!raw) return "";
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(raw);
  const d = iso ? new Date(`${raw}T12:00:00`) : new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function PaidStamp({ dateReceived, className = "" }) {
  const label = formatPaidStampDate(dateReceived);
  if (!label) return null;

  return (
    <div className={`pointer-events-none select-none ${className}`} aria-label={`Paid on ${label}`}>
      <div className="inline-flex flex-col items-center justify-center rounded-lg border-[3px] border-emerald-600 px-5 py-3 -rotate-12 bg-emerald-50/90 shadow-sm">
        <span className="text-2xl sm:text-3xl font-black tracking-[0.2em] text-emerald-700 leading-none">PAID</span>
        <span className="mt-1.5 text-[10px] sm:text-xs font-black uppercase tracking-wider text-emerald-800 border-t border-emerald-400/60 pt-1.5 w-full text-center">
          Date paid
        </span>
        <span className="text-xs sm:text-sm font-bold text-emerald-900 mt-0.5">{label}</span>
      </div>
    </div>
  );
}
