import { useCallback, useEffect, useState } from "react";
import { Download, FileText } from "lucide-react";
import { getEventExpenseReport } from "../lib/api";
import { formatPaidStampDate } from "../components/PaidStamp";

function csvEscapeCell(value) {
  const s = value == null ? "" : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadCsv(filename, header, rows) {
  const lines = [header.map(csvEscapeCell).join(","), ...rows.map((r) => r.map(csvEscapeCell).join(","))];
  const blob = new Blob([`\uFEFF${lines.join("\n")}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function EventExpenseReport({ eventId, showVouchers = false, onError }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    try {
      const res = await getEventExpenseReport(eventId);
      setReport(res);
    } catch (e) {
      onError?.(e, "Failed to load expense report.");
    } finally {
      setLoading(false);
    }
  }, [eventId, onError]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const downloadFullReport = () => {
    if (!report) return;
    const day = new Date().toISOString().slice(0, 10);
    const eventTitle = String(report.event?.title || "event").replace(/[^\w.-]+/g, "_");

    const expenseHeader = ["type", "voucher_no", "payment_ref", "supplier", "category", "amount_php", "status", "date_paid", "receipt_on_file", "particulars"];
    const expenseRows = (report.expenses || []).map((e) => [
      "expense_line",
      "",
      "",
      e.supplier,
      e.category,
      Number(e.amount) || 0,
      e.approved ? "approved" : "pending",
      "",
      "",
      "",
    ]);
    const voucherRows = showVouchers
      ? (report.vouchers || []).map((v) => [
          "payment_voucher",
          v.voucher_number,
          v.payment_reference,
          v.supplier_name,
          "",
          Number(v.amount) || 0,
          v.status,
          v.date_received ? formatPaidStampDate(v.date_received) : "",
          v.has_receipt ? "yes" : "no",
          v.description || "",
        ])
      : [];

    downloadCsv(`pamacon-full-expense-report-${eventTitle}-${day}.csv`, expenseHeader, [...expenseRows, ...voucherRows]);
  };

  if (loading && !report) {
    return <p className="text-sm text-slate-500 px-2">Loading expense report…</p>;
  }

  if (!report) return null;

  const s = report.summary || {};

  return (
    <div className="bg-white rounded-[40px] border shadow-sm p-8 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center">
            <FileText size={28} aria-hidden />
          </div>
          <div>
            <h3 className="text-lg font-black uppercase text-slate-800">Full event expense report</h3>
            <p className="text-sm text-slate-500">
              {showVouchers
                ? "Collates budget lines, payment vouchers (with reference numbers), and supplier receipts on file."
                : "Collates budget lines and expense totals for the event."}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={downloadFullReport}
          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-6 py-3 text-xs font-black uppercase hover:bg-slate-50"
        >
          <Download size={16} aria-hidden />
          Download CSV
        </button>
      </div>

      <div className={`grid gap-4 ${showVouchers ? "grid-cols-2 md:grid-cols-4" : "grid-cols-1 sm:grid-cols-2"}`}>
        <div className="rounded-2xl bg-slate-50 p-4 border">
          <p className="text-[10px] font-black uppercase text-slate-400">Expense lines</p>
          <p className="text-2xl font-black text-slate-800">{s.expenseLineCount ?? 0}</p>
          <p className="text-xs text-slate-500">₱{(Number(s.expenseLedgerTotal) || 0).toLocaleString()} total</p>
        </div>
        {showVouchers ? (
          <div className="rounded-2xl bg-slate-50 p-4 border">
            <p className="text-[10px] font-black uppercase text-slate-400">Payment vouchers</p>
            <p className="text-2xl font-black text-slate-800">{s.voucherCount ?? 0}</p>
            <p className="text-xs text-slate-500">{s.confirmedVoucherCount ?? 0} confirmed</p>
          </div>
        ) : null}
        {showVouchers ? (
          <>
            <div className="rounded-2xl bg-emerald-50 p-4 border border-emerald-100">
              <p className="text-[10px] font-black uppercase text-emerald-700">Confirmed paid</p>
              <p className="text-2xl font-black text-emerald-900">₱{(Number(s.voucherPaidTotal) || 0).toLocaleString()}</p>
            </div>
            <div className="rounded-2xl bg-blue-50 p-4 border border-blue-100">
              <p className="text-[10px] font-black uppercase text-blue-700">Receipts on file</p>
              <p className="text-2xl font-black text-blue-900">{s.receiptsOnFile ?? 0}</p>
            </div>
          </>
        ) : null}
      </div>

      {(s.byCategory || []).length > 0 ? (
        <div className="overflow-x-auto rounded-2xl border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b text-left">
                <th className="p-3 text-[10px] font-black uppercase text-slate-400">Category</th>
                <th className="p-3 text-[10px] font-black uppercase text-slate-400">Budgeted lines</th>
                <th className="p-3 text-[10px] font-black uppercase text-slate-400">Line total</th>
                {showVouchers ? (
                  <th className="p-3 text-[10px] font-black uppercase text-slate-400">Voucher paid</th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {s.byCategory.map((row) => (
                <tr key={row.category} className="border-b last:border-0">
                  <td className="p-3 font-semibold">{row.category}</td>
                  <td className="p-3">{row.count}</td>
                  <td className="p-3 font-black">₱{(Number(row.budgeted) || 0).toLocaleString()}</td>
                  {showVouchers ? (
                    <td className="p-3 font-black text-emerald-800">₱{(Number(row.voucherPaid) || 0).toLocaleString()}</td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {showVouchers ? (
      <div className="overflow-x-auto rounded-2xl border">
        <p className="px-4 py-2 text-[10px] font-black uppercase text-slate-400 bg-slate-50 border-b">Payment vouchers</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="p-3 text-[10px] font-black uppercase text-slate-400">Voucher no.</th>
              <th className="p-3 text-[10px] font-black uppercase text-slate-400">Payment ref.</th>
              <th className="p-3 text-[10px] font-black uppercase text-slate-400">Supplier</th>
              <th className="p-3 text-[10px] font-black uppercase text-slate-400">Amount</th>
              <th className="p-3 text-[10px] font-black uppercase text-slate-400">Status</th>
              <th className="p-3 text-[10px] font-black uppercase text-slate-400">Date paid</th>
              <th className="p-3 text-[10px] font-black uppercase text-slate-400">Receipt</th>
            </tr>
          </thead>
          <tbody>
            {(report.vouchers || []).length === 0 ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-slate-500">
                  No payment vouchers.
                </td>
              </tr>
            ) : (
              report.vouchers.map((v) => (
                <tr key={v.id} className="border-b last:border-0 hover:bg-slate-50/80">
                  <td className="p-3 font-mono text-xs font-bold">{v.voucher_number}</td>
                  <td className="p-3 font-mono text-xs">{v.payment_reference || "—"}</td>
                  <td className="p-3 font-semibold">{v.supplier_name}</td>
                  <td className="p-3 font-black">₱{(Number(v.amount) || 0).toLocaleString()}</td>
                  <td className="p-3 text-xs uppercase font-bold">{v.status}</td>
                  <td className="p-3 text-xs">{v.date_received ? formatPaidStampDate(v.date_received) : "—"}</td>
                  <td className="p-3 text-xs">{v.has_receipt ? "Yes" : "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      ) : null}
    </div>
  );
}
