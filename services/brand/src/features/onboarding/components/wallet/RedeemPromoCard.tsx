"use client";

import { useState } from "react";
import { useBrandApiStore } from "@/stores/useBrandApiStore";
import { formatMoney, toNumber } from "../../utils/backendMappers";

export default function RedeemPromoCard() {
  const redeemPromoCode = useBrandApiStore((state) => state.redeemPromoCode);
  const wallet = useBrandApiStore((state) => state.wallet);
  const promotional = toNumber(wallet?.promotional);

  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleRedeem = async () => {
    if (!code.trim() || submitting) return;
    setError("");
    setSuccess("");
    setSubmitting(true);
    try {
      const result = await redeemPromoCode(code.trim());
      setSuccess(`Added ${formatMoney(result.amount)} in promotional credit.`);
      setCode("");
    } catch (err) {
      setError((err as Error).message || "Could not redeem this code.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full bg-white border border-[#C5C5D9]/10 shadow-[0px_1px_2px_rgba(0,0,0,0.05)] rounded-[32px] p-8 flex flex-col gap-4">
      <div className="flex justify-between items-start gap-4">
        <div className="flex flex-col text-left">
          <h3 className="font-jakarta font-bold text-lg text-[#131B2E]">Promo Code</h3>
          <span className="text-xs text-[#454656] font-medium mt-1">
            Redeem a code for promotional credit (covers fees &amp; subscription, not rewards).
          </span>
        </div>
        {promotional > 0 && (
          <div className="text-right">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-[#454656]/60">
              Promotional
            </span>
            <span className="block text-base font-extrabold text-[#001BD2]">
              {formatMoney(promotional)}
            </span>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl px-3 py-2">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 text-sm rounded-xl px-3 py-2">
          {success}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <input
          value={code}
          onChange={(event) => setCode(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void handleRedeem();
          }}
          placeholder="Enter promo code"
          className="flex-1 h-11 px-4 rounded-xl border border-[#C5C5D9]/40 text-sm font-semibold text-[#131B2E] uppercase outline-none focus:border-[#001BD2] focus:ring-2 focus:ring-[#001BD2]/15"
        />
        <button
          type="button"
          onClick={handleRedeem}
          disabled={!code.trim() || submitting}
          className="h-11 px-6 bg-[#001BD2] hover:bg-blue-700 text-white font-bold text-sm rounded-full transition-colors active:scale-[0.98] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {submitting ? "Redeeming…" : "Redeem"}
        </button>
      </div>
    </div>
  );
}
