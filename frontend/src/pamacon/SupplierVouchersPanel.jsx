import { useCallback, useEffect, useState } from "react";
import { Edit3, Eye, FileSignature, Link2 } from "lucide-react";
import { formatPaidStampDate } from "../components/PaidStamp";
import PaidStamp from "../components/PaidStamp";
import ReceiptUpload from "../components/ReceiptUpload";
import {
  getPaymentVoucherReceipt,
  getPaymentVoucherSignature,
  getPaymentVouchers,
  patchPaymentVoucherDetails,
  supplierVoucherPublicUrl,
} from "../lib/api";

const STATUS_STYLES = {
  sent: "bg-slate-100 text-slate-700",
  viewed: "bg-amber-50 text-amber-800",
  confirmed: "bg-emerald-50 text-emerald-800",
  void: "bg-rose-50 text-rose-700",
};

function Field({ label, children, className = "" }) {
  return (
    <label className={`space-y-2 block ${className}`}>
      <span className="block text-[10px] font-black text-slate-400 uppercase">{label}</span>
      {children}
    </label>
  );
}

function inputClass(disabled) {
  return `w-full rounded-2xl border-2 border-slate-100 bg-slate-50 p-3.5 text-sm font-semibold ${disabled ? "opacity-50" : ""}`;
}

