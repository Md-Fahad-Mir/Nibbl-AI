"use client";

import { useState } from "react";
import { Info, X } from "lucide-react";
import WalletOverview from "./WalletOverview";
import WeeklyStatements from "./WeeklyStatements";
import { CampaignFunding, SpendingOverview } from "./FundingAndSpending";
import AutoRefillCard from "./AutoRefillCard";
import RedeemPromoCard from "./RedeemPromoCard";
import FundWalletModal from "./FundWalletModal";
import { ApiRecord } from "@/lib/api/backendApi";
import { RefundRequestList, RequestRefundModal, useRefunds } from "./RefundRequests";

/** Master Wallet: Balances, Campaign Funding, Automatic Refill, Spending
 *  Overview and Weekly Statements (individual transactions are in the
 *  detailed ledger download). */
export default function WalletView() {
  const [refunding, setRefunding] = useState(false);
  const [askAmount, setAskAmount] = useState(false);
  const [amount, setAmount] = useState("250");
  const [amountError, setAmountError] = useState("");
  const [payAmount, setPayAmount] = useState<string | null>(null);
  const refunds = useRefunds();
  const refundRequests = (Array.isArray(refunds.data?.requests) ? refunds.data.requests : []) as ApiRecord[];

  const continueToPayment = () => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setAmountError("Enter an amount greater than zero.");
      return;
    }
    setAmountError("");
    setAskAmount(false);
    setPayAmount(value.toFixed(2));
  };

  return (
    <div className="flex flex-col gap-6 w-full animate-slide-up text-left font-manrope">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end w-full gap-4">
        <div className="flex flex-col gap-1 text-left">
          <h2 className="text-3xl font-extrabold font-jakarta text-[#131B2E] tracking-tight leading-none">Wallet</h2>
          <p className="text-sm text-[#454656] font-medium mt-1">
            Fund campaigns, manage automatic refills, and review every charge.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setRefunding(true)}
            disabled={!refunds.data}
            className="h-11 px-5 rounded-xl border border-[#001BD2] text-[#001BD2] bg-white text-sm font-bold disabled:opacity-50 cursor-pointer"
          >
            Request Refund
          </button>
          <button
            onClick={() => setAskAmount(true)}
            className="h-11 px-6 rounded-xl bg-[#001BD2] text-white text-sm font-bold cursor-pointer"
          >
            Add Funds
          </button>
        </div>
      </div>

      <WalletOverview />
      <CampaignFunding />
      <AutoRefillCard />
      <SpendingOverview />
      <WeeklyStatements />
      <RedeemPromoCard />
      <RefundRequestList requests={refundRequests} />
      <p className="flex items-center gap-2 text-xs text-[#64748B]">
        <Info className="w-4 h-4 text-[#001BD2]" />
        Available Funds are refundable. Reserved Funds and Promotional Credits are non-refundable.
      </p>

      {askAmount && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setAskAmount(false)}>
          <div className="w-full max-w-sm bg-white rounded-2xl p-6 flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-jakarta font-bold text-lg text-[#131B2E]">Add Funds</h3>
              <button onClick={() => setAskAmount(false)} aria-label="Close" className="text-[#94A3B8] cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <label className="flex flex-col gap-1 text-xs font-semibold text-[#454656]">
              Amount
              <span className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-[#454656]">$</span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  autoFocus
                  onChange={(e) => setAmount(e.target.value)}
                  className="h-11 w-full rounded-xl border border-[#C5C5D9]/60 pl-7 pr-3 text-sm font-bold text-[#131B2E] outline-none focus:border-[#001BD2]"
                />
              </span>
            </label>
            {amountError && <p className="text-xs font-semibold text-red-600">{amountError}</p>}
            <button onClick={continueToPayment} className="h-11 rounded-xl bg-[#001BD2] text-white text-sm font-bold cursor-pointer">
              Continue to payment
            </button>
          </div>
        </div>
      )}

      {payAmount && <FundWalletModal amount={payAmount} onClose={() => setPayAmount(null)} />}

      {refunding && refunds.data && (
        <RequestRefundModal
          refundable={String(refunds.data.refundable ?? "0")}
          onClose={() => setRefunding(false)}
          onDone={(data) => {
            refunds.setData(data);
            setRefunding(false);
          }}
        />
      )}
    </div>
  );
}
