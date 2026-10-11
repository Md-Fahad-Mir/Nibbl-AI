"use client";

import { useEffect, useState } from "react";
import { ApiRecord, apiClient, backendApi } from "@/lib/api/backendApi";
import { useBrandApiStore } from "@/stores/useBrandApiStore";
import { formatMoney } from "../../utils/backendMappers";

const PERIODS = [
  { days: 7, label: "Last 7 days" },
  { days: 30, label: "Last 30 days" },
  { days: 90, label: "Last 90 days" },
];
const isoDay = (date: Date) => date.toISOString().slice(0, 10);

const Row = ({ label, value, strong }: { label: string; value: unknown; strong?: boolean }) => (
  <div className={`flex justify-between text-sm ${strong ? "font-extrabold text-[#131B2E] border-t border-[#F1F2FA] pt-2" : "text-[#454656]"}`}>
    <span>{label}</span>
    <span>{formatMoney(value)}</span>
  </div>
);

/** Master Wallet §2 Campaign Funding and §4 Spending Overview. */
export default function FundingAndSpending() {
  const brandId = useBrandApiStore((s) => s.selectedBrandId);
  const [days, setDays] = useState(30);
  const [data, setData] = useState<ApiRecord | null>(null);

  useEffect(() => {
    if (!brandId) return;
    let live = true;
    const to = new Date();
    const from = new Date(to.getTime() - (days - 1) * 86400000);
    apiClient
      .request<ApiRecord>(backendApi.brand.walletFunding(brandId), { query: { from: isoDay(from), to: isoDay(to) } })
      .then((result) => live && setData(result))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [brandId, days]);

  if (!data) return null;
  const funding = (data.funding ?? {}) as ApiRecord;
  const spending = (data.spending ?? {}) as ApiRecord;
  const funded = Boolean(funding.all_funded);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full font-manrope">
      <section className="bg-white border border-[#C5C5D9]/10 shadow-sm rounded-[24px] p-6 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="font-jakarta font-bold text-base text-[#131B2E]">Campaign Funding</h3>
          <span className={`text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full ${
            funded ? "bg-emerald-50 text-[#15803D]" : "bg-amber-50 text-amber-700"
          }`}>
            {funded ? "All campaigns funded" : `Short ${formatMoney(funding.shortfall)}`}
          </span>
        </div>
        <p className="text-xs text-[#454656]">
          The most your active campaigns could need over the next 7 days, compared with Available Funds. Campaigns keep
          running until Available Funds reach $0.
        </p>
        <Row label="Rebate campaigns (7 days)" value={funding.rebate_need} />
        <Row label="Review campaigns (7 days)" value={funding.review_need} />
        <Row label="Estimated 7-day need" value={funding.seven_day_need} strong />
        <Row label="Available Funds" value={funding.available} />
      </section>

      <section className="bg-white border border-[#C5C5D9]/10 shadow-sm rounded-[24px] p-6 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="font-jakarta font-bold text-base text-[#131B2E]">Spending Overview</h3>
          <select value={days} onChange={(e) => setDays(Number(e.target.value))}
            className="bg-[#F2F3FF] rounded-full px-3 py-1.5 text-xs font-bold text-[#131B2E] outline-none cursor-pointer">
            {PERIODS.map((p) => <option key={p.days} value={p.days}>{p.label}</option>)}
          </select>
        </div>
        <Row label="Rebate rewards" value={spending.rebate_rewards} />
        <Row label="Review rewards" value={spending.review_rewards} />
        <Row label="Transaction fees" value={spending.fees} />
        <Row label="Plan charges" value={spending.plan_charges} />
        <Row label="Promotional credits applied" value={`-${String(spending.credits_applied ?? "0")}`} />
        <Row label="Total cash spent" value={spending.total_cash_spent} strong />
        <p className="text-[11px] text-[#94A3B8]">Cash cost after promotional credits. Deposits and refunds aren&apos;t spending.</p>
      </section>
    </div>
  );
}
