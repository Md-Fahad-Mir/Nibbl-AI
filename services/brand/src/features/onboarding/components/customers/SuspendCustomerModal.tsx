"use client";

import { useState } from "react";
import { X } from "lucide-react";

interface SuspendCustomerModalProps {
  isOpen: boolean;
  customerName: string;
  isSuspended: boolean;
  onConfirm: (reason: string) => void | Promise<void>;
  onClose: () => void;
  isLoading?: boolean;
  error?: string;
  brandName?: string;
}

const REASONS = ["Suspicious claim activity", "Fraudulent or altered receipts", "Abusive behavior", "Other"];

/** Master Customer Profile: "Ban {name}?" — this brand only, with a reason.
 *  Existing opportunities stay valid. Also lifts a ban. */
export default function SuspendCustomerModal({
  isOpen, customerName, isSuspended, onConfirm, onClose, isLoading = false, error = "", brandName = "your brand",
}: SuspendCustomerModalProps) {
  const [reason, setReason] = useState(REASONS[0]);
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-[440px] bg-white rounded-[24px] p-6 flex flex-col gap-4 font-manrope" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-start">
          <h3 className="font-jakarta font-extrabold text-xl text-[#131B2E]">
            {isSuspended ? `Lift the ban on ${customerName}?` : `Ban ${customerName}?`}
          </h3>
          <button onClick={onClose} aria-label="Close" className="text-[#94A3B8] cursor-pointer"><X className="w-5 h-5" /></button>
        </div>
        {isSuspended ? (
          <p className="text-sm text-[#454656]">{customerName} will be able to claim {brandName} offers and receive review opportunities again.</p>
        ) : (
          <>
            <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl p-3">
              This will ban {customerName} from {brandName} campaigns only. This does not affect their access to other brands on Nibbl.
            </p>
            <label className="flex flex-col gap-1 text-xs font-bold text-[#454656]">
              Reason
              <select value={reason} onChange={(e) => setReason(e.target.value)}
                className="h-11 px-3 rounded-xl border border-[#E0E3F5] text-sm font-normal text-[#131B2E] outline-none">
                {REASONS.map((r) => <option key={r}>{r}</option>)}
              </select>
            </label>
            <p className="text-xs text-[#64748B]">
              Blocks future {brandName} rebate claims and review opportunities. Existing opportunities remain valid.
            </p>
          </>
        )}
        {error && <p className="text-xs font-bold text-red-600">{error}</p>}
        <div className="flex justify-end gap-3">
          <button onClick={onClose} disabled={isLoading} className="h-10 px-5 rounded-full border border-slate-200 text-sm font-bold text-[#454656] cursor-pointer">Cancel</button>
          <button onClick={() => void onConfirm(reason)} disabled={isLoading}
            className={`h-10 px-5 rounded-full text-white text-sm font-bold disabled:opacity-50 cursor-pointer ${isSuspended ? "bg-[#001BD2]" : "bg-red-600"}`}>
            {isLoading ? "Saving…" : isSuspended ? "Lift Ban" : "Confirm Ban"}
          </button>
        </div>
      </div>
    </div>
  );
}
