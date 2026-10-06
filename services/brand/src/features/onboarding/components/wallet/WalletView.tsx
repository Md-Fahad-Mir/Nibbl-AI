"use client";

import { useState } from "react";
import WalletOverview from "./WalletOverview";
import WalletDetails from "./WalletDetails";

export default function WalletView() {
  const [viewModeSetting, setViewModeSetting] = useState<"overview" | "details">("overview");

  return (
    <div className="flex flex-col gap-8 w-full animate-slide-up text-left font-manrope">
      
      {/* Top Navbar Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end w-full gap-4 pb-2">
        <div className="flex flex-col gap-1 text-left">
          <h2 className="text-3xl font-extrabold font-jakarta text-[#131B2E] tracking-tight leading-none">
            Billing & Wallet
          </h2>
          <p className="text-xs text-[#454656] font-medium mt-1">
            Overview of available balance, limits, and transactions history.
          </p>
        </div>
      </div>

      {/* Overview vs Details Sub-navigation Toggles */}
      <div className="bg-[#F2F3FF] p-1 rounded-full flex items-center gap-1 w-fit border border-[#C5C5D9]/5 relative z-10">
        <button
          onClick={() => setViewModeSetting("overview")}
          className={`px-6 py-2 text-xs font-bold rounded-full transition-all border-none cursor-pointer ${
            viewModeSetting === "overview" 
              ? "bg-white text-[#001BD2] shadow-sm" 
              : "text-[#454656] hover:text-slate-700"
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setViewModeSetting("details")}
          className={`px-6 py-2 text-xs font-bold rounded-full transition-all border-none cursor-pointer ${
            viewModeSetting === "details" 
              ? "bg-white text-[#001BD2] shadow-sm" 
              : "text-[#454656] hover:text-slate-700"
          }`}
        >
          Transactions Ledger
        </button>
      </div>

      {/* Render subcomponents */}
      <div className="w-full mt-2 relative">
        {viewModeSetting === "overview" ? (
          <WalletOverview onViewAll={() => setViewModeSetting("details")} />
        ) : (
          <WalletDetails />
        )}
      </div>

    </div>
  );
}
