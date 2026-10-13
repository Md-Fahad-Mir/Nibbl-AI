/* eslint-disable @next/next/no-img-element */
"use client";

import {
  BarChart3,
  Database,
  Eye,
  FileText,
  ImageIcon,
  Info,
  type LucideIcon,
  Star,
  Tag,
  UserPlus,
  Users,
  UsersRound,
} from "lucide-react";
import { ApiRecord } from "@/lib/api/backendApi";
import { useBrandApiStore } from "@/stores/useBrandApiStore";
import { formatInteger, formatMoney, toNumber } from "../../utils/backendMappers";

const pct = (value: unknown) => (value === null || value === undefined ? "—" : `${Number(value).toFixed(1)}%`);
const moneyOrDash = (value: unknown) => (value === null || value === undefined || value === "" ? "—" : formatMoney(value));
const share = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 100)}%` : "—");

// Master: Campaign Performance statuses from completed 25-hour cycles.
const STATUS: Record<string, { label: string; tone: string; dot: string }> = {
  exhausted_early: { label: "Exhausted Early", tone: "bg-[#FEF2F2] text-[#DC2626]", dot: "bg-[#DC2626]" },
  on_pace: { label: "On Pace", tone: "bg-[#ECFDF5] text-[#059669]", dot: "bg-[#059669]" },
  behind: { label: "Behind", tone: "bg-[#FFF7ED] text-[#C2410C]", dot: "bg-[#F59E0B]" },
  building_data: { label: "Building Data", tone: "bg-[#F1F5F9] text-[#475569]", dot: "bg-[#94A3B8]" },
};

const fillTime = (hours: unknown, status: string) => {
  if (hours === null || hours === undefined) return status === "behind" ? "Not exhausted" : "—";
  const total = Math.round(toNumber(hours) * 60);
  return `${Math.floor(total / 60)}h ${String(total % 60).padStart(2, "0")}m`;
};

const Section = ({ n, title, sub, children }: { n: number; title: string; sub?: string; children: React.ReactNode }) => (
  <section className="bg-white border border-[#EAEDFF] rounded-2xl p-6 flex flex-col gap-4" aria-label={`${n}. ${title}`}>
    <div>
      <h3 className="font-jakarta font-bold text-xl text-[#001BD2]">{title}</h3>
      {sub && <p className="text-xs text-[#64748B] mt-1">{sub}</p>}
    </div>
    {children}
  </section>
);

const Kpi = ({ Icon, label, value, help }: { Icon: LucideIcon; label: string; value: string; help: string }) => (
  <div className="border border-[#EAEDFF] rounded-xl p-4 flex flex-col gap-2">
    <Icon className="w-7 h-7 text-[#001BD2]" strokeWidth={1.75} />
    <span className="flex items-center gap-1 text-sm text-[#454656]">
      {label}
      <span title={help} className="cursor-help">
        <Info className="w-3.5 h-3.5 text-[#94A3B8]" />
      </span>
    </span>
    <span className="font-jakarta font-extrabold text-2xl text-[#131B2E]">{value}</span>
  </div>
);

/** Master Analytics Overview: Cost & Results, Customer & Conversion and
 *  Campaign Performance for the selected date range. */
export default function AnalyticsOverview() {
  const dashboard = useBrandApiStore((state) => state.analyticsDashboard);
  const storeCampaigns = useBrandApiStore((state) => state.campaigns);
  const products = useBrandApiStore((state) => state.products);
  if (!dashboard) {
    return <p className="text-sm text-[#64748B]">Analytics are loading…</p>;
  }
  const rebates = (dashboard.rebates || {}) as ApiRecord;
  const reviews = (dashboard.reviews || {}) as ApiRecord;
  const conversion = (dashboard.conversion || {}) as ApiRecord;
  // Master: Campaign Performance shows rebate campaigns only.
  const rows = ((Array.isArray(dashboard.campaigns) ? dashboard.campaigns : []) as ApiRecord[]).filter(
    (row) => row.type !== "review"
  );
  const productImage = new Map(products.map((product) => [String(product.id), product.imageSrc]));
  const imageFor = (id: string) => {
    const campaign = storeCampaigns.find((c) => String(c.id) === id);
    if (!campaign) return "";
    const productIds = Array.isArray(campaign.products) ? campaign.products.map(String) : [];
    return String(campaign.image_url || productIds.map((pid) => productImage.get(pid)).find(Boolean) || "");
  };
  const newCustomers = toNumber(conversion.new_customers);
  const returning = toNumber(conversion.returning_customers);
  const totalSpend = toNumber(rebates.total_brand_cost) + toNumber(reviews.total_brand_cost);

  return (
    <div className="flex flex-col gap-6 w-full text-left font-manrope">
      <Section n={1} title="Cost & Results">
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <Kpi Icon={Database} label="Total Spend" value={formatMoney(totalSpend)}
            help="Shopper rewards + Nibbl fees from your wallet transactions (subscriptions excluded)." />
          <Kpi Icon={Tag} label="Avg. Cost per Rebate" value={moneyOrDash(rebates.cost_per_redemption)}
            help="Rebate brand cost ÷ completed rebates." />
          <Kpi Icon={Star} label="Avg. Cost per Review" value={moneyOrDash(reviews.cost_per_review)}
            help="Review brand cost ÷ completed reviews." />
          <Kpi Icon={FileText} label="Completed Rebates" value={formatInteger(rebates.redemptions)}
            help="Approved redemptions in the selected period." />
          <Kpi Icon={Star} label="Completed Reviews" value={formatInteger(reviews.completed)}
            help="Reviews completed in the selected period." />
          <Kpi Icon={Users} label="Unique Customers" value={formatInteger(conversion.unique_customers)}
            help="Shoppers who claimed a rebate or completed a review in the selected period." />
        </div>
      </Section>

      <Section n={2} title="Customer & Conversion">
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <Kpi Icon={Eye} label="Total Views" value={formatInteger(conversion.rebate_views)}
            help="Views of your rebate campaigns. Reviews are not included." />
          <Kpi Icon={BarChart3} label="View-to-Claim Rate" value={pct(conversion.view_to_claim_rate)}
            help="Claims ÷ rebate campaign views." />
          <Kpi Icon={UserPlus} label="New-to-Brand" value={share(newCustomers, newCustomers + returning)}
            help="Share of claiming shoppers who had never claimed one of your offers before." />
          <Kpi Icon={UsersRound} label="Returning Customers" value={share(returning, newCustomers + returning)}
            help="Share of claiming shoppers who had claimed one of your offers before." />
        </div>
      </Section>

      <Section n={3} title="Campaign Performance" sub="Rebate campaigns only · Based on completed 25-hour cycles · Current cycle excluded">
        {rows.length === 0 ? (
          <p className="text-sm text-[#64748B]">No rebate campaigns yet.</p>
        ) : (
          <div className="overflow-x-auto border border-[#EAEDFF] rounded-xl">
            <table className="w-full text-sm min-w-[860px]">
              <thead className="bg-[#F2F3FF] text-xs text-[#131B2E] text-left">
                <tr>
                  <th className="py-3 px-4">Campaign</th>
                  <th className="py-3 px-4">Avg. Claims / Cycle</th>
                  <th className="py-3 px-4">Claim Limit / Cycle</th>
                  <th className="py-3 px-4">Avg. Time to Exhaust</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Recommendation</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const perf = (row.performance || {}) as ApiRecord;
                  const key = String(perf.status ?? "building_data");
                  const status = STATUS[key] ?? STATUS.building_data;
                  const image = imageFor(String(row.id));
                  return (
                    <tr key={String(row.id)} className="border-t border-[#EAEDFF]">
                      <td className="py-3 px-4">
                        <span className="flex items-center gap-3">
                          <span className="w-10 h-10 rounded-lg bg-[#F2F3FF] overflow-hidden flex items-center justify-center flex-shrink-0">
                            {image ? <img src={image} alt="" className="w-full h-full object-cover" /> : <ImageIcon className="w-4 h-4 text-[#C5C5D9]" />}
                          </span>
                          <span className="font-semibold text-[#131B2E]">{String(row.name)}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold text-[#131B2E]">
                        {perf.average_claims_per_cycle != null ? `${String(perf.average_claims_per_cycle)} claims` : "—"}
                      </td>
                      <td className="py-3 px-4 text-[#454656]">{formatInteger(row.claim_capacity)}</td>
                      <td className="py-3 px-4 text-[#454656]">{fillTime(perf.average_fill_hours, key)}</td>
                      <td className="py-3 px-4">
                        <span className={`text-xs font-semibold px-3 py-1 rounded-full inline-flex items-center gap-1.5 ${status.tone}`}>
                          <span className={`w-2 h-2 rounded-full ${status.dot}`} />
                          {status.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-[#454656] max-w-[280px]">{String(perf.recommendation ?? "")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="flex items-center gap-2 text-xs text-[#64748B]">
          <Info className="w-4 h-4 text-[#001BD2]" />
          Status uses completed 25-hour cycles through yesterday. Campaigns reset every 25 hours.
        </p>
      </Section>
    </div>
  );
}
