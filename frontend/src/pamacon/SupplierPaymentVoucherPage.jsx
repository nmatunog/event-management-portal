import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle2, FileText, Loader2 } from "lucide-react";
import PaidStamp, { formatPaidStampDate } from "../components/PaidStamp";
import ReceiptUpload from "../components/ReceiptUpload";
import SignaturePad from "../components/SignaturePad";
import { confirmPublicPaymentVoucher, getPublicPaymentVoucher } from "../lib/api";
import { reencodeImageDataUrlAsJpeg } from "../lib/imageCompress";

function todayIsoDate() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function SupplierPaymentVoucherPage() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [voucher, setVoucher] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const [confirmedReceipt, setConfirmedReceipt] = useState(false);
  const [signerName, setSignerName] = useState("");
  const [signerTitle, setSignerTitle] = useState("");
  const [receiptNotes, setReceiptNotes] = useState("");
  const [signatureDataUrl, setSignatureDataUrl] = useState("");
  const [signatureMethod, setSignatureMethod] = useState("draw");
  const [useTypedSignature, setUseTypedSignature] = useState(false);
  const [dateReceived, setDateReceived] = useState(todayIsoDate);
  const [supplierReceiptNumber, setSupplierReceiptNumber] = useState("");
  const [receiptDataUrls, setReceiptDataUrls] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await getPublicPaymentVoucher(token);
        if (cancelled) return;
        setVoucher(res.voucher);
        if (res.voucher?.status === "confirmed") setDone(true);
      } catch (e) {
        if (!cancelled) setError(String(e?.message || "Unable to load payment voucher."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!voucher || voucher.status === "confirmed") return;
    if (!confirmedReceipt) {
      setError("Please confirm that you received this payment.");
      return;
    }
    if (!String(signerName).trim()) {
      setError("Please enter the name of the person signing.");
      return;
    }
    if (!String(dateReceived).trim()) {
      setError("Please enter the date you received payment.");
      return;
    }
    if (!useTypedSignature && !String(signatureDataUrl).trim()) {
      setError("Please draw or upload your signature.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      let payloadSignature = signatureDataUrl;
      if (!useTypedSignature && payloadSignature) {
        payloadSignature = await reencodeImageDataUrlAsJpeg(payloadSignature, 520, 0.85);
      }
      const res = await confirmPublicPaymentVoucher(token, {
        confirmedReceipt: true,
        signerName: String(signerName).trim(),
        signerTitle: String(signerTitle).trim() || undefined,
        receiptNotes: String(receiptNotes).trim() || undefined,
        signatureMethod: useTypedSignature ? "typed" : signatureMethod,
        signatureDataUrl: useTypedSignature ? undefined : payloadSignature,
        dateReceived: String(dateReceived).trim(),
        supplierReceiptNumber: String(supplierReceiptNumber).trim() || undefined,
        receiptDataUrls: receiptDataUrls.length ? receiptDataUrls : undefined,
      });
      setVoucher(res.voucher);
      setDone(true);
    } catch (err) {
      setError(String(err?.message || "Could not submit confirmation."));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <Loader2 className="animate-spin text-blue-600" size={36} aria-hidden />
      </div>
    );
  }

  if (error && !voucher) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-3xl border shadow-lg p-8 text-center">
          <p className="text-rose-600 font-semibold">{error}</p>
        </div>
      </div>
    );
  }

  const isConfirmed = done || voucher?.status === "confirmed";
  const amount = Number(voucher?.amount) || 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 to-slate-200 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <header className="bg-white rounded-[32px] border shadow-sm p-8">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <FileText size={28} aria-hidden />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Electronic payment voucher</p>
              <h1 className="text-2xl font-black text-slate-900 mt-1">Payment acknowledgment</h1>
              {voucher?.eventTitle ? <p className="text-sm text-slate-500 mt-1">{voucher.eventTitle}</p> : null}
            </div>
          </div>
        </header>

        <section className="bg-white rounded-[32px] border shadow-sm p-8 space-y-4 relative overflow-hidden">
          {isConfirmed && voucher?.dateReceived ? (
            <PaidStamp dateReceived={voucher.dateReceived} className="absolute top-4 right-4 z-10 sm:top-6 sm:right-6" />
          ) : null}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm sm:pr-36">
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400">Voucher no.</p>
              <p className="font-mono font-bold text-slate-800">{voucher?.voucherNumber || "—"}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400">Payment reference</p>
              <p className="font-mono font-bold text-slate-800">{voucher?.paymentReference || voucher?.voucherNumber || "—"}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400">Supplier</p>
              <p className="font-bold text-slate-800">{voucher?.supplierName}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400">Amount paid</p>
              <p className="text-2xl font-black text-blue-600">
                {voucher?.currency === "PHP" || !voucher?.currency ? "₱" : `${voucher.currency} `}
                {amount.toLocaleString()}
              </p>
            </div>
            {isConfirmed && voucher?.dateReceived ? (
              <div>
                <p className="text-[10px] font-black uppercase text-slate-400">Date received</p>
                <p className="font-bold text-emerald-800">{formatPaidStampDate(voucher.dateReceived)}</p>
              </div>
            ) : null}
            {voucher?.paymentDate ? (
              <div>
                <p className="text-[10px] font-black uppercase text-slate-400">Payment date (issuer)</p>
                <p className="font-bold text-slate-800">{voucher.paymentDate}</p>
              </div>
            ) : null}
            {voucher?.paymentMethod ? (
              <div>
                <p className="text-[10px] font-black uppercase text-slate-400">Payment method</p>
                <p className="font-bold text-slate-800">{voucher.paymentMethod}</p>
              </div>
            ) : null}
            {voucher?.paymentReference ? (
              <div className="sm:col-span-2">
                <p className="text-[10px] font-black uppercase text-slate-400">Reference</p>
                <p className="font-bold text-slate-800 break-all">{voucher.paymentReference}</p>
              </div>
            ) : null}
          </div>
          {voucher?.description ? (
            <div className="pt-4 border-t border-slate-100">
              <p className="text-[10px] font-black uppercase text-slate-400">Description</p>
              <p className="text-sm text-slate-700 mt-1">{voucher.description}</p>
            </div>
          ) : null}
        </section>

        {isConfirmed ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-[32px] p-8 text-center space-y-3">
            <CheckCircle2 className="mx-auto text-emerald-600" size={48} aria-hidden />
            <h2 className="text-xl font-black text-emerald-900">Payment receipt confirmed</h2>
            <p className="text-sm text-emerald-800">
              Signed by <strong>{voucher?.signerName}</strong>
              {voucher?.signedAt ? ` on ${new Date(voucher.signedAt).toLocaleString()}` : ""}.
            </p>
            {voucher?.dateReceived ? (
              <p className="text-sm font-semibold text-emerald-900">
                Date paid: {formatPaidStampDate(voucher.dateReceived)}
              </p>
            ) : null}
          </div>
        ) : (
          <form onSubmit={(e) => void handleSubmit(e)} className="bg-white rounded-[32px] border shadow-sm p-8 space-y-6">
            <h2 className="text-lg font-black text-slate-800">Confirm receipt & sign</h2>
            <p className="text-sm text-slate-600">
              By signing below, you confirm that your organization received the payment details shown above.
            </p>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-slate-300"
                checked={confirmedReceipt}
                onChange={(e) => setConfirmedReceipt(e.target.checked)}
              />
              <span className="text-sm font-semibold text-slate-800">
                I confirm that payment in the amount stated has been received.
              </span>
            </label>

            <label className="space-y-2 block max-w-xs">
              <span className="block text-[10px] font-black uppercase text-slate-400">Date received *</span>
              <input
                type="date"
                className="w-full rounded-2xl border-2 border-slate-100 bg-slate-50 p-3.5 text-sm font-semibold"
                value={dateReceived}
                onChange={(e) => setDateReceived(e.target.value)}
                required
              />
              <span className="text-[10px] text-slate-500">When payment was received in your account.</span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="space-y-2">
                <span className="block text-[10px] font-black uppercase text-slate-400">Your full name *</span>
                <input
                  className="w-full rounded-2xl border-2 border-slate-100 bg-slate-50 p-3.5 text-sm font-semibold"
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  placeholder="Authorized signatory"
                  required
                />
              </label>
              <label className="space-y-2">
                <span className="block text-[10px] font-black uppercase text-slate-400">Title / role</span>
                <input
                  className="w-full rounded-2xl border-2 border-slate-100 bg-slate-50 p-3.5 text-sm font-semibold"
                  value={signerTitle}
                  onChange={(e) => setSignerTitle(e.target.value)}
                  placeholder="e.g. Finance Manager"
                />
              </label>
            </div>

            <label className="space-y-2">
              <span className="block text-[10px] font-black uppercase text-slate-400">Notes (optional)</span>
              <textarea
                className="w-full rounded-2xl border-2 border-slate-100 bg-slate-50 p-3.5 text-sm min-h-[80px]"
                value={receiptNotes}
                onChange={(e) => setReceiptNotes(e.target.value)}
                placeholder="Invoice number, bank account, or other reference"
              />
            </label>

            <label className="space-y-2 block max-w-xs">
              <span className="block text-[10px] font-black uppercase text-slate-400">Official receipt / OR number (optional)</span>
              <input
                className="w-full rounded-2xl border-2 border-slate-100 bg-slate-50 p-3.5 text-sm font-semibold"
                value={supplierReceiptNumber}
                onChange={(e) => setSupplierReceiptNumber(e.target.value)}
                placeholder="e.g. OR-12345"
              />
            </label>

            <ReceiptUpload
              value={receiptDataUrls}
              onChange={setReceiptDataUrls}
              label="Upload official receipt images (optional)"
            />

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300"
                checked={useTypedSignature}
                onChange={(e) => {
                  setUseTypedSignature(e.target.checked);
                  if (e.target.checked) setSignatureDataUrl("");
                }}
              />
              <span className="text-sm text-slate-600">I cannot sign digitally — use typed name only</span>
            </label>

            {!useTypedSignature ? (
              <div className="space-y-2">
                <span className="block text-[10px] font-black uppercase text-slate-400">Electronic signature *</span>
                <SignaturePad
                  value={signatureDataUrl}
                  onChange={(url) => {
                    setSignatureDataUrl(url);
                    setSignatureMethod(url?.includes("jpeg") ? "upload" : "draw");
                  }}
                />
              </div>
            ) : (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-xl p-3">
                Your typed name above will be recorded as your acknowledgment signature.
              </p>
            )}

            {error ? <p className="text-sm text-rose-600 font-semibold">{error}</p> : null}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-wider hover:bg-black disabled:opacity-50"
            >
              {submitting ? "Submitting…" : "Submit confirmation"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
