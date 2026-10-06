/* eslint-disable @next/next/no-img-element */
"use client";

import { useBrandApiStore } from "@/stores/useBrandApiStore";
import { formatMoney, toNumber } from "../../utils/backendMappers";

export default function RedemptionsStats() {
  const redemptions = useBrandApiStore((state) => state.redemptions);
  const reviewQueue = useBrandApiStore((state) => state.reviewQueue);
  const totalPaid = redemptions.reduce(
    (sum, redemption) => sum + toNumber(redemption.reward_amount),
    0
  );

  return (
    <div className="flex flex-row items-start gap-4 flex-wrap">
      
      {/* Stat 1: Avg Response */}
      <div className="bg-white shadow-[0px_1px_2px_rgba(0,0,0,0.05)] border border-[#C5C5D9]/10 rounded-xl p-4 flex flex-row items-center gap-4 w-[184px] h-[76px] flex-shrink-0 text-left font-manrope">
        <div className="w-10 h-10 bg-[#004956]/10 rounded-full flex items-center justify-center flex-shrink-0">
          <img src="/redemption/AvarageResponse.svg" alt="Avg Response" className="w-[18px] h-[21px] object-contain" />
        </div>
        <div className="flex flex-col justify-center">
          <span className="text-[10px] font-extrabold text-[#454656] tracking-[0.6px] uppercase leading-none">
            Manual Queue
          </span>
          <span className="text-lg font-bold font-jakarta text-[#131B2E] mt-1 leading-none">
            {reviewQueue.length}
          </span>
        </div>
      </div>

      {/* Stat 2: Total Paid */}
      <div className="bg-white shadow-[0px_1px_2px_rgba(0,0,0,0.05)] border border-[#C5C5D9]/10 rounded-xl p-4 flex flex-row items-center gap-4 w-[160px] h-[76px] flex-shrink-0 text-left font-manrope">
        <div className="w-10 h-10 bg-[#001BD2]/10 rounded-full flex items-center justify-center flex-shrink-0">
          <img src="/redemption/TotalPaid.svg" alt="Total Paid" className="w-[19px] h-[18px] object-contain" style={{ filter: "invert(13%) sepia(95%) saturate(5437%) hue-rotate(234deg) brightness(85%) contrast(145%)" }} />
        </div>
        <div className="flex flex-col justify-center">
          <span className="text-[10px] font-extrabold text-[#454656] tracking-[0.6px] uppercase leading-none">
            Total Paid
          </span>
          <span className="text-lg font-bold font-jakarta text-[#131B2E] mt-1 leading-none">
            {formatMoney(totalPaid)}
          </span>
        </div>
      </div>

    </div>
  );
}
