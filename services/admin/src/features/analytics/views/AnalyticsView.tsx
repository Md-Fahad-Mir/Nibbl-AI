"use client";

import { useEffect, useState } from "react";
import { API_BASE_URL, ApiRecord, nibblApi, tokenStorage } from "@/lib/api/backendApi";
import { AdminPage, Kpi, Notice, btn, money, selectCls } from "@/features/dashboard/components/AdminPage";

const RANGES = [
  { days: 7, label: "Last 7 Days" },
  { days: 30, label: "Last 30 Days" },
  { days: 90, label: "Last 90 Days" },
  { days: 365, label: "Last 12 Months" },
];
const SERIES = [
  { key: "subscriptions", label: "Subscription Revenue", color: "#3E3EDF" },
  { key: "rebate_fees", label: "Rebate Fees", color: "#16A34A" },
  { key: "review_fees", label: "Review Fees", color: "#9333EA" },
];
const isoDay = (date: Date) => date.toISOString().slice(0, 10);

const TrendChart = ({ points }: { points: ApiRecord[] }) => {
  const W = 640, H = 220, P = 36;
  const max = Math.max(1, ...points.flatMap((p) => SERIES.map((s) => Number(p[s.key] ?? 0))));
  const x = (i: number) => P + (points.length < 2 ? (W - 2 * P) / 2 : (i * (W - 2 * P)) / (points.length - 1));
  const y = (v: number) => H - P - (v / max) * (H - 2 * P);
  if (points.length === 0) return <p className="text-sm text-[#9A9AB0] py-10 text-center">No revenue in this period.</p>;
  return (
    <div className="flex flex-col gap-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={P} x2={W - P} y1={y(max * f)} y2={y(max * f)} stroke="#ECECF5" />
            <text x={4} y={y(max * f) + 4} fontSize="10" fill="#9A9AB0">${Math.round(max * f).toLocaleString()}</text>
          </g>
        ))}
        {SERIES.map((s) => (
          <polyline key={s.key} fill="none" stroke={s.color} strokeWidth="2"
            points={points.map((p, i) => `${x(i)},${y(Number(p[s.key] ?? 0))}`).join(" ")} />
        ))}
        {points.map((p, i) => (i % Math.ceil(points.length / 8) === 0 ? (
          <text key={String(p.day)} x={x(i)} y={H - 10} fontSize="10" fill="#9A9AB0" textAnchor="middle">
            {new Date(`${String(p.day)}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </text>
        ) : null))}
      </svg>
      <div className="flex flex-wrap gap-4 text-xs text-[#454656]">
        {SERIES.map((s) => <span key={s.key}><span className="inline-block w-2 h-2 rounded-full mr-1" style={{ background: s.color }} />{s.label}</span>)}
      </div>
    </div>
  );
};

/** Master Admin Sheet 4 "Revenue Analytics": revenue sources, net revenue
 *  (credits, refunds, processing costs), trend, brand contribution + export. */
export const AnalyticsView = () => {
  const [days, setDays] = useState(30);
  const [filters, setFilters] = useState({ category: "", plan: "", sort: "highest" });
  const [data, setData] = useState<ApiRecord | null>(null);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);

  const query = () => {
    const to = new Date();
    const from = new Date(to.getTime() - (days - 1) * 86400000);
    return { from: isoDay(from), to: isoDay(to), ...filters };
  };

  useEffect(() => {
    let live = true;
    const to = new Date();
    const from = new Date(to.getTime() - (days - 1) * 86400000);
    nibblApi
      .adminRevenueDashboard({ from: isoDay(from), to: isoDay(to), ...filters })
      .then((result) => live && (setData(result), setError("")))
      .catch((err: Error) => live && setError(err.message || "Could not load analytics."));
    return () => {
      live = false;
    };
  }, [days, filters]);

  const exportCsv = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams({ ...query(), export: "csv" });
      const token = tokenStorage.getAccess();
      const response = await fetch(`${API_BASE_URL}/admin/analytics/revenue/?${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) throw new Error("Could not export the report.");
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = "brand-revenue.csv";
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setExporting(false);
    }
  };

  const revenue = (data?.revenue ?? {}) as ApiRecord;
  const net = (data?.net_revenue ?? {}) as ApiRecord;
  const rewards = (data?.brand_funded_rewards ?? {}) as ApiRecord;
  const daily = (Array.isArray(data?.daily_trend) ? data.daily_trend : []) as ApiRecord[];
  const brands = (Array.isArray(data?.brands) ? data.brands : []) as ApiRecord[];
  const categories = (Array.isArray(data?.categories) ? data.categories : []) as string[];
  const set = (key: keyof typeof filters) => (e: { target: { value: string } }) =>
    setFilters((f) => ({ ...f, [key]: e.target.value }));

  return (
    <AdminPage active="analytics" title="Revenue Analytics" subtitle="Understand what drives Nibbl revenue and brand value."
      actions={
        <select value={days} onChange={(e) => setDays(Number(e.target.value))} className={selectCls}>
          {RANGES.map((r) => <option key={r.days} value={r.days}>{r.label}</option>)}
        </select>
      }>
      <Notice error={error} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Subscription revenue" value={money(revenue.subscriptions)} />
        <Kpi label="Rebate fee revenue" value={money(revenue.rebate_fees)} />
        <Kpi label="Review fee revenue" value={money(revenue.review_fees)} />
        <Kpi label="Total Nibbl revenue" value={money(revenue.total)} tone="text-[#3E3EDF]" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Kpi label="Promotional credits used" value={money(net.promo_credits_used)} />
        <Kpi label="Refunds" value={money(net.refunds)} />
        <Kpi label="Processing costs (est.)" value={money(net.processing_costs)} />
        <Kpi label="Net Nibbl revenue" value={money(net.net)} tone="text-emerald-700" />
        <Kpi label="Brand-funded rewards" value={money(rewards.total)} />
      </div>
      <p className="text-xs text-[#6B6B80] -mt-3">
        Net = total revenue − promotional credits − processing costs (Stripe card fees on wallet funding and payout fees,
        estimated). Refunds are brand wallet cash returned and brand-funded rewards are not Nibbl revenue, so neither is deducted.
      </p>

      <div className="grid grid-cols-1 2xl:grid-cols-2 gap-5">
        <section className="bg-white border border-[#ECECF5] rounded-2xl p-5 flex flex-col gap-3">
          <h2 className="text-sm font-bold text-[#1A1A2E]">Revenue Trend</h2>
          <TrendChart points={daily} />
        </section>
        <section className="bg-white border border-[#ECECF5] rounded-2xl p-5 flex flex-col gap-3 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-[#1A1A2E]">Brand Revenue Contribution</h2>
            <div className="flex flex-wrap gap-2">
              <select value={filters.category} onChange={set("category")} className={selectCls}>
                <option value="">All categories</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={filters.plan} onChange={set("plan")} className={selectCls}>
                <option value="">All plans</option>
                <option value="starter">Starter</option>
                <option value="pro">Pro</option>
                <option value="scale">Scale</option>
              </select>
              <button onClick={() => void exportCsv()} disabled={exporting} className={`${btn} h-9 bg-[#3E3EDF] text-white text-xs`}>
                {exporting ? "Exporting…" : "Export CSV"}
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-[#9A9AB0] border-b border-[#ECECF5] uppercase">
                  <th className="py-2 pr-3">Brand</th><th className="py-2 pr-3">Category</th>
                  <th className="py-2 pr-3 text-right">Subscription</th><th className="py-2 pr-3 text-right">Rebate fees</th>
                  <th className="py-2 pr-3 text-right">Review fees</th><th className="py-2 pr-3 text-right">Credits</th>
                  <th className="py-2 pr-3 text-right">Processing</th><th className="py-2 text-right">Net contribution</th>
                </tr>
              </thead>
              <tbody>
                {brands.map((b) => (
                  <tr key={String(b.id)} className="border-b border-[#F6F6FB]">
                    <td className="py-2 pr-3 font-semibold text-[#1A1A2E]">{String(b.name)}</td>
                    <td className="py-2 pr-3">{String(b.category || "—")}</td>
                    <td className="py-2 pr-3 text-right">{money(b.subscriptions)}</td>
                    <td className="py-2 pr-3 text-right">{money(b.rebate_fees)}</td>
                    <td className="py-2 pr-3 text-right">{money(b.review_fees)}</td>
                    <td className="py-2 pr-3 text-right">{money(b.credits)}</td>
                    <td className="py-2 pr-3 text-right">{money(b.processing_costs)}</td>
                    <td className="py-2 text-right font-bold">{money(b.net_revenue)}</td>
                  </tr>
                ))}
                {data && brands.length === 0 && <tr><td colSpan={8} className="py-6 text-center text-[#9A9AB0]">No brands match.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AdminPage>
  );
};
