"use client";

import { useState } from "react";
import { Clock, DollarSign, Shield, Users } from "lucide-react";
import { useBrandApiStore } from "@/stores/useBrandApiStore";
import {
  formatInteger,
  formatMinutes,
  formatMoney,
  formatPercent,
  formatSignedPercent,
  hasBackendValue,
  titleCase,
  toNumber,
} from "../../utils/backendMappers";

export default function AnalyticsRebates() {
  const [page, setPage] = useState(1);
  const campaigns = useBrandApiStore((state) => state.analyticsCampaigns);
  const rebatesSummary = useBrandApiStore((state) => state.analyticsRebatesSummary);
  const summaryCards = [
    {
      title: "Total Cashback",
      val: formatMoney(rebatesSummary?.total_cashback, { compact: true }),
      trend: rebatesSummary?.total_cashback_change_percent,
      icon: <DollarSign className="w-5 h-5 text-[#454656]" />,
      show: hasBackendValue(rebatesSummary?.total_cashback),
    },
    {
      title: "Redemption Rate",
      val: formatPercent(rebatesSummary?.redemption_rate),
      trend: rebatesSummary?.redemption_rate_change_percent,
      icon: <Shield className="w-5 h-5 text-[#454656]" />,
      show: hasBackendValue(rebatesSummary?.redemption_rate),
    },
    {
      title: "Avg. Claim Time",
      val: formatMinutes(rebatesSummary?.avg_claim_time_minutes),
      trend: rebatesSummary?.avg_claim_time_change_percent,
      icon: <Clock className="w-5 h-5 text-[#454656]" />,
      show: hasBackendValue(rebatesSummary?.avg_claim_time_minutes),
    },
    {
      title: "Active Users",
      val: formatInteger(rebatesSummary?.active_users),
      trend: rebatesSummary?.active_users_change_percent,
      icon: <Users className="w-5 h-5 text-[#454656]" />,
      show: hasBackendValue(rebatesSummary?.active_users),
    },
  ].filter((card) => card.show);
  const hasPerformanceChange = hasBackendValue(rebatesSummary?.performance_change_percent);
  const hasBudgetSavings = hasBackendValue(rebatesSummary?.budget_savings);
  const itemsPerPage = 8;
  const totalPages = Math.max(1, Math.ceil(campaigns.length / itemsPerPage));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * itemsPerPage;
  const paginatedCampaigns = campaigns.slice(pageStart, pageStart + itemsPerPage);
  const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1);

  return (
    <div className="flex flex-col gap-8 w-full text-left font-manrope animate-slide-up">
      {(hasPerformanceChange || hasBudgetSavings) && (
        <div className="bg-white border border-[#C5C5D9]/15 rounded-3xl p-6 shadow-sm">
          <p className="text-xs font-bold text-[#454656]/60 uppercase tracking-wider">Last 30 days</p>
          <p className="mt-2 text-sm font-semibold text-[#454656]">
            {hasPerformanceChange && (
              <>
                Performance is{" "}
                <span className={toNumber(rebatesSummary?.performance_change_percent) >= 0 ? "text-[#059669]" : "text-[#BA1A1A]"}>
                  {formatPercent(Math.abs(toNumber(rebatesSummary?.performance_change_percent)))}{" "}
                  {String(rebatesSummary?.performance_change_label || "better")}
                </span>{" "}
                than the previous period.
              </>
            )}
            {hasBudgetSavings && (
              <>
                {" "}Budget savings:{" "}
                <span className="text-[#131B2E]">{formatMoney(rebatesSummary?.budget_savings)}</span>.
              </>
            )}
          </p>
        </div>
      )}

      {summaryCards.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 w-full items-stretch">
          {summaryCards.map((kpi) => (
            <div key={kpi.title} className="bg-white border border-[#C5C5D9]/15 shadow-sm rounded-3xl p-6 flex flex-col justify-between text-left min-h-[154px]">
              <div className="flex justify-between items-start gap-4">
                <div className="w-10 h-10 bg-[#E2E7FF] rounded-2xl flex items-center justify-center flex-shrink-0">{kpi.icon}</div>
                {hasBackendValue(kpi.trend) && (
                  <span className={`${toNumber(kpi.trend) >= 0 ? "text-[#059669] bg-[#ECFDF5]" : "text-[#BA1A1A] bg-[#FEF2F2]"} text-[10px] font-bold px-2 py-0.5 rounded-full`}>
                    {formatSignedPercent(kpi.trend)}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-bold text-[#454656] tracking-[1.2px] uppercase mt-5">{kpi.title}</span>
              <h3 className="font-jakarta font-extrabold text-3xl text-[#131B2E] mt-2 tracking-tight">{kpi.val}</h3>
            </div>
          ))}
        </div>
      )}
      <div className="w-full bg-white border border-slate-100 shadow-sm rounded-3xl overflow-hidden flex flex-col">
        <div className="px-8 py-5 border-b border-[#C5C5D9]/10 bg-white">
          <h3 className="font-jakarta font-bold text-lg text-[#131B2E]">Detailed Campaign Performance</h3>
        </div>
        <div className="w-full overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-[#C5C5D9]/10 bg-[#F2F3FF]">
                <th className="p-5 text-left text-[10px] font-bold tracking-wider text-[#454656] uppercase">Campaign Name</th>
                <th className="p-5 text-left text-[10px] font-bold tracking-wider text-[#454656] uppercase">Status</th>
                <th className="p-5 text-right text-[10px] font-bold tracking-wider text-[#454656] uppercase">Redemptions</th>
                <th className="p-5 text-right text-[10px] font-bold tracking-wider text-[#454656] uppercase">Spend</th>
                <th className="p-5 text-right text-[10px] font-bold tracking-wider text-[#454656] uppercase">Reward Share</th>
                <th className="p-5 text-left text-[10px] font-bold tracking-wider text-[#454656] uppercase">Volume</th>
              </tr>
            </thead>
            <tbody>
              {paginatedCampaigns.map((row) => {
                const status = titleCase(row.status);
                const redemptions = toNumber(row.redemptions);
                const spend = toNumber(row.total_spend);
                const growth = Math.min(100, redemptions * 5);
                return (
                  <tr key={String(row.campaign_id)} className="border-b border-[#C5C5D9]/5 hover:bg-[#F2F3FF]/30 transition-colors text-sm text-[#454656]">
                    <td className="p-5 text-left flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#E2E7FF] flex items-center justify-center text-[#001BD2] text-xs font-bold font-mono">R</div>
                      <span className="font-bold text-[#131B2E]">{String(row.name ?? "Campaign")}</span>
                    </td>
                    <td className="p-5 text-left">
                      <span className={`font-bold text-[10px] px-3 py-1 rounded-full uppercase tracking-wider ${status === "Active" ? "bg-teal-100 text-teal-700" : "bg-amber-100 text-amber-700"}`}>{status}</span>
                    </td>
                    <td className="p-5 text-right font-bold text-[#131B2E]">{formatInteger(redemptions)}</td>
                    <td className="p-5 text-right font-bold text-[#131B2E]">{formatMoney(spend)}</td>
                    <td className="p-5 text-right font-bold text-[#001BD2]">{spend ? `${Math.round((toNumber(row.reward_spend) / spend) * 100)}%` : "0%"}</td>
                    <td className="p-5 text-left">
                      <div className="w-24 h-1.5 bg-[#E2E7FF] rounded-full overflow-hidden relative mt-1.5">
                        <div className="absolute top-0 bottom-0 left-0 bg-[#004956] rounded-full" style={{ width: `${growth}%` }}></div>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {paginatedCampaigns.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-sm font-semibold text-slate-400">
                    No campaign analytics yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-8 py-5 border-t border-[#C5C5D9]/10 bg-[#FAF8FF] flex flex-col sm:flex-row justify-between items-center gap-4 text-xs font-semibold text-[#454656]">
          <span>
            Showing {paginatedCampaigns.length ? pageStart + 1 : 0} -{" "}
            {Math.min(pageStart + paginatedCampaigns.length, campaigns.length)} of{" "}
            {campaigns.length} campaigns
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              disabled={currentPage === 1}
              className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-xs text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              &lt;
            </button>
            {pageNumbers.map((pageNumber) => (
              <button
                key={pageNumber}
                type="button"
                onClick={() => setPage(pageNumber)}
                className={`w-8 h-8 rounded-lg border flex items-center justify-center text-xs font-bold ${
                  currentPage === pageNumber
                    ? "bg-[#001BD2] text-white border-[#001BD2]"
                    : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                }`}
              >
                {pageNumber}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
              disabled={currentPage === totalPages}
              className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-xs text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              &gt;
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
