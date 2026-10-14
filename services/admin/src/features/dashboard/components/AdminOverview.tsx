"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiRecord, nibblApi } from "@/lib/api/backendApi";
import { Kpi, Pager, usePaged } from "@/features/dashboard/components/AdminPage";
import { AlertTriangle, Ban, BarChart3, Clock, CreditCard, FileText, Flag, Gift, type LucideIcon, Percent, Phone, Users } from "lucide-react";

const RANGES = [
  { days: 7, label: "Last 7 days" },
  { days: 30, label: "Last 30 days" },
  { days: 90, label: "Last 90 days" },
  { days: 365, label: "Last 12 months" },
];

const isoDay = (date: Date) => date.toISOString().slice(0, 10);
const money = (value: unknown) =>
  `$${Number(value ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Master Admin Dashboard: Nibbl revenue (subscriptions / rebate fees / review
 *  fees), Needs Attention, Brand Revenue and Brand-Funded Rewards, by date range. */
export const AdminOverview = () => {
  const router = useRouter();
  const [days, setDays] = useState(30);
  const [status, setStatus] = useState("");
  const [plan, setPlan] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("lowest");
  const [data, setData] = useState<ApiRecord | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    const to = new Date();
    const from = new Date(to.getTime() - (days - 1) * 86400000);
    nibblApi
      .adminRevenueDashboard({ from: isoDay(from), to: isoDay(to), status, plan, sort, category })
      .then((result) => live && (setData(result), setError("")))
      .catch((err: Error) => live && setError(err.message || "Could not load the dashboard."));
    return () => {
      live = false;
    };
  }, [days, status, plan, sort, category]);

  const revenue = (data?.revenue ?? {}) as ApiRecord;
  const rewards = (data?.brand_funded_rewards ?? {}) as ApiRecord;
  const attention = (data?.needs_attention ?? {}) as ApiRecord;
  const brands = (Array.isArray(data?.brands) ? data.brands : []) as ApiRecord[];
  const brandsPage = usePaged(brands, 10, `${status}${plan}${category}${sort}`);
  const categories = (Array.isArray(data?.categories) ? data.categories : []) as string[];

  const attentionItems: { label: string; value: unknown; href: string; Icon: LucideIcon; tone: string }[] = [
    { label: "Withdrawals needing review", value: attention.withdrawals_to_review, href: "/payout-reviews", Icon: Clock, tone: "bg-amber-50 text-amber-600" },
    {
      Icon: FileText,
      tone: "bg-[#EEF0FF] text-[#3E3EDF]",
      label: "Campaigns awaiting approval",
      value: attention.campaign_approvals === undefined ? undefined
        : Number(attention.campaign_approvals) + Number(attention.review_campaign_approvals ?? 0),
      href: "/campaign-approvals",
    },
    { label: "Failed payouts", value: attention.failed_payouts, href: "/withdraw-request", Icon: AlertTriangle, tone: "bg-red-50 text-red-600" },
    { label: "Suspended shoppers", value: attention.suspended_shoppers, href: "/users", Icon: Users, tone: "bg-[#F3E8FF] text-[#7C3AED]" },
    { label: "Brand suspensions", value: attention.brand_suspensions, href: "/suspensions", Icon: Ban, tone: "bg-red-50 text-red-500" },
    { label: "Flagged reviews", value: attention.flagged_reviews, href: "/review-flags", Icon: Flag, tone: "bg-amber-50 text-amber-600" },
    { label: "Phone change requests", value: attention.phone_change_requests, href: "/users?phone_change=pending", Icon: Phone, tone: "bg-[#EEF0FF] text-[#3E3EDF]" },
  ];

  return (
    <div className="flex flex-col gap-6 font-inter">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A2E]">Nibbl Admin Dashboard</h1>
          <p className="text-sm text-[#6B6B80] mt-1">Revenue and tasks that need attention.</p>
        </div>
        <select value={days} onChange={(e) => setDays(Number(e.target.value))}
          className="h-10 px-4 rounded-full border border-[#E0E0F0] bg-white text-sm font-semibold text-[#1A1A2E] cursor-pointer">
          {RANGES.map((r) => <option key={r.days} value={r.days}>{r.label}</option>)}
        </select>
      </div>
      {error && <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>}

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4" aria-label="Revenue Summary">
        <Kpi icon={CreditCard} label="Subscription revenue" value={money(revenue.subscriptions)} />
        <Kpi icon={Percent} iconTone="bg-emerald-50 text-emerald-600" label="Rebate fee revenue" value={money(revenue.rebate_fees)} />
        <Kpi icon={FileText} iconTone="bg-[#F3E8FF] text-[#7C3AED]" label="Review fee revenue" value={money(revenue.review_fees)} />
        <Kpi icon={BarChart3} label="Total Nibbl revenue" value={money(revenue.total)} tone="text-[#3E3EDF]"
          sub={Number(revenue.credits_applied) > 0
            ? `${money(revenue.cash_total)} cash after ${money(revenue.credits_applied)} promo credits`
            : "Brand-funded rewards shown separately."} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-bold text-[#1A1A2E]">Needs Attention</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
          {attentionItems.map((item) => (
            <button key={item.label} type="button" onClick={() => router.push(item.href)}
              className="text-left rounded-2xl border border-[#ECECF5] bg-white p-4 hover:border-[#3E3EDF] cursor-pointer flex items-center gap-3">
              <span className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${item.tone}`}>
                <item.Icon className="w-5 h-5" />
              </span>
              <span className="min-w-0">
                <span className={`block text-2xl font-bold ${Number(item.value) > 0 ? "text-[#E65353]" : "text-[#1A1A2E]"}`}>
                  {item.value === null || item.value === undefined ? "—" : String(item.value)}
                </span>
                <span className="block text-xs font-semibold text-[#6B6B80]">{item.label}</span>
                {item.value === null && <span className="block text-[10px] text-[#9A9AB0] mt-0.5">Tracked once payout results are imported</span>}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="bg-white border border-[#ECECF5] rounded-2xl p-5 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-[#1A1A2E]">Brand Revenue</h2>
          <div className="flex flex-wrap gap-2">
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="h-9 px-3 rounded-full border border-[#E0E0F0] text-xs font-semibold">
              <option value="">All categories</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
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
                <th className="py-2 pr-4">Category</th>
                <th className="py-2 pr-4">Plan</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4 text-right">Subscriptions</th>
                <th className="py-2 pr-4 text-right">Rebate fees</th>
                <th className="py-2 pr-4 text-right">Review fees</th>
                <th className="py-2 pr-4 text-right">Total Nibbl Revenue</th>
                <th className="py-2 text-right">Last Activity</th>
              </tr>
            </thead>
            <tbody>
              {brandsPage.items.map((b) => (
                <tr key={String(b.id)} className="border-b border-[#F6F6FB]">
                  <td className="py-2 pr-4 font-semibold text-[#1A1A2E]">{String(b.name)}</td>
                  <td className="py-2 pr-4">{String(b.category || "—")}</td>
                  <td className="py-2 pr-4">{String(b.plan ?? "—")}</td>
                  <td className="py-2 pr-4 capitalize">{String(b.status)}</td>
                  <td className="py-2 pr-4 text-right">{money(b.subscriptions)}</td>
                  <td className="py-2 pr-4 text-right">{money(b.rebate_fees)}</td>
                  <td className="py-2 pr-4 text-right">{money(b.review_fees)}</td>
                  <td className="py-2 pr-4 text-right font-bold">{money(b.revenue)}</td>
                  <td className="py-2 text-right text-xs text-[#6B6B80]">
                    {b.last_activity ? new Date(String(b.last_activity)).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                  </td>
                </tr>
              ))}
              {data && brands.length === 0 && (
                <tr><td colSpan={9} className="py-6 text-center text-[#9A9AB0]">No brands match.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pager paged={brandsPage} noun="brands" />
      </section>

      <section className="bg-white border border-[#ECECF5] rounded-2xl p-5 flex flex-wrap items-center gap-4" aria-label="Brand-Funded Rewards">
        <span className="w-11 h-11 rounded-xl bg-[#EEF0FF] text-[#3E3EDF] flex items-center justify-center">
          <Gift className="w-5 h-5" />
        </span>
        <span className="text-sm text-[#6B6B80]">Brand-Funded Rewards</span>
        <span className="text-2xl font-bold text-[#1A1A2E]">{money(rewards.total)}</span>
        <span className="text-xs text-[#9A9AB0]">
          Rebate {money(rewards.rebate_rewards)} · Review {money(rewards.review_rewards)} — paid from brand wallets, not Nibbl revenue.
        </span>
      </section>
    </div>
  );
};
