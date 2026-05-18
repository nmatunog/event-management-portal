import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Copy, Download, Edit3, Eye, FileSignature, Link2, Plus, Trash2, XCircle } from "lucide-react";
import {
  createPaymentVoucher,
  deletePaymentVoucher,
  getPaymentVoucherReceipt,
  getPaymentVoucherSignature,
  getPaymentVouchers,
  resequencePaymentVouchers,
  supplierVoucherPublicUrl,
  voidPaymentVoucher,
} from "../lib/api";
import { formatPaidStampDate } from "../components/PaidStamp";
import { expenseGroupForLinkedExpense } from "./expenseCategories";
import { VoucherDetailDialog, VoucherEditDialog } from "./SupplierVouchersPanel";

const STATUS_STYLES = {
  sent: "bg-slate-100 text-slate-700",
  viewed: "bg-amber-50 text-amber-800",
  confirmed: "bg-emerald-50 text-emerald-800",
  void: "bg-rose-50 text-rose-700",
};

function csvEscapeCell(value) {
  const s = value == null ? "" : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Global disbursement order from EPV-YYYYMMDD-#### suffix. */
function disbursementSeq(voucherNumber) {
  const m = String(voucherNumber || "").match(/^EPV-\d{8}-(\d{4})$/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) ? n : null;
}

function compareByDisbursement(a, b) {
  const sa = disbursementSeq(a.voucher_number);
  const sb = disbursementSeq(b.voucher_number);
  if (sa != null && sb != null && sa !== sb) return sa - sb;
  const pa = String(a.payment_date || a.created_at || "");
  const pb = String(b.payment_date || b.created_at || "");
  const cmp = pa.localeCompare(pb);
  if (cmp !== 0) return cmp;
  return String(a.created_at || "").localeCompare(String(b.created_at || ""));
}

function formatPaymentDate(iso) {
  const raw = String(iso ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return "—";
  return formatPaidStampDate(raw);
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

function SetupInput({ label, ...props }) {
  return (
    <label className="space-y-2 block">
      <span className="block text-[10px] font-black text-slate-400 uppercase">{label}</span>
      <input
        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-3.5 text-sm font-semibold disabled:opacity-50"
        {...props}
      />
    </label>
  );
}

export default function PaymentVouchersHub({ eventId, suppliers, canEdit, isAdmin = false, isSuperuser = false, onError, onInfo }) {
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [copiedId, setCopiedId] = useState("");
  const [viewVoucher, setViewVoucher] = useState(null);
  const [viewSignature, setViewSignature] = useState(null);
  const [viewReceipt, setViewReceipt] = useState(null);
  const [editVoucher, setEditVoucher] = useState(null);
  const [draft, setDraft] = useState({
    expenseId: "",
    supplierName: "",
    payeeEmail: "",
    payeeContact: "",
    amount: 0,
    paymentMethod: "Bank transfer",
    paymentReference: "",
    paymentDate: new Date().toISOString().slice(0, 10),
    description: "",
    notes: "",
  });

  const reload = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    try {
      const res = await getPaymentVouchers(eventId);
      setVouchers(res.items || []);
    } catch (e) {
      onError?.(e, "Failed to load payment vouchers.");
    } finally {
      setLoading(false);
    }
  }, [eventId, onError]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const vouchersByDisbursement = useMemo(() => [...vouchers].sort(compareByDisbursement), [vouchers]);

  const copyLink = async (v) => {
    const url = supplierVoucherPublicUrl(v.token);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(v.id);
      onInfo?.("Confirmation link copied to clipboard.");
      setTimeout(() => setCopiedId(""), 2500);
    } catch {
      onError?.(new Error("Copy failed"), "Could not copy link.");
    }
  };

  const handleExpensePick = (expenseId) => {
    setDraft((d) => ({
      ...d,
      expenseId: expenseId || "",
    }));
  };

  const handleCreate = async () => {
    if (!eventId || !String(draft.supplierName).trim()) return;
    try {
      const res = await createPaymentVoucher(eventId, {
        expenseId: draft.expenseId || undefined,
        supplierName: draft.supplierName,
        payeeEmail: draft.payeeEmail,
        payeeContact: draft.payeeContact,
        amount: Number(draft.amount) || 0,
        paymentMethod: draft.paymentMethod,
        paymentReference: draft.paymentReference,
        paymentDate: draft.paymentDate,
        description: draft.description,
        notes: draft.notes,
      });
      setIsAdding(false);
      await reload();
      const url = supplierVoucherPublicUrl(res.item?.token);
      try {
        await navigator.clipboard.writeText(url);
        onInfo?.(`Voucher ${res.item?.voucher_number} (ref ${res.item?.payment_reference}) created. Link copied.`);
      } catch {
        onInfo?.(`Voucher ${res.item?.voucher_number} created.`);
      }
    } catch (e) {
      onError?.(e, "Failed to create voucher.");
    }
  };

  const handleVoid = async (id) => {
    if (!window.confirm("Void this voucher? The link will no longer accept confirmations.")) return;
    try {
      await voidPaymentVoucher(id);
      await reload();
      onInfo?.("Voucher voided.");
    } catch (e) {
      onError?.(e, "Failed to void voucher.");
    }
  };

  const handleDelete = async (id) => {
    if (
      !window.confirm(
        "Permanently delete this voucher from the database? This cannot be undone. Remaining EPV suffix numbers will be resequenced in payment-date order (and default payment references updated to match)."
      )
    )
      return;
    try {
      await deletePaymentVoucher(id);
      await reload();
      onInfo?.("Voucher deleted; EPV numbers resequenced where applicable.");
    } catch (e) {
      onError?.(e, "Failed to delete voucher.");
    }
  };

  const syncVoucherNumbers = async () => {
    if (!eventId) return;
    if (
      !window.confirm(
        "Renumber disbursement sequence? EPV codes keep each payment date; #0001 = earliest disbursement, then #0002, and so on. Default payment references that matched the old voucher number will be updated too."
      )
    )
      return;
    try {
      await resequencePaymentVouchers(eventId);
      await reload();
      onInfo?.("Disbursement sequence renumbered.");
    } catch (e) {
      onError?.(e, "Failed to sync voucher numbers.");
    }
  };

  const downloadMasterList = () => {
    if (!vouchersByDisbursement.length) {
      onInfo?.("No vouchers to export.");
      return;
    }
    const day = new Date().toISOString().slice(0, 10);
    const header = [
      "disbursement_no",
      "voucher_no",
      "payment_ref",
      "status",
      "expense_group",
      "payee",
      "payee_email",
      "payee_contact",
      "amount_php",
      "currency",
      "payment_method",
      "payment_date",
      "date_received",
      "description",
      "notes",
      "supplier_receipt_no",
      "receipt_on_file",
      "signed",
      "confirmed_at",
      "created_at",
      "confirm_link",
    ];
    const rows = vouchersByDisbursement.map((v) => [
      disbursementSeq(v.voucher_number) ?? "",
      v.voucher_number,
      v.payment_reference,
      v.status,
      expenseGroupForLinkedExpense(v.expense_id, suppliers) || "—",
      v.supplier_name,
      v.payee_email,
      v.payee_contact,
      Number(v.amount) || 0,
      v.currency || "PHP",
      v.payment_method,
      v.payment_date,
      v.date_received ? formatPaidStampDate(v.date_received) : "",
      v.description,
      v.notes,
      v.supplier_receipt_number,
      v.has_receipt ? "yes" : "no",
      v.has_signature ? "yes" : "no",
      v.confirmed_at || "",
      v.created_at || "",
      supplierVoucherPublicUrl(v.token),
    ]);
    downloadCsv(`pamacon-payment-vouchers-master-${day}.csv`, header, rows);
    onInfo?.(`Exported ${rows.length} voucher(s).`);
  };

  const openView = async (v) => {
    setViewVoucher(v);
    setViewSignature(null);
    setViewReceipt(null);
    try {
      if (v.status === "confirmed" || v.has_signature) {
        const sig = await getPaymentVoucherSignature(v.id);
        setViewSignature(sig);
      }
      if (v.has_receipt) {
        const rec = await getPaymentVoucherReceipt(v.id);
        setViewReceipt(rec);
      }
    } catch (e) {
      onError?.(e, "Failed to load stored acknowledgment.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-8 rounded-[40px] border shadow-sm flex flex-col gap-4 lg:flex-row lg:justify-between lg:items-center">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 bg-violet-50 rounded-2xl flex items-center justify-center text-violet-600 shadow-inner">
            <FileSignature size={32} aria-hidden />
          </div>
          <div>
            <h3 className="text-xl font-black uppercase text-slate-800">Payment vouchers</h3>
            <p className="text-sm text-slate-500 max-w-xl">
              Track expense disbursements in payment-date order. Each EPV code uses the date paid (
              <span className="font-mono text-slate-600">EPV-YYYYMMDD-####</span>
              ); <span className="font-semibold text-slate-700">####</span> is the running disbursement sequence (#1 = earliest payment).
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          {isAdmin ? (
            <>
              <button
                type="button"
                disabled={!eventId || loading}
                onClick={downloadMasterList}
                className="inline-flex items-center gap-2 bg-white border-2 border-slate-200 text-slate-800 px-6 py-3 rounded-2xl font-black text-xs uppercase hover:bg-slate-50 disabled:opacity-40"
              >
                <Download size={16} aria-hidden />
                Download master list
              </button>
              <button
                type="button"
                disabled={!eventId || loading}
                onClick={() => void syncVoucherNumbers()}
                className="inline-flex items-center gap-2 bg-white border-2 border-slate-200 text-slate-600 px-6 py-3 rounded-2xl font-black text-xs uppercase hover:bg-slate-50 disabled:opacity-40"
              >
                Resequence disbursements
              </button>
            </>
          ) : null}
          <button
            type="button"
            disabled={!canEdit || !eventId}
            onClick={() => setIsAdding(!isAdding)}
            className="inline-flex items-center gap-2 bg-slate-900 text-white px-8 py-3 rounded-2xl font-black text-xs uppercase shadow-lg hover:bg-black disabled:opacity-40"
          >
            <Plus size={16} aria-hidden />
            {isAdding ? "Cancel" : "New voucher"}
          </button>
        </div>
      </div>

      {isAdding && (
        <div className="bg-white p-8 rounded-[40px] border-2 border-violet-100 shadow-xl space-y-6">
          <h4 className="text-sm font-black uppercase text-slate-700">Create electronic payment voucher</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 md:col-span-2">
              <span className="block text-[10px] font-black text-slate-400 uppercase">
                Link to budget line (optional — for expense group only; does not change payee or amount)
              </span>
              <select
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-3.5 text-sm font-semibold"
                value={draft.expenseId}
                onChange={(e) => handleExpensePick(e.target.value)}
              >
                <option value="">— Manual entry —</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.category} · {s.company} — ₱{(Number(s.amount) || 0).toLocaleString()}
                  </option>
                ))}
              </select>
            </div>
            <SetupInput
              label="Payee / vendor name *"
              value={draft.supplierName}
              onChange={(e) => setDraft({ ...draft, supplierName: e.target.value })}
            />
            <SetupInput
              label="Amount (₱) *"
              type="number"
              min={0}
              value={draft.amount}
              onChange={(e) => setDraft({ ...draft, amount: Number(e.target.value) })}
            />
            <SetupInput
              label="Payee email"
              type="email"
              value={draft.payeeEmail}
              onChange={(e) => setDraft({ ...draft, payeeEmail: e.target.value })}
            />
            <SetupInput
              label="Payee contact"
              value={draft.payeeContact}
              onChange={(e) => setDraft({ ...draft, payeeContact: e.target.value })}
            />
            <SetupInput
              label="Payment method"
              value={draft.paymentMethod}
              onChange={(e) => setDraft({ ...draft, paymentMethod: e.target.value })}
            />
            <SetupInput
              label="Payment reference"
              value={draft.paymentReference}
              onChange={(e) => setDraft({ ...draft, paymentReference: e.target.value })}
            />
            <SetupInput
              label="Payment date"
              type="date"
              value={draft.paymentDate}
              onChange={(e) => setDraft({ ...draft, paymentDate: e.target.value })}
            />
            <SetupInput
              label="Description"
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            />
          </div>
          <button
            type="button"
            disabled={!canEdit || !String(draft.supplierName).trim()}
            onClick={() => void handleCreate()}
            className="bg-violet-600 text-white px-8 py-3 rounded-2xl font-black text-xs uppercase hover:bg-violet-700 disabled:opacity-40"
          >
            Create & copy link
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-500 px-4">Loading vouchers…</p>
      ) : (
        <div className="overflow-x-auto rounded-[32px] border bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-left">
                <th className="p-4 text-[10px] font-black uppercase text-slate-400 w-14">#</th>
                <th className="p-4 text-[10px] font-black uppercase text-slate-400">Voucher / ref</th>
                <th className="p-4 text-[10px] font-black uppercase text-slate-400">Expense group</th>
                <th className="p-4 text-[10px] font-black uppercase text-slate-400">Payee</th>
                <th className="p-4 text-[10px] font-black uppercase text-slate-400">Amount</th>
                <th className="p-4 text-[10px] font-black uppercase text-slate-400">Date paid</th>
                <th className="p-4 text-[10px] font-black uppercase text-slate-400">Receipt</th>
                <th className="p-4 text-[10px] font-black uppercase text-slate-400">Status</th>
                <th className="p-4 text-[10px] font-black uppercase text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {vouchersByDisbursement.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-500">
                    No payment vouchers yet. Create one to send a confirmation link to a supplier.
                  </td>
                </tr>
              ) : (
                vouchersByDisbursement.map((v) => {
                  const seq = disbursementSeq(v.voucher_number);
                  return (
                  <tr key={v.id} className="border-b last:border-0 hover:bg-slate-50/80">
                    <td className="p-4 font-black text-violet-700 tabular-nums text-sm">
                      {seq != null ? seq : "—"}
                    </td>
                    <td className="p-4 font-mono text-xs font-bold text-slate-700">
                      <div>{v.voucher_number}</div>
                      <div className="text-[10px] text-slate-500 font-normal">{v.payment_reference}</div>
                    </td>
                    <td className="p-4 text-xs font-semibold text-slate-700">
                      {expenseGroupForLinkedExpense(v.expense_id, suppliers) || "—"}
                    </td>
                    <td className="p-4 font-semibold text-slate-800">{v.supplier_name}</td>
                    <td className="p-4 font-black">₱{(Number(v.amount) || 0).toLocaleString()}</td>
                    <td className="p-4 text-slate-600 font-semibold text-xs">
                      {formatPaymentDate(v.payment_date)}
                    </td>
                    <td className="p-4 text-xs">{v.has_receipt ? "Yes" : "—"}</td>
                    <td className="p-4">
                      <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-md ${STATUS_STYLES[v.status] || STATUS_STYLES.sent}`}>
                        {v.status}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          title="Copy confirmation link"
                          onClick={() => void copyLink(v)}
                          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 text-[10px] font-black uppercase hover:bg-slate-100"
                        >
                          {copiedId === v.id ? <Check size={14} /> : <Link2 size={14} />}
                          {copiedId === v.id ? "Copied" : "Link"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void openView(v)}
                          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 text-[10px] font-black uppercase hover:bg-slate-100"
                        >
                          <Eye size={14} />
                          View
                        </button>
                        {isAdmin ? (
                          <button
                            type="button"
                            onClick={() => setEditVoucher(v)}
                            className="inline-flex items-center gap-1 rounded-xl border border-violet-200 text-violet-700 px-3 py-1.5 text-[10px] font-black uppercase hover:bg-violet-50"
                          >
                            <Edit3 size={14} />
                            Edit
                          </button>
                        ) : null}
                        {canEdit && v.status !== "confirmed" && v.status !== "void" ? (
                          <button
                            type="button"
                            onClick={() => void handleVoid(v.id)}
                            className="inline-flex items-center gap-1 rounded-xl border border-amber-200 text-amber-800 px-3 py-1.5 text-[10px] font-black uppercase hover:bg-amber-50"
                          >
                            <XCircle size={14} />
                            Void
                          </button>
                        ) : null}
                        {isSuperuser ? (
                          <button
                            type="button"
                            title="Superuser only — removes row and resequences EPV numbers"
                            onClick={() => void handleDelete(v.id)}
                            className="inline-flex items-center gap-1 rounded-xl border border-rose-200 text-rose-700 px-3 py-1.5 text-[10px] font-black uppercase hover:bg-rose-50"
                          >
                            <Trash2 size={14} />
                            Delete
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      <VoucherDetailDialog
        voucher={viewVoucher}
        signature={viewSignature}
        receipt={viewReceipt}
        onClose={() => {
          setViewVoucher(null);
          setViewSignature(null);
          setViewReceipt(null);
        }}
      />
      <VoucherEditDialog
        voucher={editVoucher}
        suppliers={suppliers}
        onClose={() => setEditVoucher(null)}
        onSaved={reload}
        onError={onError}
      />
    </div>
  );
}
