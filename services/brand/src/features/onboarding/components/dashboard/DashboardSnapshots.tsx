"use client";

import { ApiRecord } from "@/lib/api/backendApi";
import { useBrandApiStore } from "@/stores/useBrandApiStore";
import { formatInteger, formatMoney } from "../../utils/backendMappers";

const pct = (value: unknown) => (value === null || value === undefined ? "—" : `${Number(value).toFixed(1)}%`);
const moneyOrDash = (value: unknown) => (value === null || value === undefined || value === "" ? "—" : formatMoney(value));

interface Tile {
  label: string;
  value: string;
  sub?: string;
}

const Row = ({ title, tiles }: { title: string; tiles: Tile[] }) => (
  <section className="flex flex-col gap-4">
    <h2 className="text-sm font-jakarta font-extrabold text-[#454656] opacity-70 tracking-widest uppercase">{title}</h2>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {tiles.map((tile) => (
        <div key={tile.label} className="bg-white border border-[#C5C5D9]/10 rounded-[20px] p-6 flex flex-col gap-1 shadow-sm font-jakarta">
          <span className="text-[11px] font-semibold text-[#454656] tracking-wider uppercase font-manrope">{tile.label}</span>
          <span className="text-[28px] font-extrabold text-[#131B2E]">{tile.value}</span>
          {tile.sub && <span className="text-xs font-manrope text-[#64748B]">{tile.sub}</span>}
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
  const days = useBrandApiStore((state) => state.dashboardDays);
  if (!dashboard) return null;
  const rebates = (dashboard.rebates || {}) as ApiRecord;
  const reviews = (dashboard.reviews || {}) as ApiRecord;

  return (
    <div className="flex flex-col gap-8">
      <Row
        title={`Rebates · last ${days} days`}
        tiles={[
          { label: "Claims", value: formatInteger(rebates.claims) },
          { label: "Redemptions", value: formatInteger(rebates.redemptions) },
          { label: "Redemption rate", value: pct(rebates.redemption_rate) },
          {
            label: "Total brand cost",
            value: formatMoney(rebates.total_brand_cost),
            sub: `${moneyOrDash(rebates.cost_per_redemption)} per redemption`,
          },
        ]}
      />
      <Row
        title={`Reviews · last ${days} days`}
        tiles={[
          { label: "Review invitations", value: formatInteger(reviews.invitations) },
          { label: "Reviews completed", value: formatInteger(reviews.completed) },
          { label: "Completion rate", value: pct(reviews.completion_rate) },
          {
            label: "Total brand cost",
            value: formatMoney(reviews.total_brand_cost),
            sub: `${moneyOrDash(reviews.cost_per_review)} per review`,
          },
        ]}
      />
    </div>
  );
}
