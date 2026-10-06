"use client";

import { useBrandApiStore } from "@/stores/useBrandApiStore";
import { formatDate, formatMoney, toNumber } from "../../utils/backendMappers";

export default function AnalyticsOverview() {
  const analyticsOverview = useBrandApiStore((state) => state.analyticsOverview);
  const redemptions = useBrandApiStore((state) => state.redemptions).slice(0, 5);
  const spend = (analyticsOverview?.spend || {}) as Record<string, unknown>;
  const approvals = toNumber(analyticsOverview?.approvals);
  const reservations = toNumber(analyticsOverview?.reservations);
  const redemptionsCount = toNumber(analyticsOverview?.redemptions);
  const totalSpend = toNumber(spend.total);
  const acquisitionCost = approvals ? totalSpend / approvals : 0;
  const claimRate = reservations ? (approvals / reservations) * 100 : 0;
  const redemptionRate = approvals ? (redemptionsCount / approvals) * 100 : 0;

  return (
    <div className="flex flex-col gap-8 w-full text-left font-manrope animate-slide-up">
      
      {/* KPI Cards Bento Layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full items-stretch">
        
        {/* Cost per Acquisition */}
        <div className="bg-white border border-[#C5C5D9]/15 shadow-[0px_24px_48px_rgba(19,27,46,0.04)] rounded-2xl p-6 flex flex-col text-left justify-between min-h-[125px]">
          <span className="text-[11px] font-bold text-[#454656] tracking-[0.55px] uppercase">Cost Per Acquisition</span>
          <h3 className="font-jakarta font-extrabold text-3xl text-[#131B2E] mt-3 tracking-tight">{formatMoney(acquisitionCost)}</h3>
        </div>

        {/* Claim Rate (With Blue Border accent on top) */}
        <div className="bg-white border-t-4 border-t-[#001BD2] border-x border-b border-[#C5C5D9]/15 shadow-[0px_24px_48px_rgba(19,27,46,0.04)] rounded-2xl p-6 flex flex-col text-left justify-between min-h-[125px]">
          <span className="text-[11px] font-bold text-[#454656] tracking-[0.55px] uppercase">Claim Rate</span>
          <h3 className="font-jakarta font-extrabold text-3xl text-[#131B2E] mt-3 tracking-tight">{claimRate.toFixed(1)}%</h3>
        </div>

        {/* Redemption Rate */}
        <div className="bg-white border border-[#C5C5D9]/15 shadow-[0px_24px_48px_rgba(19,27,46,0.04)] rounded-2xl p-6 flex flex-col text-left justify-between min-h-[125px]">
          <span className="text-[11px] font-bold text-[#454656] tracking-[0.55px] uppercase">Redemption Rate</span>
          <h3 className="font-jakarta font-extrabold text-3xl text-[#131B2E] mt-3 tracking-tight">{redemptionRate.toFixed(1)}%</h3>
        </div>

      </div>

      {/* Recent Transaction Flow Card */}
      <div className="w-full bg-white border border-slate-100 shadow-[0px_32px_64px_rgba(19,27,46,0.03)] rounded-2xl overflow-hidden flex flex-col">
        <div className="bg-[#F2F3FF] px-8 py-5 border-b border-[#C5C5D9]/10">
          <h3 className="font-jakarta font-bold text-lg text-[#131B2E]">Recent Transaction Flow</h3>
        </div>
        <div className="w-full overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-[#C5C5D9]/10 bg-[#FAF8FF]">
                <th className="p-5 text-left text-[10px] font-bold tracking-wider text-[#454656] uppercase">Customer</th>
                <th className="p-5 text-left text-[10px] font-bold tracking-wider text-[#454656] uppercase">Campaign</th>
                <th className="p-5 text-left text-[10px] font-bold tracking-wider text-[#454656] uppercase">Redemption Date</th>
                <th className="p-5 text-left text-[10px] font-bold tracking-wider text-[#454656] uppercase">Amount</th>
                <th className="p-5 text-left text-[10px] font-bold tracking-wider text-[#454656] uppercase">Status</th>
              </tr>
            </thead>
            <tbody>
              {redemptions.map((row, i) => (
                <tr key={i} className="border-b border-[#C5C5D9]/10 hover:bg-[#F2F3FF]/30 transition-colors text-sm text-[#454656] font-manrope">
                  <td className="p-5 text-left flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#D0E1FB] text-[#001BD2] font-bold text-xs flex items-center justify-center">C</div>
                    <span className="font-bold text-[#131B2E]">{String(row.user_email ?? "Customer")}</span>
                  </td>
                  <td className="p-5 text-left font-medium">{String(row.campaign_name ?? "Campaign")}</td>
                  <td className="p-5 text-left font-medium">{formatDate(row.issued_at ?? row.created_at)}</td>
                  <td className="p-5 text-left font-bold text-[#131B2E]">{formatMoney(row.reward_amount)}</td>
                  <td className="p-5 text-left">
                    <span className="font-bold text-[10px] px-3 py-1 rounded-full uppercase tracking-wider bg-blue-100 text-blue-700">
                      {String(row.status ?? "processed")}
                    </span>
                  </td>
                </tr>
              ))}
              {redemptions.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-10 text-center text-sm font-semibold text-slate-400">
                    No recent redemption flow yet.
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
