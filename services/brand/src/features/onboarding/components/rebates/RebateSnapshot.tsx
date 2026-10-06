/* eslint-disable @next/next/no-img-element */
"use client";

import { useBrandApiStore } from "@/stores/useBrandApiStore";
import {
  formatInteger,
  formatMinutes,
  formatMoney,
  formatPercent,
  formatSignedPercent,
  hasBackendValue,
  toNumber,
} from "../../utils/backendMappers";

export default function RebateSnapshot() {
  const rebatesSummary = useBrandApiStore((state) => state.analyticsRebatesSummary);
  const cards = [
    {
      title: "TOTAL CASHBACK",
      value: formatMoney(rebatesSummary?.total_cashback, { compact: true }),
      trend: rebatesSummary?.total_cashback_change_percent,
      icon: "/Dashboard/RebateSpend.svg",
      alt: "Total Cashback",
      tone: "bg-[#D3E4FE]",
      show: hasBackendValue(rebatesSummary?.total_cashback),
    },
    {
      title: "REDEMPTION RATE",
      value: formatPercent(rebatesSummary?.redemption_rate),
      trend: rebatesSummary?.redemption_rate_change_percent,
      icon: "/Dashboard/verfiedPurchase.svg",
      alt: "Redemption Rate",
      tone: "bg-[#DFE0FF]",
      show: hasBackendValue(rebatesSummary?.redemption_rate),
    },
    {
      title: "AVG. CLAIM TIME",
      value: formatMinutes(rebatesSummary?.avg_claim_time_minutes),
      trend: rebatesSummary?.avg_claim_time_change_percent,
      icon: "/Dashboard/costperPurchase.svg",
      alt: "Average Claim Time",
      tone: "bg-[#ACEDFF]",
      show: hasBackendValue(rebatesSummary?.avg_claim_time_minutes),
    },
    {
      title: "ACTIVE USERS",
      value: formatInteger(rebatesSummary?.active_users),
      trend: rebatesSummary?.active_users_change_percent,
      icon: "/Dashboard/avarageRebatePaid.svg",
      alt: "Active Users",
      tone: "bg-[#E2E7FF]",
      show: hasBackendValue(rebatesSummary?.active_users),
    },
  ].filter((card) => card.show);

  if (cards.length === 0) return null;

  return (
    <section className="flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <h2 className="text-sm font-jakarta font-extrabold text-[#454656] opacity-70 tracking-widest uppercase">
          REBATE SNAPSHOT
        </h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
        {cards.map((card) => (
          <div
            key={card.title}
            className="bg-white border border-[#C5C5D9]/10 rounded-[20px] p-6 flex flex-col justify-between h-[198px] font-jakarta shadow-sm"
          >
            <div className="flex justify-between items-start">
              <div className={`w-9 h-9 ${card.tone} rounded-2xl flex items-center justify-center`}>
                <img src={card.icon} alt={card.alt} className="w-5 h-5 object-contain" />
              </div>
              {hasBackendValue(card.trend) && (
                <span
                  className={`${
                    toNumber(card.trend) >= 0
                      ? "bg-[#ECFDF5] text-[#059669]"
                      : "bg-[#FEF2F2] text-[#DC2626]"
                  } text-[10px] font-bold px-2 py-0.5 rounded-full`}
                >
                  {formatSignedPercent(card.trend)}
                </span>
              )}
            </div>

            <div className="flex flex-col gap-1 mt-4">
              <span className="text-[12px] font-semibold text-[#454656] tracking-wider uppercase font-manrope">
                {card.title}
              </span>
              <span className="text-[30px] font-extrabold text-[#131B2E]">
                {card.value}
              </span>
            </div>

            <span className="text-[10px] font-manrope font-semibold text-[#454656]/60 uppercase tracking-wider">
              Last 30 days
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
