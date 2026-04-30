export function safePercent(numerator, denominator) {
  if (!denominator || denominator <= 0) return 0;
  return Math.min(100, Math.max(0, (numerator / denominator) * 100));
}

export function computeStats(data, eventData) {
  const paidRegistrationRevenue = data.registrations.reduce(
    (sum, row) => sum + Number(row.totalFee || 0),
    0
  );
  const paidSponsorRevenue = data.sponsors
    .filter((row) => row.paid)
    .reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const approvedExpenses = data.expenses
    .filter((row) => row.approved)
    .reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const totalRevenue = paidRegistrationRevenue + paidSponsorRevenue;
  const netPosition = totalRevenue - approvedExpenses;
  const attendeeCount = data.registrations.filter((r) =>
    ["registered", "checked-in"].includes(r.status)
  ).length;

  return {
    totalRevenue,
    approvedExpenses,
    netPosition,
    attendeeCount,
    attendeeProgress: safePercent(attendeeCount, Number(eventData.attendeeGoal || 0)),
    budgetProgress: safePercent(totalRevenue, Number(eventData.budgetGoal || 0)),
    margin: totalRevenue > 0 ? (netPosition / totalRevenue) * 100 : 0,
  };
}
