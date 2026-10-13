"use client";

import { BarChart3, CircleDollarSign, FileText, type LucideIcon, MessageSquare, Percent, ShoppingCart, Star } from "lucide-react";
import { ApiRecord } from "@/lib/api/backendApi";
import { useBrandApiStore } from "@/stores/useBrandApiStore";
import { formatInteger, formatMoney } from "../../utils/backendMappers";

const pct = (value: unknown) => (value === null || value === undefined ? "—" : `${Number(value).toFixed(1)}%`);
const moneyOrDash = (value: unknown) => (value === null || value === undefined || value === "" ? "—" : formatMoney(value));

interface Tile {
  label: string;
  value: string;
  sub?: string;
  Icon: LucideIcon;
}

const Row = ({ title, tiles }: { title: string; tiles: Tile[] }) => (
  <section className="flex flex-col gap-4">
    <h2 className="text-sm font-jakarta font-extrabold text-[#454656] opacity-70 tracking-widest uppercase">{title}</h2>
    <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${tiles.length === 3 ? "lg:grid-cols-3" : "lg:grid-cols-4"}`}>
      {tiles.map(({ label, value, sub, Icon }) => (
        <div key={label} className="bg-white border border-[#C5C5D9]/10 rounded-[20px] p-6 flex items-center gap-5 shadow-sm font-jakarta">
          <span className="w-12 h-12 rounded-2xl bg-[#EEF0FF] text-[#001BD2] flex items-center justify-center flex-shrink-0">
            <Icon className="w-6 h-6" />
          </span>
          <span className="flex flex-col gap-1 min-w-0">
            <span className="text-[11px] font-semibold text-[#454656] tracking-wider uppercase font-manrope">{label}</span>
            <span className="text-[28px] leading-none font-extrabold text-[#131B2E]">{value}</span>
            {sub && <span className="text-xs font-manrope text-[#64748B]">{sub}</span>}
          </span>
        </div>
      ))}
    </div>
  </section>
);

/** Master dashboard snapshots (selected date range, default last 30 days; no mini charts or comparison
 *  badges). Total Brand Cost = shopper rewards + Nibbl fees, excluding
 *  subscriptions; cost per result shows "—" when there are no results. */
export default function DashboardSnapshots() {
  const dashboard = useBrandApiStore((state) => state.analyticsDashboard);
  if (!dashboard) return null;
  const rebates = (dashboard.rebates || {}) as ApiRecord;
  const reviews = (dashboard.reviews || {}) as ApiRecord;

  return (
    <div className="flex flex-col gap-8">
      <Row
        title="Rebate Snapshot"
        tiles={[
          { label: "Claims", value: formatInteger(rebates.claims), Icon: FileText },
          { label: "Redemptions", value: formatInteger(rebates.redemptions), Icon: ShoppingCart },
          { label: "Redemption Rate", value: pct(rebates.redemption_rate), Icon: Percent },
          {
            label: "Total Brand Cost",
            value: formatMoney(rebates.total_brand_cost),
            sub: `Cost per Redemption ${moneyOrDash(rebates.cost_per_redemption)}`,
            Icon: CircleDollarSign,
          },
        ]}
      />
      <Row
        title="Review Snapshot"
        tiles={[
          { label: "Review Invitations", value: formatInteger(reviews.invitations), Icon: Star },
          {
            label: "Reviews Completed",
            value: formatInteger(reviews.completed),
            sub: `Completion Rate ${pct(reviews.completion_rate)}`,
            Icon: MessageSquare,
          },
          {
            label: "Total Brand Cost",
            value: formatMoney(reviews.total_brand_cost),
            sub: `Cost per Review ${moneyOrDash(reviews.cost_per_review)}`,
            Icon: BarChart3,
          },
        ]}
      />
    </div>
  );
}
