import MetricCard from "../components/MetricCard";

export default function DashboardView({ stats, eventData, themeClasses }) {
  const progressColor = themeClasses.primary.split(" ")[0];

  return (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Total Revenue"
          value={`PHP ${stats.totalRevenue.toLocaleString()}`}
          helper="Registration + paid sponsorships"
          themeClasses={themeClasses}
        />
        <MetricCard
          title="Approved Expenses"
          value={`PHP ${stats.approvedExpenses.toLocaleString()}`}
          helper="Only approved expense records"
          themeClasses={themeClasses}
        />
        <MetricCard
          title="Net Position"
          value={`PHP ${stats.netPosition.toLocaleString()}`}
          helper={`${stats.margin.toFixed(1)}% margin`}
          themeClasses={themeClasses}
        />
        <MetricCard
          title="Attendees"
          value={`${stats.attendeeCount} / ${eventData.attendeeGoal}`}
          helper="Registered + checked-in"
          themeClasses={themeClasses}
        />
      </div>

      <section className="rounded-2xl border bg-white p-5">
        <h2 className="text-xl font-black">Progress Gauges</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <p className="mb-1 text-sm font-semibold text-slate-700">Attendee Goal</p>
            <div className="h-3 overflow-hidden rounded-full bg-slate-200">
              <div className={`h-full ${progressColor}`} style={{ width: `${stats.attendeeProgress}%` }} />
            </div>
            <p className="mt-1 text-xs text-slate-600">{stats.attendeeProgress.toFixed(1)}%</p>
          </div>
          <div>
            <p className="mb-1 text-sm font-semibold text-slate-700">Budget Goal</p>
            <div className="h-3 overflow-hidden rounded-full bg-slate-200">
              <div className={`h-full ${progressColor}`} style={{ width: `${stats.budgetProgress}%` }} />
            </div>
            <p className="mt-1 text-xs text-slate-600">{stats.budgetProgress.toFixed(1)}%</p>
          </div>
        </div>
      </section>
    </>
  );
}
