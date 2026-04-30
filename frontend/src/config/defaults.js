import { MODULE_DEFS } from "./constants";

export const DEFAULT_EVENT = {
  title: "VibeEvent Pro Summit",
  venue: "Cebu Convention Hall",
  startDate: "2026-06-18",
  endDate: "2026-06-20",
  attendeeGoal: 500,
  budgetGoal: 1200000,
  theme: "indigo",
  modules: MODULE_DEFS.reduce((acc, m) => ({ ...acc, [m.key]: true }), {}),
};

export const SEED_DATA = {
  registrations: [
    { id: "R-1001", status: "registered", totalFee: 4500 },
    { id: "R-1002", status: "checked-in", totalFee: 4500 },
    { id: "R-1003", status: "pre-registered", totalFee: 0 },
    { id: "R-1004", status: "reserved", totalFee: 2000 },
  ],
  sponsors: [
    { id: "S-1", company: "Acme Corp", amount: 200000, paid: true },
    { id: "S-2", company: "Nova AV", amount: 120000, paid: false },
  ],
  expenses: [
    { id: "E-1", category: "Venue", amount: 220000, approved: true },
    { id: "E-2", category: "Catering", amount: 170000, approved: true },
    { id: "E-3", category: "Printing", amount: 45000, approved: false },
  ],
};
