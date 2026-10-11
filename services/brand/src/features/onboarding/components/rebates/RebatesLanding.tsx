import { useState } from "react";
import { useBrandApiStore } from "@/stores/useBrandApiStore";
import RebatesLandingCard from "./RebatesLandingCard";
import CampaignLimitBanner from "./CampaignLimitBanner";
import {
  formatInteger,
  formatMinutes,
  formatMoney,
  formatPercent,
  formatSignedPercent,
  hasBackendValue,
  toNumber,
} from "../../utils/backendMappers";

interface Campaign {
  id: string;
  name: string;
  category: string;
  scope: string;
  cycleClaims: number;
  capacity: number;
  redemptions: number;
  rewardSpend: number;
  status: "ACTIVE" | "PAUSED" | "COMPLETED" | "IN_REVIEW";
  // Nibbl approval label, e.g. "Pending review" (rebate campaigns).
  reviewLabel?: string;
  // Nibbl comment when changes were requested or the campaign was rejected.
  reviewComment?: string;
}

interface RebatesLandingProps {
  campaigns: Campaign[];
  onCreateNew: () => void;
  onEditCampaign: (camp: Campaign) => void;
  onOpenPlans?: () => void;
}

export default function RebatesLanding({ campaigns, onCreateNew, onEditCampaign, onOpenPlans }: RebatesLandingProps) {
  const [filter, setFilter] = useState<Campaign["status"]>("ACTIVE");
  const rebatesSummary = useBrandApiStore((state) => state.analyticsRebatesSummary);

  const filteredCampaigns = campaigns.filter((camp) => camp.status === filter);
  const performanceChange = rebatesSummary?.performance_change_percent;
  const performanceLabel = String(
    rebatesSummary?.performance_change_label || (toNumber(performanceChange) >= 0 ? "better" : "worse")
  );
  const hasPerformanceChange = hasBackendValue(performanceChange);
  const hasBudgetSavings = hasBackendValue(rebatesSummary?.budget_savings);
  const stats = [
    {
      label: "TOTAL CASHBACK",
      val: formatMoney(rebatesSummary?.total_cashback, { compact: true }),
      trend: rebatesSummary?.total_cashback_change_percent,
      show: hasBackendValue(rebatesSummary?.total_cashback),
    },
    {
      label: "REDEMPTION RATE",
      val: formatPercent(rebatesSummary?.redemption_rate),
      trend: rebatesSummary?.redemption_rate_change_percent,
      show: hasBackendValue(rebatesSummary?.redemption_rate),
    },
    {
      label: "AVG. CLAIM TIME",
      val: formatMinutes(rebatesSummary?.avg_claim_time_minutes),
      trend: rebatesSummary?.avg_claim_time_change_percent,
      show: hasBackendValue(rebatesSummary?.avg_claim_time_minutes),
    },
    {
      label: "ACTIVE USERS",
      val: formatInteger(rebatesSummary?.active_users),
      trend: rebatesSummary?.active_users_change_percent,
      show: hasBackendValue(rebatesSummary?.active_users),
    },
  ].filter((stat) => stat.show);
  const hasSummaryContent = hasPerformanceChange || hasBudgetSavings || stats.length > 0;

  return (
    <div className="flex flex-col gap-10 w-full animate-slide-up">
      {/* Breadcrumbs & Header bar */}
      <div className="flex justify-between items-center w-full">
        <div className="flex flex-col gap-1 text-left">
          <span className="text-xs font-manrope font-semibold text-slate-400">Overview &gt; <span className="text-[#001BD2]">Rebates</span></span>
          <h1 className="text-3xl font-extrabold font-jakarta text-[#131B2E] tracking-tight">Rebates</h1>
        </div>

        {/* Action Button */}
        <button
          onClick={onCreateNew}
          className="px-6 h-[46px] bg-[#001BD2] hover:bg-blue-700 text-white font-bold text-sm rounded-xl transition-all shadow-md active:scale-[0.98] cursor-pointer flex items-center gap-1.5"
        >
          <span>+</span> Create Rebate Campaign
        </button>
      </div>

      <CampaignLimitBanner onOpenPlans={onOpenPlans} />

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 bg-[#FAF8FF] font-manrope self-start">
        {[
          { name: "Running", status: "ACTIVE" as const },
          { name: "In Review", status: "IN_REVIEW" as const },
          { name: "Paused", status: "PAUSED" as const },
          { name: "Completed", status: "COMPLETED" as const },
        ].map((tab) => (
          <button
            key={tab.status}
            onClick={() => setFilter(tab.status)}
            className={`px-6 py-2 rounded-full text-xs font-bold transition-all border cursor-pointer ${
              filter === tab.status
                ? "bg-[#001BD2] border-[#001BD2] text-white shadow-sm"
                : "bg-white border-slate-200 text-[#454656] hover:bg-slate-50"
            }`}
          >
            {tab.name}
          </button>
        ))}
      </div>

      {/* Grid of campaigns */}
      {filteredCampaigns.length === 0 ? (
        <div className="bg-white border border-[#C5C5D9]/10 rounded-[20px] p-12 text-center text-sm font-medium text-slate-400 w-full">
          No rebate campaigns in this state
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 w-full">
          {filteredCampaigns.map((camp) => (
            <RebatesLandingCard key={camp.id} campaign={camp} onEdit={onEditCampaign} />
          ))}
        </div>
      )}

      {hasSummaryContent && (
        <section className="bg-white border border-slate-100 rounded-[20px] p-8 shadow-sm flex flex-col gap-6 w-full text-left">
          <div>
            <h2 className="text-xl font-bold text-[#131B2E]">Rebate Campaign Performance</h2>
            <p className="text-xs text-[#64748B] font-medium leading-normal mt-2.5 max-w-xl">
              Based on the last 30 days compared with the previous 30 days.
            </p>
          </div>

          <div className="flex flex-col lg:flex-row gap-8 justify-between border-t border-slate-100 pt-6 font-manrope">
            {(hasPerformanceChange || hasBudgetSavings) && (
              <p className="text-xs text-[#454656] leading-[1.7] font-medium max-w-sm">
                {hasPerformanceChange && (
                  <>
                    Campaign performance is{" "}
                    <span className={`font-extrabold ${toNumber(performanceChange) >= 0 ? "text-[#059669]" : "text-[#BA1A1A]"}`}>
                      {formatPercent(Math.abs(toNumber(performanceChange)))} {performanceLabel}
                    </span>{" "}
                    than the previous period.
                  </>
                )}
                {hasBudgetSavings && (
                  <>
                    {" "}Budget savings are{" "}
                    <span className="font-bold text-[#131B2E]">{formatMoney(rebatesSummary?.budget_savings)}</span>.
                  </>
                )}
              </p>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
              {stats.map((stat) => (
                <div key={stat.label} className="flex flex-col gap-1.5 min-w-[110px]">
                  <span className="text-[10px] font-bold text-[#454656]/60 uppercase tracking-wider">{stat.label}</span>
                  <span className="text-2xl font-extrabold text-[#131B2E]">{stat.val}</span>
                  {hasBackendValue(stat.trend) && (
                    <span className={`text-[10px] font-bold ${toNumber(stat.trend) >= 0 ? "text-[#059669]" : "text-[#BA1A1A]"}`}>
                      {formatSignedPercent(stat.trend)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
