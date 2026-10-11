"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiRecord, apiClient, backendApi } from "@/lib/api/backendApi";
import { useBrandApiStore } from "@/stores/useBrandApiStore";
import { formatDate, formatMoney } from "../../utils/backendMappers";

const STATUS: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700",
  refunded: "bg-emerald-50 text-[#15803D]",
  rejected: "bg-slate-100 text-slate-500",
};

/** Master Wallet "Request Refund": Available Cash is refundable; Reserved
 *  Funds and Promotional Credits are not. Nibbl reviews each request. */
export function useRefunds() {
  const brandId = useBrandApiStore((s) => s.selectedBrandId);
  const [data, setData] = useState<ApiRecord | null>(null);
  const reload = useCallback(() => {
    if (!brandId) return;
    apiClient.request<ApiRecord>(backendApi.brand.refundRequests(brandId)).then(setData).catch(() => undefined);
  }, [brandId]);
  useEffect(() => {
    reload();
  }, [reload]);
  return { brandId, data, setData, reload };
}

export function RequestRefundModal({ refundable, onClose, onDone }: {
  refundable: string;
  onClose: () => void;
  onDone: (data: ApiRecord) => void;
}) {
  const brandId = useBrandApiStore((s) => s.selectedBrandId);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!brandId) return;
    setBusy(true);
    setError("");
    try {
      onDone(await apiClient.request<ApiRecord>(backendApi.brand.requestRefund(brandId), { body: { amount, reason } }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the request.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-[24px] p-6 w-full max-w-md flex flex-col gap-4 font-manrope">
        <h3 className="font-jakarta font-extrabold text-lg text-[#131B2E]">Request Refund</h3>
        <p className="text-sm text-[#454656]">
          You can request up to <b>{formatMoney(refundable)}</b> — your Available Cash. Reserved Funds and Promotional
          Credits are non-refundable. Nibbl reviews each request and returns the money to your payment method.
        </p>
        <label className="flex flex-col gap-1.5 text-xs font-bold text-[#454656] uppercase tracking-wider">
          Amount
          <input type="number" min="0.01" step="0.01" max={refundable} value={amount}
            onChange={(e) => setAmount(e.target.value)} placeholder="0.00"
            className="h-11 px-3 rounded-xl border border-[#E0E3F5] text-sm font-normal normal-case tracking-normal text-[#131B2E] outline-none focus:border-[#001BD2]" />
        </label>
        <button type="button" onClick={() => setAmount(refundable)} className="self-start text-xs font-bold text-[#001BD2] cursor-pointer">
          Use full Available Cash
        </button>
        <label className="flex flex-col gap-1.5 text-xs font-bold text-[#454656] uppercase tracking-wider">
          Reason (optional)
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={1000}
            className="rounded-xl border border-[#E0E3F5] p-3 text-sm font-normal normal-case tracking-normal text-[#131B2E] outline-none focus:border-[#001BD2]" />
        </label>
        {error && <p className="text-xs font-semibold text-red-600">{error}</p>}
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="h-10 px-4 text-sm font-bold text-[#454656] cursor-pointer">Cancel</button>
          <button disabled={busy || !(Number(amount) > 0)} onClick={() => void submit()}
            className="h-10 px-5 rounded-full bg-[#001BD2] text-white text-sm font-bold disabled:opacity-50 cursor-pointer">
            {busy ? "Sending…" : "Request Refund"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function RefundRequestList({ requests }: { requests: ApiRecord[] }) {
  if (!requests.length) return null;
  return (
    <section className="bg-white border border-[#EAEDFF] rounded-[20px] p-6 shadow-sm flex flex-col gap-3">
      <h3 className="font-jakarta font-bold text-base text-[#131B2E]">Refund requests</h3>
      <table className="w-full text-sm">
        <tbody>
          {requests.map((r) => (
            <tr key={String(r.id)} className="border-b border-[#F8F9FF] align-top">
              <td className="py-2 pr-3 whitespace-nowrap">{formatDate(String(r.created_at ?? ""))}</td>
              <td className="py-2 pr-3 font-semibold">{formatMoney(r.amount)}</td>
              <td className="py-2 pr-3">
                <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full capitalize ${STATUS[String(r.status)] ?? ""}`}>
                  {String(r.status) === "pending" ? "Being reviewed" : String(r.status)}
                </span>
              </td>
              <td className="py-2 text-xs text-[#64748B]">{String(r.decision_note || r.reason || "")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
