"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiRecord, nibblApi } from "@/lib/api/backendApi";

const RANGES = [
  { days: 7, label: "Last 7 days" },
  { days: 30, label: "Last 30 days" },
  { days: 90, label: "Last 90 days" },
  { days: 365, label: "Last 12 months" },
];

const isoDay = (date: Date) => date.toISOString().slice(0, 10);
const money = (value: unknown) =>
  `$${Number(value ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const Tile = ({ label, value, sub, strong }: { label: string; value: string; sub?: string; strong?: boolean }) => (
  <div className={`rounded-2xl border p-5 flex flex-col gap-1 ${strong ? "bg-[#3E3EDF] border-[#3E3EDF] text-white" : "bg-white border-[#ECECF5]"}`}>
    <span className={`text-xs font-semibold uppercase tracking-wider ${strong ? "text-white/80" : "text-[#9A9AB0]"}`}>{label}</span>
    <span className={`text-2xl font-bold ${strong ? "text-white" : "text-[#1A1A2E]"}`}>{value}</span>
    {sub && <span className={`text-xs ${strong ? "text-white/80" : "text-[#6B6B80]"}`}>{sub}</span>}
  </div>
);

/** Master Admin Dashboard: Nibbl revenue (subscriptions / rebate fees / review
 *  fees), Needs Attention, Brand Revenue and Brand-Funded Rewards, by date range. */
export const AdminOverview = () => {
  const router = useRouter();
  const [days, setDays] = useState(30);
  const [status, setStatus] = useState("");
  const [plan, setPlan] = useState("");
  const [sort, setSort] = useState("lowest");
  const [data, setData] = useState<ApiRecord | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    const to = new Date();
    const from = new Date(to.getTime() - (days - 1) * 86400000);
    nibblApi
      .adminRevenueDashboard({ from: isoDay(from), to: isoDay(to), status, plan, sort })
      .then((result) => live && (setData(result), setError("")))
      .catch((err: Error) => live && setError(err.message || "Could not load the dashboard."));
    return () => {
      live = false;
    };
  }, [days, status, plan, sort]);

  const revenue = (data?.revenue ?? {}) as ApiRecord;
  const rewards = (data?.brand_funded_rewards ?? {}) as ApiRecord;
  const attention = (data?.needs_attention ?? {}) as ApiRecord;
  const brands = (Array.isArray(data?.brands) ? data.brands : []) as ApiRecord[];
  const trend = (Array.isArray(data?.trend) ? data.trend : []) as ApiRecord[];

  const attentionItems = [
    { label: "Withdrawals needing review", value: attention.withdrawals_to_review, href: "/payout-reviews" },
    { label: "Campaign approvals", value: attention.campaign_approvals, href: "/campaign-approvals" },
    { label: "Failed payouts", value: attention.failed_payouts, href: "/withdraw-request" },
    { label: "Suspended shoppers", value: attention.suspended_shoppers, href: "/users" },
    { label: "Brand suspensions", value: attention.brand_suspensions, href: "/users" },
    { label: "Flagged reviews", value: attention.flagged_reviews, href: "/review-flags" },
  ];

  return (
    <div className="flex flex-col gap-6 font-inter">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-[#1A1A2E]">Dashboard Overview</h1>
        <select value={days} onChange={(e) => setDays(Number(e.target.value))}
          className="h-10 px-4 rounded-full border border-[#E0E0F0] bg-white text-sm font-semibold text-[#1A1A2E] cursor-pointer">
          {RANGES.map((r) => <option key={r.days} value={r.days}>{r.label}</option>)}
        </select>
      </div>
      {error && <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-bold text-[#1A1A2E]">Revenue Summary</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Tile label="Nibbl revenue" value={money(revenue.total)} strong
            sub={Number(revenue.credits_applied) > 0 ? `${money(revenue.cash_total)} cash after ${money(revenue.credits_applied)} promo credits` : undefined} />
          <Tile label="Subscriptions" value={money(revenue.subscriptions)} />
          <Tile label="Rebate fees" value={money(revenue.rebate_fees)} />
          <Tile label="Review fees" value={money(revenue.review_fees)} />
        </div>
      </section>

      {trend.length > 0 && (
        <section className="bg-white border border-[#ECECF5] rounded-2xl p-5 flex flex-col gap-3">
          <h2 className="text-sm font-bold text-[#1A1A2E]">Revenue Trend</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-[#9A9AB0] border-b border-[#ECECF5]">
                <th className="py-2 pr-4">Month</th>
                <th className="py-2 pr-4 text-right">Subscriptions</th>
                <th className="py-2 pr-4 text-right">Rebate fees</th>
                <th className="py-2 pr-4 text-right">Review fees</th>
                <th className="py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {trend.map((row) => (
                <tr key={String(row.month)} className="border-b border-[#F6F6FB]">
                  <td className="py-2 pr-4">{new Date(`${String(row.month)}-01T00:00:00`).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</td>
                  <td className="py-2 pr-4 text-right">{money(row.subscriptions)}</td>
                  <td className="py-2 pr-4 text-right">{money(row.rebate_fees)}</td>
                  <td className="py-2 pr-4 text-right">{money(row.review_fees)}</td>
                  <td className="py-2 text-right font-bold">{money(row.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-bold text-[#1A1A2E]">Needs Attention</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          {attentionItems.map((item) => (
            <button key={item.label} type="button" onClick={() => router.push(item.href)}
              className="text-left rounded-2xl border border-[#ECECF5] bg-white p-4 hover:border-[#3E3EDF] cursor-pointer">
              <div className={`text-2xl font-bold ${Number(item.value) > 0 ? "text-[#E65353]" : "text-[#1A1A2E]"}`}>
                {item.value === null || item.value === undefined ? "—" : String(item.value)}
              </div>
              <div className="text-xs font-semibold text-[#6B6B80] mt-1">{item.label}</div>
              {item.value === null && <div className="text-[10px] text-[#9A9AB0] mt-1">Tracked once payout results are imported</div>}
            </button>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-bold text-[#1A1A2E]">Brand-Funded Rewards</h2>
        <p className="text-xs text-[#6B6B80] -mt-2">Shopper rewards paid from brand wallets — not Nibbl revenue.</p>
        <div className="grid grid-cols-3 gap-4">
          <Tile label="Rebate rewards" value={money(rewards.rebate_rewards)} />
          <Tile label="Review rewards" value={money(rewards.review_rewards)} />
          <Tile label="Total rewards" value={money(rewards.total)} />
        </div>
      </section>

      <section className="bg-white border border-[#ECECF5] rounded-2xl p-5 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-[#1A1A2E]">Brand Revenue</h2>
          <div className="flex flex-wrap gap-2">
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-9 px-3 rounded-full border border-[#E0E0F0] text-xs font-semibold">
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>
            <select value={plan} onChange={(e) => setPlan(e.target.value)} className="h-9 px-3 rounded-full border border-[#E0E0F0] text-xs font-semibold">
              <option value="">All plans</option>
              <option value="starter">Starter</option>
              <option value="pro">Pro</option>
              <option value="scale">Scale</option>
            </select>
            <select value={sort} onChange={(e) => setSort(e.target.value)} className="h-9 px-3 rounded-full border border-[#E0E0F0] text-xs font-semibold">
              <option value="lowest">Lowest revenue first</option>
              <option value="highest">Highest revenue first</option>
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-[#9A9AB0] border-b border-[#ECECF5]">
                <th className="py-2 pr-4">Brand</th>
                <th className="py-2 pr-4">Plan</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4 text-right">Subscriptions</th>
                <th className="py-2 pr-4 text-right">Rebate fees</th>
                <th className="py-2 pr-4 text-right">Review fees</th>
                <th className="py-2 text-right">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {brands.map((b) => (
                <tr key={String(b.id)} className="border-b border-[#F6F6FB]">
                  <td className="py-2 pr-4 font-semibold text-[#1A1A2E]">{String(b.name)}</td>
                  <td className="py-2 pr-4">{String(b.plan ?? "—")}</td>
                  <td className="py-2 pr-4 capitalize">{String(b.status)}</td>
                  <td className="py-2 pr-4 text-right">{money(b.subscriptions)}</td>
                  <td className="py-2 pr-4 text-right">{money(b.rebate_fees)}</td>
                  <td className="py-2 pr-4 text-right">{money(b.review_fees)}</td>
                  <td className="py-2 text-right font-bold">{money(b.revenue)}</td>
                </tr>
              ))}
              {data && brands.length === 0 && (
                <tr><td colSpan={7} className="py-6 text-center text-[#9A9AB0]">No brands match.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
