import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Edit3, Eye, FileSignature, Link2, Plus, Trash2, XCircle } from "lucide-react";
import {
  createPaymentVoucher,
  deletePaymentVoucher,
  getPaymentVoucherSignature,
  getPaymentVouchers,
  supplierVoucherPublicUrl,
  voidPaymentVoucher,
} from "../lib/api";
import { formatPaidStampDate } from "../components/PaidStamp";
import { VoucherDetailDialog, VoucherEditDialog } from "./SupplierVouchersPanel";

const STATUS_STYLES = {
  sent: "bg-slate-100 text-slate-700",
  viewed: "bg-amber-50 text-amber-800",
  confirmed: "bg-emerald-50 text-emerald-800",
  void: "bg-rose-50 text-rose-700",
};

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

export default function PaymentVouchersHub({ eventId, suppliers, canEdit, isAdmin = false, onError, onInfo }) {
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [copiedId, setCopiedId] = useState("");
  const [viewVoucher, setViewVoucher] = useState(null);
  const [viewSignature, setViewSignature] = useState(null);
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
    const row = suppliers.find((s) => s.id === expenseId);
    setDraft((d) => ({
      ...d,
      expenseId,
      supplierName: row?.company || d.supplierName,
      amount: row ? Number(row.amount) || 0 : d.amount,
      description: row ? `${row.category} — ${row.company}` : d.description,
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
        onInfo?.(`Voucher ${res.item?.voucher_number} created. Link copied.`);
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
    if (!window.confirm("Delete this draft voucher?")) return;
    try {
      await deletePaymentVoucher(id);
      await reload();
    } catch (e) {
      onError?.(e, "Failed to delete voucher.");
    }
  };

  const openView = async (v) => {
    setViewVoucher(v);
    setViewSignature(null);
    if (v.status === "confirmed" || v.has_signature) {
      try {
        const sig = await getPaymentVoucherSignature(v.id);
        setViewSignature(sig);
      } catch (e) {
        onError?.(e, "Failed to load stored acknowledgment.");
      }
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
            <p className="text-sm text-slate-500">Send suppliers a link to confirm receipt and sign electronically.</p>
          </div>
        </div>
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

      {isAdding && (
        <div className="bg-white p-8 rounded-[40px] border-2 border-violet-100 shadow-xl space-y-6">
          <h4 className="text-sm font-black uppercase text-slate-700">Create electronic payment voucher</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 md:col-span-2">
              <span className="block text-[10px] font-black text-slate-400 uppercase">Link to supplier expense (optional)</span>
              <select
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-3.5 text-sm font-semibold"
                value={draft.expenseId}
                onChange={(e) => handleExpensePick(e.target.value)}
              >
                <option value="">— Manual entry —</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.company} — ₱{(Number(s.amount) || 0).toLocaleString()}
                  </option>
                ))}
              </select>
            </div>
            <SetupInput
              label="Supplier / payee name *"
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
                <th className="p-4 text-[10px] font-black uppercase text-slate-400">Voucher</th>
                <th className="p-4 text-[10px] font-black uppercase text-slate-400">Supplier</th>
                <th className="p-4 text-[10px] font-black uppercase text-slate-400">Amount</th>
                <th className="p-4 text-[10px] font-black uppercase text-slate-400">Date paid</th>
                <th className="p-4 text-[10px] font-black uppercase text-slate-400">Status</th>
                <th className="p-4 text-[10px] font-black uppercase text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {vouchers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">
                    No payment vouchers yet. Create one to send a confirmation link to a supplier.
                  </td>
                </tr>
              ) : (
                vouchers.map((v) => (
                  <tr key={v.id} className="border-b last:border-0 hover:bg-slate-50/80">
                    <td className="p-4 font-mono text-xs font-bold text-slate-700">{v.voucher_number}</td>
                    <td className="p-4 font-semibold text-slate-800">{v.supplier_name}</td>
                    <td className="p-4 font-black">₱{(Number(v.amount) || 0).toLocaleString()}</td>
                    <td className="p-4 text-slate-600 font-semibold text-xs">
                      {v.date_received ? formatPaidStampDate(v.date_received) : "—"}
                    </td>
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
                          <>
                            <button
                              type="button"
                              onClick={() => void handleVoid(v.id)}
                              className="inline-flex items-center gap-1 rounded-xl border border-amber-200 text-amber-800 px-3 py-1.5 text-[10px] font-black uppercase hover:bg-amber-50"
                            >
                              <XCircle size={14} />
                              Void
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDelete(v.id)}
                              className="inline-flex items-center gap-1 rounded-xl border border-rose-200 text-rose-700 px-3 py-1.5 text-[10px] font-black uppercase hover:bg-rose-50"
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <VoucherDetailDialog
        voucher={viewVoucher}
        signature={viewSignature}
        onClose={() => {
          setViewVoucher(null);
          setViewSignature(null);
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
