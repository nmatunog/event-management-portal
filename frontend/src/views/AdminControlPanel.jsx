import { useMemo, useState } from "react";

export default function AdminControlPanel({
  activeEventId,
  themePeg,
  onCreateRegistration,
  onCreateProgram,
  onCreateExpense,
  onCreateSponsor,
  onBulkImportRegistrations,
  onBulkImportProgram,
  onInitializeWorkspace,
  onGenerateInstallments,
  onPostPayment,
  onCreateInvitation,
  onAddHotelBooking,
  onAddSupplier,
  onAddCommunication,
  registrations,
  program,
  sponsors,
  expenses,
  invitations,
  billingByRegistration,
  hotelBookings,
  suppliersHub,
  communicationsLog,
}) {
  const [activeSection, setActiveSection] = useState("registrations");
  const [regForm, setRegForm] = useState({ fullName: "", attendeeType: "Standard", totalFee: 0, paidAmount: 0 });
  const [programForm, setProgramForm] = useState({
    title: "",
    speaker: "",
    assignedTo: "",
    toFinalize: "",
    notes: "",
    sponsorSlot: "",
    dayLabel: "",
    location: "",
    startTime: "",
    endTime: "",
    status: "next",
  });
  const [expenseForm, setExpenseForm] = useState({ supplier: "", category: "General", amount: 0, expenseType: "fixed", approved: true });
  const [sponsorForm, setSponsorForm] = useState({ company: "", tier: "Bronze", amount: 0, paid: false, booth: "" });
  const [programPaste, setProgramPaste] = useState("");
  const [paymentForm, setPaymentForm] = useState({ registrationId: "", totalAmount: 0, installmentCount: 3, startDate: "", amount: 0 });
  const [inviteForm, setInviteForm] = useState({ email: "", fullName: "", invitationType: "standard" });
  const [hotelForm, setHotelForm] = useState({ attendeeName: "", hotel: "", roomType: "", checkIn: "", checkOut: "" });
  const [supplierForm, setSupplierForm] = useState({ name: "", category: "", contact: "", status: "prospect" });
  const [commsForm, setCommsForm] = useState({ channel: "email", audience: "all", message: "" });

  const canSubmit = Boolean(activeEventId);
  const sections = useMemo(
    () => [
      { id: "registrations", label: "Registrations" },
      { id: "program", label: "Program" },
      { id: "finance", label: "Finance" },
      { id: "payments", label: "Payments" },
      { id: "sponsors", label: "Sponsorships" },
      { id: "invitations", label: "Invitations" },
      { id: "hotel", label: "Hotel Booking" },
      { id: "suppliers", label: "Suppliers" },
      { id: "comms", label: "Comms" },
      { id: "imports", label: "Bulk Import" },
    ],
    []
  );

  const handleCsvUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const rows = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [fullName, attendeeType = "Standard", totalFee = "0", paidAmount = "0"] = line.split(",");
        return {
          fullName: fullName?.trim(),
          attendeeType: attendeeType?.trim(),
          totalFee: Number(totalFee || 0),
          paidAmount: Number(paidAmount || 0),
        };
      })
      .filter((row) => row.fullName);
    await onBulkImportRegistrations(rows);
    event.target.value = "";
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div>
        <h3 className="text-4xl font-black text-slate-800 tracking-tight">Corporate Event Operations</h3>
        <p className="text-slate-500 text-sm mt-2">Use this workspace in operational order: registrations → program → finance → sponsors.</p>
        {!activeEventId && (
          <div className="mt-3 flex flex-wrap items-center gap-3 text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-sm font-semibold">
            <span>No active event workspace. Initialize first before submitting records.</span>
            <button onClick={onInitializeWorkspace} className={`px-3 py-1 rounded-lg text-white ${themePeg.bg}`}>
              Initialize Workspace
            </button>
          </div>
        )}
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm flex flex-wrap gap-2">
        {sections.map((section) => (
          <button
            key={section.id}
            onClick={() => setActiveSection(section.id)}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition ${
              activeSection === section.id ? `${themePeg.bg} text-white` : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {section.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {activeSection === "registrations" && (
          <>
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h4 className="font-black text-xl mb-4">Registration Input</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input className="rounded-xl border px-3 py-2" placeholder="Full name" value={regForm.fullName} onChange={(e) => setRegForm((s) => ({ ...s, fullName: e.target.value }))} />
            <input className="rounded-xl border px-3 py-2" placeholder="Type (VIP/Standard)" value={regForm.attendeeType} onChange={(e) => setRegForm((s) => ({ ...s, attendeeType: e.target.value }))} />
            <input type="number" className="rounded-xl border px-3 py-2" placeholder="Total fee" value={regForm.totalFee} onChange={(e) => setRegForm((s) => ({ ...s, totalFee: Number(e.target.value || 0) }))} />
            <input type="number" className="rounded-xl border px-3 py-2" placeholder="Paid amount" value={regForm.paidAmount} onChange={(e) => setRegForm((s) => ({ ...s, paidAmount: Number(e.target.value || 0) }))} />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button disabled={!canSubmit} onClick={() => onCreateRegistration(regForm)} className={`${themePeg.bg} text-white px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-40`}>Add Registration</button>
          </div>
            </section>
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h4 className="font-black text-xl mb-4">Recent Registrations</h4>
              <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar pr-2">
                {registrations.slice(0, 8).map((r) => (
                  <div key={r.id} className="rounded-xl border border-slate-100 p-3">
                    <p className="font-semibold text-slate-800">{r.name}</p>
                    <p className="text-xs text-slate-500">{r.type} • {r.status} • PHP {r.paid}</p>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {activeSection === "program" && (
          <>
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h4 className="font-black text-xl mb-4">Program Input</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input className="rounded-xl border px-3 py-2" placeholder="Session title" value={programForm.title} onChange={(e) => setProgramForm((s) => ({ ...s, title: e.target.value }))} />
            <input className="rounded-xl border px-3 py-2" placeholder="Speaker" value={programForm.speaker} onChange={(e) => setProgramForm((s) => ({ ...s, speaker: e.target.value }))} />
            <input className="rounded-xl border px-3 py-2" placeholder="Assigned to" value={programForm.assignedTo} onChange={(e) => setProgramForm((s) => ({ ...s, assignedTo: e.target.value }))} />
            <input className="rounded-xl border px-3 py-2" placeholder="To finalize" value={programForm.toFinalize} onChange={(e) => setProgramForm((s) => ({ ...s, toFinalize: e.target.value }))} />
            <input className="rounded-xl border px-3 py-2" placeholder="Sponsor slot (optional)" value={programForm.sponsorSlot} onChange={(e) => setProgramForm((s) => ({ ...s, sponsorSlot: e.target.value }))} />
            <input className="rounded-xl border px-3 py-2" placeholder="Day label (e.g. May 14)" value={programForm.dayLabel} onChange={(e) => setProgramForm((s) => ({ ...s, dayLabel: e.target.value }))} />
            <input className="rounded-xl border px-3 py-2" placeholder="Location" value={programForm.location} onChange={(e) => setProgramForm((s) => ({ ...s, location: e.target.value }))} />
            <select className="rounded-xl border px-3 py-2" value={programForm.status} onChange={(e) => setProgramForm((s) => ({ ...s, status: e.target.value }))}>
              <option value="next">next</option>
              <option value="current">current</option>
            </select>
            <input type="datetime-local" className="rounded-xl border px-3 py-2" value={programForm.startTime} onChange={(e) => setProgramForm((s) => ({ ...s, startTime: e.target.value }))} />
            <input type="datetime-local" className="rounded-xl border px-3 py-2" value={programForm.endTime} onChange={(e) => setProgramForm((s) => ({ ...s, endTime: e.target.value }))} />
            <input className="rounded-xl border px-3 py-2 md:col-span-2" placeholder="Notes" value={programForm.notes} onChange={(e) => setProgramForm((s) => ({ ...s, notes: e.target.value }))} />
          </div>
          <button disabled={!canSubmit} onClick={() => onCreateProgram(programForm)} className={`mt-3 ${themePeg.bg} text-white px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-40`}>Add Program Session</button>

              <div className="mt-6 border-t pt-4">
                <p className="font-black text-sm mb-2">Program Bulk Paste (Worksheet Format)</p>
                <textarea
                  className="w-full min-h-40 rounded-xl border px-3 py-2 text-sm"
                  placeholder="Paste your worksheet text block (Day lines + time rows) here..."
                  value={programPaste}
                  onChange={(e) => setProgramPaste(e.target.value)}
                />
                <div className="mt-2 flex items-center gap-3">
                  <button
                    disabled={!canSubmit || !programPaste.trim()}
                    onClick={async () => {
                      await onBulkImportProgram(programPaste);
                      setProgramPaste("");
                    }}
                    className={`${themePeg.bg} text-white px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-40`}
                  >
                    Import Program from Paste
                  </button>
                  <span className="text-xs text-slate-500">Tip: include lines like "Day 2 - May 14" and "9:00 Welcome Ceremonies ...".</span>
                </div>
              </div>
            </section>
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h4 className="font-black text-xl mb-4">Current Program List</h4>
              <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar pr-2">
                {program.slice(0, 8).map((p) => (
                  <div key={p.id} className="rounded-xl border border-slate-100 p-3">
                    <p className="font-semibold text-slate-800">{p.title}</p>
                    <p className="text-xs text-slate-500">{p.location} • {p.status}</p>
                    {(p.assignedTo || p.toFinalize || p.notes) && (
                      <p className="text-xs text-slate-500 mt-1">
                        {p.assignedTo ? `Assigned: ${p.assignedTo}` : ""}
                        {p.toFinalize ? ` • To finalize: ${p.toFinalize}` : ""}
                        {p.notes ? ` • ${p.notes}` : ""}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {activeSection === "finance" && (
          <>
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h4 className="font-black text-xl mb-4">Financial Input (Expenses)</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input className="rounded-xl border px-3 py-2" placeholder="Supplier" value={expenseForm.supplier} onChange={(e) => setExpenseForm((s) => ({ ...s, supplier: e.target.value }))} />
            <input className="rounded-xl border px-3 py-2" placeholder="Category" value={expenseForm.category} onChange={(e) => setExpenseForm((s) => ({ ...s, category: e.target.value }))} />
            <input type="number" className="rounded-xl border px-3 py-2" placeholder="Amount" value={expenseForm.amount} onChange={(e) => setExpenseForm((s) => ({ ...s, amount: Number(e.target.value || 0) }))} />
            <select className="rounded-xl border px-3 py-2" value={expenseForm.expenseType} onChange={(e) => setExpenseForm((s) => ({ ...s, expenseType: e.target.value }))}>
              <option value="fixed">fixed</option>
              <option value="variable">variable</option>
            </select>
          </div>
          <button disabled={!canSubmit} onClick={() => onCreateExpense(expenseForm)} className={`mt-3 ${themePeg.bg} text-white px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-40`}>Add Expense</button>
            </section>
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h4 className="font-black text-xl mb-4">Recent Expense Entries</h4>
              <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar pr-2">
                {expenses.slice(0, 8).map((e) => (
                  <div key={e.id} className="rounded-xl border border-slate-100 p-3">
                    <p className="font-semibold text-slate-800">{e.supplier} • PHP {e.amount}</p>
                    <p className="text-xs text-slate-500">{e.category} • {e.type}</p>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {activeSection === "sponsors" && (
          <>
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h4 className="font-black text-xl mb-4">Sponsor Input</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input className="rounded-xl border px-3 py-2" placeholder="Company" value={sponsorForm.company} onChange={(e) => setSponsorForm((s) => ({ ...s, company: e.target.value }))} />
            <select className="rounded-xl border px-3 py-2" value={sponsorForm.tier} onChange={(e) => setSponsorForm((s) => ({ ...s, tier: e.target.value }))}>
              <option>Platinum</option>
              <option>Gold</option>
              <option>Silver</option>
              <option>Bronze</option>
            </select>
            <input type="number" className="rounded-xl border px-3 py-2" placeholder="Amount" value={sponsorForm.amount} onChange={(e) => setSponsorForm((s) => ({ ...s, amount: Number(e.target.value || 0) }))} />
            <input className="rounded-xl border px-3 py-2" placeholder="Booth (e.g. A1)" value={sponsorForm.booth} onChange={(e) => setSponsorForm((s) => ({ ...s, booth: e.target.value }))} />
          </div>
          <button disabled={!canSubmit} onClick={() => onCreateSponsor(sponsorForm)} className={`mt-3 ${themePeg.bg} text-white px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-40`}>Add Sponsor</button>
            </section>
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h4 className="font-black text-xl mb-4">Current Sponsors</h4>
              <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar pr-2">
                {sponsors.slice(0, 8).map((s) => (
                  <div key={s.id} className="rounded-xl border border-slate-100 p-3">
                    <p className="font-semibold text-slate-800">{s.company} • PHP {s.amount}</p>
                    <p className="text-xs text-slate-500">{s.tier} • Booth {s.booth || "N/A"}</p>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {activeSection === "payments" && (
          <>
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h4 className="font-black text-xl mb-4">Installments & Billing</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <select className="rounded-xl border px-3 py-2" value={paymentForm.registrationId} onChange={(e) => setPaymentForm((s) => ({ ...s, registrationId: e.target.value }))}>
                  <option value="">Select registration</option>
                  {registrations.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
                <input type="number" className="rounded-xl border px-3 py-2" placeholder="Total amount" value={paymentForm.totalAmount} onChange={(e) => setPaymentForm((s) => ({ ...s, totalAmount: Number(e.target.value || 0) }))} />
                <input type="number" className="rounded-xl border px-3 py-2" placeholder="Installment count" value={paymentForm.installmentCount} onChange={(e) => setPaymentForm((s) => ({ ...s, installmentCount: Number(e.target.value || 1) }))} />
                <input type="date" className="rounded-xl border px-3 py-2" value={paymentForm.startDate} onChange={(e) => setPaymentForm((s) => ({ ...s, startDate: e.target.value }))} />
                <input type="number" className="rounded-xl border px-3 py-2" placeholder="Payment amount" value={paymentForm.amount} onChange={(e) => setPaymentForm((s) => ({ ...s, amount: Number(e.target.value || 0) }))} />
              </div>
              <div className="mt-3 flex flex-wrap gap-3">
                <button
                  disabled={!canSubmit || !paymentForm.registrationId}
                  onClick={() => onGenerateInstallments(paymentForm)}
                  className={`${themePeg.bg} text-white px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-40`}
                >
                  Generate Installment Plan
                </button>
                <button
                  disabled={!canSubmit || !paymentForm.registrationId || paymentForm.amount <= 0}
                  onClick={() => onPostPayment(paymentForm)}
                  className="bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-40"
                >
                  Apply Payment
                </button>
              </div>
            </section>
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h4 className="font-black text-xl mb-4">Billing Ledger Output</h4>
              <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar pr-2">
                {(billingByRegistration[paymentForm.registrationId] || []).map((row) => (
                  <div key={row.id} className="rounded-xl border border-slate-100 p-3 text-sm">
                    <p className="font-semibold text-slate-800">{row.due_date} • Due PHP {row.amount_due}</p>
                    <p className="text-xs text-slate-500">Paid PHP {row.amount_paid} • {row.status}</p>
                  </div>
                ))}
                {!(billingByRegistration[paymentForm.registrationId] || []).length && (
                  <p className="text-sm text-slate-500">Select a registration and generate a plan to display ledger entries.</p>
                )}
              </div>
            </section>
          </>
        )}

        {activeSection === "invitations" && (
          <>
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h4 className="font-black text-xl mb-4">Invitation Input</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input className="rounded-xl border px-3 py-2" placeholder="Email" value={inviteForm.email} onChange={(e) => setInviteForm((s) => ({ ...s, email: e.target.value }))} />
                <input className="rounded-xl border px-3 py-2" placeholder="Full name" value={inviteForm.fullName} onChange={(e) => setInviteForm((s) => ({ ...s, fullName: e.target.value }))} />
                <select className="rounded-xl border px-3 py-2" value={inviteForm.invitationType} onChange={(e) => setInviteForm((s) => ({ ...s, invitationType: e.target.value }))}>
                  <option value="standard">standard</option>
                  <option value="vip">vip</option>
                  <option value="speaker">speaker</option>
                  <option value="sponsor">sponsor</option>
                </select>
              </div>
              <button disabled={!canSubmit} onClick={() => onCreateInvitation(inviteForm)} className={`mt-3 ${themePeg.bg} text-white px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-40`}>Send Invitation</button>
            </section>
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h4 className="font-black text-xl mb-4">Invitation Output</h4>
              <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar pr-2">
                {invitations.slice(0, 10).map((i) => (
                  <div key={i.id} className="rounded-xl border border-slate-100 p-3">
                    <p className="font-semibold text-slate-800">{i.fullName || i.email}</p>
                    <p className="text-xs text-slate-500">{i.email} • {i.invitationType} • {i.status}</p>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {activeSection === "hotel" && (
          <>
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h4 className="font-black text-xl mb-4">Hotel Booking Input</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input className="rounded-xl border px-3 py-2" placeholder="Attendee name" value={hotelForm.attendeeName} onChange={(e) => setHotelForm((s) => ({ ...s, attendeeName: e.target.value }))} />
                <input className="rounded-xl border px-3 py-2" placeholder="Hotel" value={hotelForm.hotel} onChange={(e) => setHotelForm((s) => ({ ...s, hotel: e.target.value }))} />
                <input className="rounded-xl border px-3 py-2" placeholder="Room type" value={hotelForm.roomType} onChange={(e) => setHotelForm((s) => ({ ...s, roomType: e.target.value }))} />
                <input type="date" className="rounded-xl border px-3 py-2" value={hotelForm.checkIn} onChange={(e) => setHotelForm((s) => ({ ...s, checkIn: e.target.value }))} />
                <input type="date" className="rounded-xl border px-3 py-2" value={hotelForm.checkOut} onChange={(e) => setHotelForm((s) => ({ ...s, checkOut: e.target.value }))} />
              </div>
              <button onClick={() => onAddHotelBooking(hotelForm)} className={`mt-3 ${themePeg.bg} text-white px-4 py-2 rounded-xl text-sm font-bold`}>Add Booking</button>
            </section>
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h4 className="font-black text-xl mb-4">Hotel Booking Output</h4>
              <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar pr-2">
                {hotelBookings.slice(0, 10).map((h) => (
                  <div key={h.id} className="rounded-xl border border-slate-100 p-3">
                    <p className="font-semibold text-slate-800">{h.attendeeName} • {h.hotel}</p>
                    <p className="text-xs text-slate-500">{h.roomType} • {h.checkIn} to {h.checkOut}</p>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {activeSection === "suppliers" && (
          <>
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h4 className="font-black text-xl mb-4">Supplier Hub Input</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input className="rounded-xl border px-3 py-2" placeholder="Supplier name" value={supplierForm.name} onChange={(e) => setSupplierForm((s) => ({ ...s, name: e.target.value }))} />
                <input className="rounded-xl border px-3 py-2" placeholder="Category" value={supplierForm.category} onChange={(e) => setSupplierForm((s) => ({ ...s, category: e.target.value }))} />
                <input className="rounded-xl border px-3 py-2" placeholder="Contact details" value={supplierForm.contact} onChange={(e) => setSupplierForm((s) => ({ ...s, contact: e.target.value }))} />
                <select className="rounded-xl border px-3 py-2" value={supplierForm.status} onChange={(e) => setSupplierForm((s) => ({ ...s, status: e.target.value }))}>
                  <option value="prospect">prospect</option>
                  <option value="onboarded">onboarded</option>
                  <option value="contracted">contracted</option>
                </select>
              </div>
              <button onClick={() => onAddSupplier(supplierForm)} className={`mt-3 ${themePeg.bg} text-white px-4 py-2 rounded-xl text-sm font-bold`}>Add Supplier</button>
            </section>
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h4 className="font-black text-xl mb-4">Supplier Hub Output</h4>
              <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar pr-2">
                {suppliersHub.slice(0, 10).map((s) => (
                  <div key={s.id} className="rounded-xl border border-slate-100 p-3">
                    <p className="font-semibold text-slate-800">{s.name} • {s.category}</p>
                    <p className="text-xs text-slate-500">{s.contact} • {s.status}</p>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {activeSection === "comms" && (
          <>
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h4 className="font-black text-xl mb-4">Comms Engine Input</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <select className="rounded-xl border px-3 py-2" value={commsForm.channel} onChange={(e) => setCommsForm((s) => ({ ...s, channel: e.target.value }))}>
                  <option value="email">email</option>
                  <option value="sms">sms</option>
                  <option value="in-app">in-app</option>
                  <option value="signage">signage</option>
                </select>
                <select className="rounded-xl border px-3 py-2" value={commsForm.audience} onChange={(e) => setCommsForm((s) => ({ ...s, audience: e.target.value }))}>
                  <option value="all">all</option>
                  <option value="attendees">attendees</option>
                  <option value="speakers">speakers</option>
                  <option value="staff">staff</option>
                </select>
                <textarea className="rounded-xl border px-3 py-2 md:col-span-2 min-h-28" placeholder="Message content" value={commsForm.message} onChange={(e) => setCommsForm((s) => ({ ...s, message: e.target.value }))} />
              </div>
              <button onClick={() => onAddCommunication(commsForm)} className={`mt-3 ${themePeg.bg} text-white px-4 py-2 rounded-xl text-sm font-bold`}>Queue Communication</button>
            </section>
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h4 className="font-black text-xl mb-4">Comms Engine Output</h4>
              <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar pr-2">
                {communicationsLog.slice(0, 10).map((c) => (
                  <div key={c.id} className="rounded-xl border border-slate-100 p-3">
                    <p className="font-semibold text-slate-800">{c.channel} • audience: {c.audience}</p>
                    <p className="text-xs text-slate-500">{c.message}</p>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {activeSection === "imports" && (
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm xl:col-span-2">
            <h4 className="font-black text-xl mb-4">Bulk Import</h4>
            <p className="text-sm text-slate-600 mb-3">Upload CSV to quickly seed registration records for corporate attendees.</p>
            <label className="inline-flex text-sm font-semibold border rounded-xl px-3 py-2 cursor-pointer hover:bg-slate-50">
              Upload Registrations CSV
              <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleCsvUpload} />
            </label>
            <p className="text-xs text-slate-500 mt-2">CSV format: name,type,totalFee,paidAmount</p>
          </section>
        )}
      </div>
    </div>
  );
}