export function VoucherDetailDialog({ voucher, signature, receipt, onClose }) {
  if (!voucher) return null;
  const v = voucher;
  const sig = signature;
  const isConfirmed = v.status === "confirmed";

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="bg-white rounded-[32px] max-w-2xl w-full max-h-[90vh] overflow-y-auto p-8 space-y-5 shadow-2xl relative">
        {isConfirmed && v.date_received ? (
          <PaidStamp dateReceived={v.date_received} className="absolute top-24 left-1/2 -translate-x-1/2 sm:left-auto sm:translate-x-0 sm:top-28 sm:right-8 pointer-events-none" />
        ) : null}
        <div className="flex justify-between items-start gap-4 relative z-20">
          <div>
            <p className="text-[10px] font-black uppercase text-slate-400">Payment voucher</p>
            <h3 className="font-black text-slate-900 text-lg font-mono">{v.voucher_number}</h3>
            <p className="text-xs font-mono text-slate-500">Ref: {v.payment_reference || v.voucher_number}</p>
            <p className="text-sm text-slate-600">{v.supplier_name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-100 hover:text-slate-900 text-2xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-[10px] font-black uppercase text-slate-400">Amount</p>
            <p className="font-bold">₱{(Number(v.amount) || 0).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase text-slate-400">Status</p>
            <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-md ${STATUS_STYLES[v.status] || STATUS_STYLES.sent}`}>
              {v.status}
            </span>
          </div>
          {v.payment_method ? (
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400">Payment method</p>
              <p className="font-semibold">{v.payment_method}</p>
            </div>
          ) : null}
          {v.payment_reference ? (
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400">Reference</p>
              <p className="font-semibold break-all">{v.payment_reference}</p>
            </div>
          ) : null}
          {v.payment_date ? (
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400">Payment date (issuer)</p>
              <p className="font-semibold">{v.payment_date}</p>
            </div>
          ) : null}
          {v.date_received ? (
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400">Date received</p>
              <p className="font-semibold text-emerald-800">{formatPaidStampDate(v.date_received)}</p>
            </div>
          ) : null}
        </div>

        {v.description ? (
          <div>
            <p className="text-[10px] font-black uppercase text-slate-400">Particulars</p>
            <p className="text-sm text-slate-700">{v.description}</p>
          </div>
        ) : null}
        {v.notes ? (
          <div>
            <p className="text-[10px] font-black uppercase text-slate-400">Internal notes</p>
            <p className="text-sm text-slate-700">{v.notes}</p>
          </div>
        ) : null}

        {receipt?.receiptDataUrl ? (
          <div className="border-t border-slate-100 pt-4 space-y-2">
            <p className="text-[10px] font-black uppercase text-slate-400">Official receipt on file</p>
            {receipt.supplierReceiptNumber ? (
              <p className="text-sm font-semibold">OR / Receipt no.: {receipt.supplierReceiptNumber}</p>
            ) : null}
            <img src={receipt.receiptDataUrl} alt="Official receipt" className="max-h-56 mx-auto border rounded-xl p-2 bg-white" />
          </div>
        ) : null}

        {isConfirmed && sig ? (
          <div className="border-t border-slate-100 pt-4 space-y-3">
            <p className="text-[10px] font-black uppercase text-slate-400">Supplier acknowledgment (stored)</p>
            <p className="text-sm">
              Signed by <strong>{sig.signerName}</strong>
              {sig.signerTitle ? ` · ${sig.signerTitle}` : ""}
              {sig.signedAt ? ` · ${new Date(sig.signedAt).toLocaleString()}` : ""}
            </p>
            {sig.receiptNotes ? (
              <p className="text-sm text-slate-600 bg-slate-50 rounded-xl p-3">
                <span className="font-bold">Supplier notes:</span> {sig.receiptNotes}
              </p>
            ) : null}
            {sig.signatureDataUrl ? (
              <img src={sig.signatureDataUrl} alt="Supplier signature" className="max-h-40 mx-auto border rounded-xl p-3 bg-white" />
            ) : (
              <p className="text-xs text-amber-800 bg-amber-50 rounded-xl p-3">Typed-name acknowledgment.</p>
            )}
          </div>
        ) : null}

        <div className="sticky bottom-0 border-t border-slate-100 bg-white pt-4 pb-1 -mx-2 px-2">
          <button
            type="button"
            onClick={onClose}
            className="w-full min-h-[48px] rounded-2xl bg-slate-900 text-white font-black text-xs uppercase tracking-wide hover:bg-black"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export function VoucherEditDialog({ voucher, suppliers, onClose, onSaved, onError }) {
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!voucher) return;
    setDraft({
      expenseId: voucher.expense_id || "",
      supplierName: voucher.supplier_name || "",
      payeeEmail: voucher.payee_email || "",
      payeeContact: voucher.payee_contact || "",
      amount: Number(voucher.amount) || 0,
      paymentMethod: voucher.payment_method || "",
      paymentReference: voucher.payment_reference || "",
      paymentDate: voucher.payment_date || "",
      description: voucher.description || "",
      notes: voucher.notes || "",
      dateReceived: voucher.date_received || "",
      supplierReceiptNumber: voucher.supplier_receipt_number || "",
      receiptDataUrl: "",
    });
  }, [voucher]);

  if (!voucher || !draft) return null;

  const save = async () => {
    if (!String(draft.supplierName).trim()) return;
    setSaving(true);
    try {
      await patchPaymentVoucherDetails(voucher.id, {
        expenseId: draft.expenseId || null,
        supplierName: draft.supplierName,
        payeeEmail: draft.payeeEmail,
        payeeContact: draft.payeeContact,
        amount: Number(draft.amount) || 0,
        paymentMethod: draft.paymentMethod,
        paymentReference: draft.paymentReference,
        paymentDate: draft.paymentDate,
        description: draft.description,
        notes: draft.notes,
        dateReceived: draft.dateReceived || null,
        supplierReceiptNumber: draft.supplierReceiptNumber,
        supplierReceiptDataUrl: draft.receiptDataUrl || null,
      });
      await onSaved?.();
      onClose();
    } catch (e) {
      onError?.(e, "Failed to save voucher.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="bg-white rounded-[32px] max-w-2xl w-full max-h-[90vh] overflow-y-auto p-8 space-y-5 shadow-2xl">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-[10px] font-black uppercase text-slate-400">Admin edit</p>
            <h3 className="font-black text-slate-900">{voucher.voucher_number}</h3>
            <p className="text-xs text-amber-800 mt-1">Edits apply even after supplier signed. Signature is not changed.</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700 text-2xl leading-none">
            ×
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Link expense" className="sm:col-span-2">
            <select
              className={inputClass(false)}
              value={draft.expenseId}
              onChange={(e) => {
                const id = e.target.value;
                const row = suppliers.find((s) => s.id === id);
                setDraft((d) => ({
                  ...d,
                  expenseId: id,
                  supplierName: row?.company || d.supplierName,
                  amount: row ? Number(row.amount) || d.amount : d.amount,
                }));
              }}
            >
              <option value="">— None —</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.company}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Supplier *">
            <input className={inputClass(false)} value={draft.supplierName} onChange={(e) => setDraft({ ...draft, supplierName: e.target.value })} />
          </Field>
          <Field label="Amount (₱) *">
            <input type="number" className={inputClass(false)} value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: Number(e.target.value) })} />
          </Field>
          <Field label="Payment method">
            <input className={inputClass(false)} value={draft.paymentMethod} onChange={(e) => setDraft({ ...draft, paymentMethod: e.target.value })} />
          </Field>
          <Field label="Voucher no. (read-only)" className="sm:col-span-2">
            <input className={inputClass(true)} value={voucher.voucher_number} disabled readOnly />
          </Field>
          <Field label="Payment reference">
            <input className={inputClass(false)} value={draft.paymentReference} onChange={(e) => setDraft({ ...draft, paymentReference: e.target.value })} />
          </Field>
          <Field label="Official receipt / OR no.">
            <input
              className={inputClass(false)}
              value={draft.supplierReceiptNumber}
              onChange={(e) => setDraft({ ...draft, supplierReceiptNumber: e.target.value })}
            />
          </Field>
          <Field label="Receipt image" className="sm:col-span-2">
            <ReceiptUpload value={draft.receiptDataUrl} onChange={(url) => setDraft({ ...draft, receiptDataUrl: url })} />
          </Field>
          <Field label="Payment date (issuer)">
            <input type="date" className={inputClass(false)} value={draft.paymentDate} onChange={(e) => setDraft({ ...draft, paymentDate: e.target.value })} />
          </Field>
          <Field label="Date received (PAID stamp)">
            <input type="date" className={inputClass(false)} value={draft.dateReceived} onChange={(e) => setDraft({ ...draft, dateReceived: e.target.value })} />
          </Field>
          <Field label="Particulars / description" className="sm:col-span-2">
            <textarea className={`${inputClass(false)} min-h-[72px]`} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
          </Field>
          <Field label="Internal notes" className="sm:col-span-2">
            <textarea className={`${inputClass(false)} min-h-[56px]`} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
          </Field>
        </div>

        <button
          type="button"
          disabled={saving || !String(draft.supplierName).trim()}
          onClick={() => void save()}
          className="w-full bg-violet-600 text-white py-3 rounded-2xl font-black text-xs uppercase hover:bg-violet-700 disabled:opacity-40"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}

/** Supplier payment vouchers — view for staff/admin; edit for admin only. */
export default function SupplierVouchersPanel({
  eventId,
  suppliers = [],
  canEdit = false,
  isAdmin = false,
  onError,
  onInfo,
  compact = false,
}) {
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [viewVoucher, setViewVoucher] = useState(null);
  const [viewSignature, setViewSignature] = useState(null);
  const [viewReceipt, setViewReceipt] = useState(null);
  const [editVoucher, setEditVoucher] = useState(null);

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

  const rows = compact ? vouchers.filter((v) => v.status === "confirmed" || v.status === "viewed" || v.status === "sent") : vouchers;

  return (
    <div className="bg-white rounded-[40px] border shadow-sm p-8 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-black uppercase text-slate-800">Payment acknowledgments</h3>
          <p className="text-sm text-slate-500">Signed supplier confirmations stored from e-voucher links.</p>
        </div>
        {!loading && rows.length > 0 ? (
          <span className="text-[10px] font-black uppercase text-slate-400">{rows.length} voucher(s)</span>
        ) : null}
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-500">No payment vouchers yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b text-left">
                <th className="p-3 text-[10px] font-black uppercase text-slate-400">Voucher / ref</th>
                <th className="p-3 text-[10px] font-black uppercase text-slate-400">Supplier</th>
                <th className="p-3 text-[10px] font-black uppercase text-slate-400">Amount</th>
                <th className="p-3 text-[10px] font-black uppercase text-slate-400">Date paid</th>
                <th className="p-3 text-[10px] font-black uppercase text-slate-400">Receipt</th>
                <th className="p-3 text-[10px] font-black uppercase text-slate-400">Status</th>
                <th className="p-3 text-[10px] font-black uppercase text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((v) => (
                <tr key={v.id} className="border-b last:border-0 hover:bg-slate-50/80">
                  <td className="p-3 font-mono text-xs font-bold">
                    <div>{v.voucher_number}</div>
                    <div className="text-[10px] text-slate-500 font-normal">{v.payment_reference}</div>
                  </td>
                  <td className="p-3 font-semibold">{v.supplier_name}</td>
                  <td className="p-3 font-black">₱{(Number(v.amount) || 0).toLocaleString()}</td>
                  <td className="p-3 text-xs font-semibold text-slate-600">
                    {v.date_received ? formatPaidStampDate(v.date_received) : "—"}
                  </td>
                  <td className="p-3 text-xs">{v.has_receipt ? "Yes" : "—"}</td>
                  <td className="p-3">
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${STATUS_STYLES[v.status] || ""}`}>{v.status}</span>
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        onClick={() => void openView(v)}
                        className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-black uppercase hover:bg-slate-100"
                      >
                        <Eye size={12} /> View
                      </button>
                      {isAdmin ? (
                        <button
                          type="button"
                          onClick={() => setEditVoucher(v)}
                          className="inline-flex items-center gap-1 rounded-lg border border-violet-200 text-violet-700 px-2 py-1 text-[10px] font-black uppercase hover:bg-violet-50"
                        >
                          <Edit3 size={12} /> Edit
                        </button>
                      ) : null}
                      {canEdit && v.status !== "confirmed" ? (
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(supplierVoucherPublicUrl(v.token));
                              onInfo?.("Link copied.");
                            } catch {
                              onError?.(new Error("copy"), "Could not copy link.");
                            }
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-black uppercase hover:bg-slate-100"
                        >
                          <Link2 size={12} /> Link
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
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
