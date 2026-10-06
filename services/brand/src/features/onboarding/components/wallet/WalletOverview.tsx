"use client";

import { useState } from "react";
import { useBrandApiStore } from "@/stores/useBrandApiStore";
import { formatDate, formatMoney, titleCase, toNumber } from "../../utils/backendMappers";

interface WalletOverviewProps {
  onViewAll: () => void;
}

export default function WalletOverview({ onViewAll }: WalletOverviewProps) {
  const wallet = useBrandApiStore((state) => state.wallet);
  const transactions = useBrandApiStore((state) => state.walletTransactions).slice(0, 5);
  const fundWallet = useBrandApiStore((state) => state.fundWallet);
  const [fundAmount, setFundAmount] = useState("250");
  const [isFunding, setIsFunding] = useState(false);
  const [fundError, setFundError] = useState("");
  const available = wallet?.available ?? wallet?.balance ?? 0;
  const held = toNumber(wallet?.held);
  const balance = toNumber(wallet?.balance);
  const usagePercent = balance > 0 ? Math.min(100, Math.round((held / balance) * 100)) : 0;

  const handleFundWallet = async () => {
    const amount = Number(fundAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setFundError("Enter a funding amount greater than zero.");
      return;
    }
    setIsFunding(true);
    setFundError("");
    try {
      const key =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      await fundWallet(amount.toFixed(2), key);
    } catch (error) {
      setFundError(error instanceof Error ? error.message : "Could not fund wallet.");
    } finally {
      setIsFunding(false);
    }
  };

  return (
    <div className="flex flex-col gap-8 w-full text-left font-manrope">
      
      {/* Balance & Usage Cards Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 w-full items-stretch">
        
        {/* Available Balance Hero Card */}
        <div className="lg:col-span-2 bg-gradient-to-br from-[#001BD2] to-[#2D3FEA] text-white rounded-[32px] p-10 shadow-[0px_25px_50px_-12px_rgba(0,27,210,0.2)] relative overflow-hidden flex flex-col justify-between min-h-[268px]">
          <div className="absolute -right-10 -top-10 w-64 h-64 bg-white/10 rounded-full filter blur-xl"></div>
          
          <div className="flex flex-col gap-2 text-left z-10 relative">
            <span className="text-sm font-semibold tracking-[0.7px] text-[#CACDFF] uppercase">Available Balance</span>
            <h2 className="text-5xl md:text-6xl font-extrabold tracking-tighter text-white mt-1">{formatMoney(available)}</h2>
          </div>

          <div className="flex flex-col items-end self-end text-right opacity-60 z-10 relative mt-4">
            <span className="text-[10px] font-medium tracking-[2.4px] text-white uppercase">Sovereign ID</span>
            <span className="font-mono text-sm tracking-widest text-white mt-1">**** {String(wallet?.id ?? "0000").slice(0, 4)}</span>
          </div>

          <div className="z-10 relative mt-6 flex flex-col sm:flex-row gap-3 sm:items-center">
            <div className="relative w-full sm:w-44">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-white/70">$</span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={fundAmount}
                onChange={(event) => setFundAmount(event.target.value)}
                className="h-11 w-full rounded-xl border border-white/20 bg-white/10 pl-8 pr-3 text-sm font-extrabold text-white outline-none placeholder:text-white/40 focus:border-white/60"
              />
            </div>
            <button
              type="button"
              onClick={handleFundWallet}
              disabled={isFunding}
              className="h-11 rounded-xl bg-white px-5 text-sm font-extrabold text-[#001BD2] transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isFunding ? "Funding..." : "Add Funds"}
            </button>
          </div>
          {fundError && <p className="z-10 relative mt-3 text-xs font-bold text-red-100">{fundError}</p>}
        </div>

        {/* Usage This Month Card */}
        <div className="bg-white border border-[#C5C5D9]/10 shadow-[0px_1px_2px_rgba(0,0,0,0.05)] rounded-[32px] p-8 flex flex-col justify-between min-h-[268px]">
          <div className="flex justify-between items-start gap-4">
            <div className="flex flex-col text-left">
              <span className="font-bold text-[#131B2E] text-lg">Usage This Month</span>
              <span className="text-xs text-[#454656] font-medium mt-1">Current wallet position</span>
            </div>
            <span className="text-xl font-bold text-[#001BD2]">{formatMoney(held)}</span>
          </div>

          <div className="flex flex-col gap-3 mt-4">
            <div className="flex justify-between items-center text-xs font-semibold text-[#454656]">
              <span>Spending Limit</span>
              <span className="text-[#131B2E] font-bold">{formatMoney(balance)}</span>
            </div>
            <div className="w-full h-3 bg-[#E2E7FF] rounded-full overflow-hidden relative">
              <div className="absolute top-0 bottom-0 left-0 bg-[#001BD2] rounded-full" style={{ width: `${usagePercent}%` }}></div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="bg-[#F2F3FF] p-4 rounded-2xl flex flex-col text-left gap-1">
              <span className="text-[10px] font-bold text-[#454656]/80 uppercase">Held Funds</span>
              <span className="text-lg font-bold text-[#131B2E]">{formatMoney(held)}</span>
            </div>
            <div className="bg-[#F2F3FF] p-4 rounded-2xl flex flex-col text-left gap-1">
              <span className="text-[10px] font-bold text-[#454656]/80 uppercase">Currency</span>
              <span className="text-lg font-bold text-[#131B2E]">{String(wallet?.currency ?? "USD")}</span>
            </div>
          </div>
        </div>

      </div>

      {/* Transaction History Section */}
      <div className="w-full bg-white border border-[#C5C5D9]/10 shadow-[0px_1px_2px_rgba(0,0,0,0.05)] rounded-[32px] overflow-hidden flex flex-col">
        <div className="px-8 py-6 flex justify-between items-center border-b border-[#C5C5D9]/5 bg-white">
          <h3 className="font-jakarta font-bold text-lg text-[#131B2E]">Transaction History</h3>
          <button onClick={onViewAll} className="bg-transparent border-none text-sm font-bold text-[#001BD2] hover:underline cursor-pointer">View All</button>
        </div>
        <div className="w-full overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-[#C5C5D9]/10 bg-[#FAF8FF]">
                <th className="p-5 text-left text-[11px] font-bold tracking-wider text-[#454656] uppercase">Date</th>
                <th className="p-5 text-left text-[11px] font-bold tracking-wider text-[#454656] uppercase">Description</th>
                <th className="p-5 text-left text-[11px] font-bold tracking-wider text-[#454656] uppercase">Amount</th>
                <th className="p-5 text-left text-[11px] font-bold tracking-wider text-[#454656] uppercase">Status</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx, i) => {
                const signed = toNumber(tx.signed_amount ?? tx.amount);
                return (
                <tr key={i} className="border-b border-[#C5C5D9]/10 hover:bg-[#F2F3FF]/20 text-sm text-[#454656] transition-colors">
                  <td className="p-5 text-left font-medium">{formatDate(tx.created_at)}</td>
                  <td className="p-5 text-left font-bold text-[#131B2E]">{String(tx.description ?? tx.category ?? tx.entry_type ?? "Ledger entry")}</td>
                  <td className={`p-5 text-left font-bold ${signed >= 0 ? "text-emerald-600" : "text-[#131B2E]"}`}>{formatMoney(signed)}</td>
                  <td className="p-5 text-left">
                    <span className="font-bold text-[10px] px-3 py-1 rounded-full uppercase tracking-wider bg-emerald-100 text-emerald-700">
                      {titleCase(tx.entry_type ?? "Completed")}
                    </span>
                  </td>
                </tr>
              )})}
              {transactions.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-sm font-semibold text-slate-400">
                    No wallet transactions yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
