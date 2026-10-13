"use client";

import { ChevronRight, CircleCheck, CircleX, Clock, Wallet } from "lucide-react";
import { formatMoney } from "../../utils/backendMappers";

interface RedemptionsStatsProps {
  pending: number;
  approved: number;
  rejected: number;
  totalPaid: number;
  onOpenPending: () => void;
}

/** Master Redemptions ① Page Summary. */
export default function RedemptionsStats({ pending, approved, rejected, totalPaid, onOpenPending }: RedemptionsStatsProps) {
  const tile = "flex items-center gap-4 px-5 py-4";
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 bg-white border border-[#EAEDFF] rounded-2xl p-3 font-manrope">
      <button
        type="button"
        onClick={onOpenPending}
        className={`${tile} text-left rounded-xl border border-[#001BD2]/40 bg-[#F7F8FF] cursor-pointer`}
      >
        <Clock className="w-8 h-8 text-[#001BD2] flex-shrink-0" />
        <span className="flex-1 flex flex-col">
          <span className="text-sm font-semibold text-[#001BD2]">Pending Manual Review</span>
          <span className="text-2xl font-extrabold text-[#131B2E]">{pending}</span>
          <span className="text-[11px] text-[#64748B]">Auto-approves 7 days after submission if no decision.</span>
        </span>
        <ChevronRight className="w-5 h-5 text-[#001BD2]" />
      </button>
      <div className={tile}>
        <span className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center">
          <CircleCheck className="w-6 h-6 text-emerald-600" />
        </span>
        <span className="flex flex-col">
          <span className="text-sm text-[#454656]">Approved</span>
          <span className="text-2xl font-extrabold text-[#131B2E]">{approved}</span>
        </span>
      </div>
      <div className={tile}>
        <span className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
          <CircleX className="w-6 h-6 text-red-600" />
        </span>
        <span className="flex flex-col">
          <span className="text-sm text-[#454656]">Rejected</span>
          <span className="text-2xl font-extrabold text-[#131B2E]">{rejected}</span>
        </span>
      </div>
      <div className={tile}>
        <span className="w-12 h-12 rounded-full bg-[#E2E7FF] flex items-center justify-center">
          <Wallet className="w-6 h-6 text-[#001BD2]" />
        </span>
        <span className="flex flex-col">
          <span className="text-sm text-[#454656]">Total Paid</span>
          <span className="text-2xl font-extrabold text-[#131B2E]">{formatMoney(totalPaid)}</span>
        </span>
      </div>
    </div>
  );
}
