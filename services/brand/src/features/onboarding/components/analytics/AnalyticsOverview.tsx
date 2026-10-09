"use client";

import { ApiRecord } from "@/lib/api/backendApi";
import { useBrandApiStore } from "@/stores/useBrandApiStore";
import { formatInteger, formatMoney } from "../../utils/backendMappers";

const pct = (value: unknown) => (value === null || value === undefined ? "—" : `${Number(value).toFixed(1)}%`);
const perResult = (value: unknown) => (value === null || value === undefined || value === "" ? "—" : formatMoney(value));

// Master: Campaign Performance statuses from completed 25-hour cycles.
const STATUS: Record<string, { label: string; tone: string }> = {
  exhausted_early: { label: "Exhausted Early", tone: "bg-[#FEF2F2] text-[#DC2626]" },
  on_pace: { label: "On Pace", tone: "bg-[#ECFDF5] text-[#059669]" },
  behind: { label: "Behind", tone: "bg-[#FFF7ED] text-[#C2410C]" },
  building_data: { label: "Building Data", tone: "bg-[#F1F5F9] text-[#475569]" },
};

const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="bg-white border border-[#C5C5D9]/15 shadow-[0px_24px_48px_rgba(19,27,46,0.04)] rounded-2xl p-6 flex flex-col gap-5">
    <h3 className="font-jakarta font-bold text-lg text-[#131B2E]">{title}</h3>
    {children}
  </section>
);

const Stat = ({ label, value, sub }: { label: string; value: string; sub?: string }) => (
  <div className="flex flex-col gap-1">
    <span className="text-[11px] font-bold text-[#454656] tracking-[0.55px] uppercase">{label}</span>
    <span className="font-jakarta font-extrabold text-2xl text-[#131B2E]">{value}</span>
    {sub && <span className="text-xs text-[#64748B]">{sub}</span>}
  </div>
);

export default function AnalyticsOverview() {
  const dashboard = useBrandApiStore((state) => state.analyticsDashboard);
  if (!dashboard) {
    return <p className="text-sm text-[#64748B]">Analytics are loading…</p>;
  }
  const rebates = (dashboard.rebates || {}) as ApiRecord;
  const reviews = (dashboard.reviews || {}) as ApiRecord;
  const conversion = (dashboard.conversion || {}) as ApiRecord;
  const campaigns = (Array.isArray(dashboard.campaigns) ? dashboard.campaigns : []) as ApiRecord[];

  return (
    <div className="flex flex-col gap-8 w-full text-left font-manrope animate-slide-up">
      {/* 1. Cost & Results */}
      <Card title="Cost & Results">
        <p className="text-xs text-[#64748B] -mt-3">
          Total Brand Cost = shopper rewards + Nibbl fees from your wallet transactions (subscriptions excluded).
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <Stat label="Rebate brand cost" value={formatMoney(rebates.total_brand_cost)}
            sub={`${perResult(rebates.cost_per_redemption)} per redemption`} />
          <Stat label="Redemptions" value={formatInteger(rebates.redemptions)}
            sub={`${pct(rebates.redemption_rate)} of ${formatInteger(rebates.claims)} claims`} />
          <Stat label="Review brand cost" value={formatMoney(reviews.total_brand_cost)}
            sub={`${perResult(reviews.cost_per_review)} per review`} />
          <Stat label="Reviews completed" value={formatInteger(reviews.completed)}
            sub={`${pct(reviews.completion_rate)} of ${formatInteger(reviews.invitations)} invitations`} />
        </div>
      </Card>

      {/* 2. Customer & Conversion (rebates only) */}
      <Card title="Customer & Conversion">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <Stat label="Rebate campaign views" value={formatInteger(conversion.rebate_views)} />
          <Stat label="View → claim" value={pct(conversion.view_to_claim_rate)}
            sub={`${formatInteger(conversion.claims)} claims`} />
          <Stat label="New customers" value={formatInteger(conversion.new_customers)} />
          <Stat label="Returning customers" value={formatInteger(conversion.returning_customers)} />
        </div>
      </Card>

      {/* 3. Campaign Performance (rebates, completed 25-hour cycles) */}
      <Card title="Campaign Performance">
        <p className="text-xs text-[#64748B] -mt-3">
          Based on completed 25-hour cycles (the current cycle is excluded). Campaigns reset every 25 hours.
        </p>
        {campaigns.length === 0 ? (
          <p className="text-sm text-[#64748B]">No rebate campaigns yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[10px] uppercase tracking-wider text-[#454656] text-left">
                <tr>
                  <th className="py-2 pr-4">Campaign</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Avg. time to fill</th>
                  <th className="py-2 pr-4">Cycles</th>
                  <th className="py-2">Recommendation</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((row) => {
                  const perf = (row.performance || {}) as ApiRecord;
                  const status = STATUS[String(perf.status)] ?? STATUS.building_data;
                  return (
                    <tr key={String(row.id)} className="border-t border-[#F1F2FA] align-top">
                      <td className="py-3 pr-4 font-bold text-[#131B2E]">{String(row.name)}</td>
                      <td className="py-3 pr-4">
                        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${status.tone}`}>{status.label}</span>
                      </td>
                      <td className="py-3 pr-4 text-[#454656]">
                        {perf.average_fill_hours != null ? `${String(perf.average_fill_hours)} h` : "—"}
                      </td>
                      <td className="py-3 pr-4 text-[#454656]">{formatInteger(perf.completed_cycles)}</td>
                      <td className="py-3 text-[#454656]">{String(perf.recommendation ?? "")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
