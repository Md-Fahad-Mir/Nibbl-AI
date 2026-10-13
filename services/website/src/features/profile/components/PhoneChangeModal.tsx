"use client";

import { useEffect, useState } from "react";
import { ApiRecord, nibblApi } from "@/lib/api/backendApi";
import { Lock } from "lucide-react";

/** A verified phone is locked (account security). The shopper asks Nibbl to
 *  change it; once approved they verify the new number by SMS. */
export default function PhoneChangeModal({ phone, onClose }: { phone: string; onClose: () => void }) {
  const [request, setRequest] = useState<ApiRecord | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [newPhone, setNewPhone] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    nibblApi
      .phoneChangeRequest()
      .then((data) => live && setRequest((data.request as ApiRecord | null) ?? null))
      .catch(() => undefined)
      .finally(() => live && setLoaded(true));
    return () => {
      live = false;
    };
  }, []);

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      const data = await nibblApi.createPhoneChangeRequest({ new_phone: newPhone.trim(), country: "US", reason: reason.trim() });
      setRequest(data.request as ApiRecord);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the request.");
    } finally {
      setBusy(false);
    }
  };

  const pending = request?.status === "pending";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-[400px] bg-white rounded-[16px] p-6 flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-[18px] font-semibold text-[#1F1D1D]">Phone number</h3>
        <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm">
          <span>{phone}</span>
          <span className="text-[#00A671] font-medium flex items-center gap-1"><Lock className="w-3.5 h-3.5" /> Verified · locked</span>
        </div>
        <p className="text-[13px] text-[#575757]">
          Your verified phone is locked for your security. To use a different number, request a change — Nibbl reviews it,
          then you&apos;ll verify the new number by text. Withdrawals pause for 48 hours after a change.
        </p>
        {!loaded ? null : pending ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-[13px] text-amber-900">
            <b>Change request submitted.</b> Nibbl will review your request to change to {String(request?.new_phone)}.
          </div>
        ) : (
          <>
            {request?.status === "rejected" && (
              <p className="text-[13px] text-[#E65353]">Your last request wasn&apos;t approved: {String(request.decision_note || "")}</p>
            )}
            {request?.status === "approved" && (
              <p className="text-[13px] text-[#00A671]">Your change was approved — verify the new number from Profile.</p>
            )}
            <input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} type="tel"
              placeholder="New mobile number (e.g. +1 512 555 0123)" className="h-10 px-3 rounded-lg border border-gray-300 text-sm" />
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2}
              placeholder="Why are you changing it? (optional)" className="px-3 py-2 rounded-lg border border-gray-300 text-sm" />
            {error && <p className="text-[13px] text-[#E65353]">{error}</p>}
            <button onClick={() => void submit()} disabled={busy || !newPhone.trim()}
              className="h-11 rounded-lg bg-[#3E3EDF] text-white text-sm font-semibold disabled:opacity-50 cursor-pointer">
              {busy ? "Sending…" : "Request a change"}
            </button>
          </>
        )}
        <button onClick={onClose} className="h-10 rounded-lg border border-gray-300 text-sm font-medium cursor-pointer">Done</button>
      </div>
    </div>
  );
}
