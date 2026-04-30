export const INITIAL_REGISTRATIONS = [
  { id: "1", name: "Nilo Matunog", type: "VIP", status: "checked-in", totalFee: 15000, paid: 15000 },
  { id: "2", name: "Sarah Jenkins", type: "Standard", status: "registered", totalFee: 8000, paid: 4000 },
  { id: "3", name: "Michael Chen", type: "Early Bird", status: "reserved", totalFee: 5000, paid: 2500 },
];

export const INITIAL_SPONSORS = [
  { id: "s1", company: "TechCorp", tier: "Platinum", amount: 50000, paid: true, booth: "A1" },
  { id: "s2", company: "BankGlobal", tier: "Gold", amount: 25000, paid: true, booth: "B4" },
];

export const INITIAL_EXPENSES = [
  { id: "e1", supplier: "Grand Plaza Hotel", category: "Venue", amount: 80000, type: "fixed", approved: true },
  { id: "e2", supplier: "Fresh Catering", category: "Food", amount: 45000, type: "variable", approved: true },
];

export const INITIAL_PROGRAM = [
  { id: "p1", time: "09:00 AM", title: "Opening Keynote", speaker: "Engr. Nilo Matunog", location: "Plenary Hall", status: "current" },
  { id: "p2", time: "11:00 AM", title: "Coffee & Networking", speaker: "N/A", location: "Lobby", status: "next" },
];

export const THEME_PEGS = [
  { id: "sinulog", name: "Cebu Sinulog", category: "Festival", bg: "bg-red-600", text: "text-red-600", border: "border-red-600", shadow: "shadow-red-200", light: "bg-red-50", hover: "hover:bg-red-700" },
  { id: "coachella", name: "Coachella Party", category: "Party", bg: "bg-fuchsia-600", text: "text-fuchsia-600", border: "border-fuchsia-600", shadow: "shadow-fuchsia-200", light: "bg-fuchsia-50", hover: "hover:bg-fuchsia-700" },
  { id: "retro80s", name: "Retro 80s", category: "Party", bg: "bg-violet-600", text: "text-violet-600", border: "border-violet-600", shadow: "shadow-violet-200", light: "bg-violet-50", hover: "hover:bg-violet-700" },
  { id: "gatsby", name: "Gatsby Gold", category: "Classic", bg: "bg-amber-600", text: "text-amber-600", border: "border-amber-600", shadow: "shadow-amber-200", light: "bg-amber-50", hover: "hover:bg-amber-700" },
  { id: "weddingWhite", name: "Wedding White", category: "Wedding", bg: "bg-zinc-600", text: "text-zinc-600", border: "border-zinc-600", shadow: "shadow-zinc-200", light: "bg-zinc-50", hover: "hover:bg-zinc-700" },
  { id: "weddingGreen", name: "Wedding Green", category: "Wedding", bg: "bg-emerald-600", text: "text-emerald-600", border: "border-emerald-600", shadow: "shadow-emerald-200", light: "bg-emerald-50", hover: "hover:bg-emerald-700" },
  { id: "corporateNeutral", name: "Corporate Neutral", category: "Corporate", bg: "bg-slate-700", text: "text-slate-700", border: "border-slate-700", shadow: "shadow-slate-200", light: "bg-slate-50", hover: "hover:bg-slate-800" },
  { id: "indigo", name: "Classic Indigo", category: "Core", bg: "bg-indigo-600", text: "text-indigo-600", border: "border-indigo-600", shadow: "shadow-indigo-200", light: "bg-indigo-50", hover: "hover:bg-indigo-700" },
  { id: "sky", name: "Sky Blue", category: "Core", bg: "bg-sky-500", text: "text-sky-500", border: "border-sky-500", shadow: "shadow-sky-100", light: "bg-sky-50", hover: "hover:bg-sky-600" },
  { id: "rose", name: "Bold Rose", category: "Core", bg: "bg-rose-600", text: "text-rose-600", border: "border-rose-600", shadow: "shadow-rose-200", light: "bg-rose-50", hover: "hover:bg-rose-700" },
];

export const DEFAULT_EVENT_DETAILS = {
  title: "Leadership Summit 2026",
  venue: "Cebu, PH • Plenary",
  startDate: "2026-04-16",
  endDate: "2026-04-18",
  organizer: "VibeEvent Global",
  attendeeGoal: 500,
  budgetGoal: 1000000,
  themeId: "sinulog",
};

export const DEFAULT_CONFIG = {
  hasSponsors: true,
  hasHotel: true,
  hasInstallments: true,
  isExhibition: true,
  vibrantTheme: true,
  enableProgram: true,
};
