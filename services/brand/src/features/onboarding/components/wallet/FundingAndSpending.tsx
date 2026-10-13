"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Gift,
  Info,
  Lock,
  type LucideIcon,
  MessageSquareText,
  Star,
  Coins,
  Crown,
} from "lucide-react";
import { ApiRecord, apiClient, backendApi } from "@/lib/api/backendApi";
import { useBrandApiStore } from "@/stores/useBrandApiStore";
import { formatMoney, toNumber } from "../../utils/backendMappers";

const PERIODS = [
  { days: 7, label: "Last 7 Days" },
  { days: 30, label: "Last 30 Days" },
  { days: 90, label: "Last 90 Days" },
];
const isoDay = (date: Date) => date.toISOString().slice(0, 10);

/** Wallet funding + spending for the last `days` days (Master Wallet §2, §4). */
const useFunding = (days: number) => {
  const brandId = useBrandApiStore((s) => s.selectedBrandId);
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
  return data;
};

export const SectionTitle = ({ title, right }: { title: string; right?: React.ReactNode }) => (
  <div className="flex flex-wrap items-center justify-between gap-3">
    <h3 className="font-jakarta font-bold text-xl text-[#001BD2]">{title}</h3>
    {right}
  </div>
);

const Help = ({ text }: { text: string }) => (
  <span title={text} className="cursor-help">
    <Info className="w-3.5 h-3.5 text-[#94A3B8]" />
  </span>
);

/** Master Wallet §2 Campaign Funding: 7-day need vs Available Funds. */
export function CampaignFunding() {
  const data = useFunding(30);
  const wallet = useBrandApiStore((s) => s.wallet);
  if (!data) return null;
  const funding = (data.funding ?? {}) as ApiRecord;
  const need = toNumber(funding.seven_day_need);
  const available = toNumber(funding.available);
  const funded = Boolean(funding.all_funded);
  const percent = need > 0 ? Math.round((available / need) * 100) : 100;

  return (
    <section className="bg-white border border-[#EAEDFF] rounded-2xl p-6 flex flex-col gap-4 font-manrope">
      <SectionTitle title="Campaign Funding" />
      <div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-4">
        <div className="border border-[#EAEDFF] rounded-xl p-4 flex flex-col gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1">
              <span className="flex items-center gap-1 text-xs text-[#454656]">
                Estimated 7-Day Requirement <Help text="The most all active campaigns could need over the next 7 days." />
              </span>
              <span className="text-2xl font-extrabold text-[#131B2E]">{formatMoney(need)}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="flex items-center gap-1 text-xs text-[#454656]">
                Current Available Funds <Help text="Funds free for new rebate claims and review opportunities." />
              </span>
              <span className="text-2xl font-extrabold text-[#131B2E]">{formatMoney(available)}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-[#454656]">Funding Status</span>
              <span
                className={`self-start text-sm font-bold px-3 py-1 rounded-full flex items-center gap-1.5 ${
                  funded ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                }`}
              >
                {funded ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                {funded ? "Fully Funded" : `Short ${formatMoney(funding.shortfall)}`}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex-1 h-2.5 bg-[#EAEDFF] rounded-full overflow-hidden">
              <span
                className={`block h-full rounded-full ${funded ? "bg-emerald-500" : "bg-amber-500"}`}
                style={{ width: `${Math.min(100, percent)}%` }}
              />
            </span>
            <span className="text-sm font-bold text-[#131B2E] whitespace-nowrap">{percent}% funded</span>
          </div>
          <p className="text-[11px] text-[#64748B]">
            Campaigns continue using available funds. New claims and review opportunities pause only if Available Funds
            reach $0.
          </p>
        </div>
        <div className="border border-[#EAEDFF] rounded-xl p-4 flex flex-col gap-3 text-sm">
          <span
            className={`self-start text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5 ${
              funded ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${funded ? "bg-emerald-500" : "bg-amber-500"}`} />
            {funded ? "All campaigns active" : "Running on available funds"}
          </span>
          <div className="flex items-center gap-2 text-[#454656]">
            <Lock className="w-4 h-4" />
            <span className="flex-1">Outstanding rebate claims</span>
            <b className="text-[#131B2E]">{formatMoney(wallet?.reserved_rebates)}</b>
            <span className="text-xs">reserved</span>
          </div>
          <div className="flex items-center gap-2 text-[#454656]">
            <Star className="w-4 h-4" />
            <span className="flex-1">Active review opportunities</span>
            <b className="text-[#131B2E]">{formatMoney(wallet?.reserved_reviews)}</b>
            <span className="text-xs">reserved</span>
          </div>
        </div>
      </div>
    </section>
  );
}

const SpendTile = ({ Icon, label, value }: { Icon: LucideIcon; label: string; value: string }) => (
  <div className="border border-[#EAEDFF] rounded-xl p-4 flex items-center gap-3">
    <span className="w-10 h-10 rounded-full bg-[#EEF0FF] text-[#001BD2] flex items-center justify-center flex-shrink-0">
      <Icon className="w-5 h-5" />
    </span>
    <span className="flex flex-col">
      <span className="text-xs text-[#454656]">{label}</span>
      <span className="text-lg font-extrabold text-[#131B2E]">{value}</span>
    </span>
  </div>
);

/** Master Wallet §4 Spending Overview for the selected period. */
export function SpendingOverview() {
  const [days, setDays] = useState(30);
  const data = useFunding(days);
  if (!data) return null;
  const spending = (data.spending ?? {}) as ApiRecord;

  return (
    <section className="bg-white border border-[#EAEDFF] rounded-2xl p-6 flex flex-col gap-4 font-manrope">
      <SectionTitle
        title="Spending Overview"
        right={
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="h-9 bg-white border border-[#C5C5D9]/40 rounded-lg px-3 text-xs font-bold text-[#131B2E] outline-none cursor-pointer"
          >
            {PERIODS.map((p) => <option key={p.days} value={p.days}>{p.label}</option>)}
          </select>
        }
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
        <SpendTile Icon={Gift} label="Rebate Rewards" value={formatMoney(spending.rebate_rewards)} />
        <SpendTile Icon={MessageSquareText} label="Review Rewards" value={formatMoney(spending.review_rewards)} />
        <SpendTile Icon={Coins} label="Transaction Fees" value={formatMoney(spending.fees)} />
        <SpendTile Icon={FileText} label="Plan Charges" value={formatMoney(spending.plan_charges)} />
        <SpendTile Icon={Crown} label="Promotional Credits Applied" value={`-${formatMoney(spending.credits_applied)}`} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#F2F3FF] px-5 py-4">
        <span className="flex items-baseline gap-3">
          <span className="text-base font-bold text-[#131B2E]">Total Cash Spent:</span>
          <span className="text-3xl font-extrabold text-[#001BD2]">{formatMoney(spending.total_cash_spent)}</span>
        </span>
        <span className="flex items-center gap-1.5 text-xs text-[#64748B]">
          <Info className="w-4 h-4" /> Cash spent after promotional credits. Deposits and refunds are not counted as
          spending.
        </span>
      </div>
    </section>
  );
}
