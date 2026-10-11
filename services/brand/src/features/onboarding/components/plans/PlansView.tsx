"use client";

import { useEffect, useState } from "react";
import { ApiRecord, apiClient, backendApi } from "@/lib/api/backendApi";
import { useBrandApiStore } from "@/stores/useBrandApiStore";
import { formatDate, formatMoney } from "../../utils/backendMappers";

// Master Plans §3/§4: what each plan includes beyond the numbers the API returns.
const FEATURES: Record<string, string[]> = {
  starter: [
    "Customer identity limited to first name and last initial",
    "Customer email shown only for negative-review service recovery",
  ],
  pro: ["Full opted-in customer name, email, and phone", "Customer CSV download", "Customer management and analytics"],
  scale: [
    "Full opted-in customer data and CSV",
    "Future customer integrations and API access",
    "Early access to new Nibbl features",
    "Monthly account-manager check-in",
    "Personalized performance insights",
  ],
};
const INCLUDED = "All plans include OCR receipt verification, fraud protection, Wallet funding, review campaigns, and review exports.";

// Master Plans §4 "Feature Comparison" rows not carried as plan fields.
const SCALE_ONLY: Record<string, Record<string, string>> = {
  "Future API & integrations": { scale: "Coming Soon" },
  "Monthly account manager": { scale: "Yes" },
  "Early feature access": { scale: "Yes" },
};

const reviewCost = (plan: ApiRecord) => formatMoney(1 + Number(plan.review_fee ?? 0));
const fee = (plan: ApiRecord) => `${Number(plan.rebate_fee_percent ?? 0)}%`;

export default function PlansView() {
  const brandId = useBrandApiStore((s) => s.selectedBrandId);
  const campaigns = useBrandApiStore((s) => s.campaigns);
  const [overview, setOverview] = useState<ApiRecord | null>(null);
  const [plans, setPlans] = useState<ApiRecord[]>([]);
  const [choosing, setChoosing] = useState<ApiRecord | null>(null);
  const [keep, setKeep] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!brandId) return;
    let live = true;
    Promise.all([
      apiClient.request<ApiRecord>(backendApi.brand.brandPlan(brandId)),
      apiClient.request<ApiRecord[] | { results: ApiRecord[] }>(backendApi.billing.plans),
    ])
      .then(([current, list]) => {
        if (!live) return;
        setOverview(current);
        setPlans(Array.isArray(list) ? list : list.results);
      })
      .catch((err) => live && setError(err instanceof Error ? err.message : "Could not load your plan."));
    return () => {
      live = false;
    };
  }, [brandId]);

  const running = campaigns.filter(
    (c) => c.status === "active" || (c.status === "paused" && Boolean(c.auto_paused))
  );

  const run = async (task: () => Promise<ApiRecord>) => {
    setBusy(true);
    setError("");
    try {
      setOverview(await task());
      setChoosing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const schedule = (plan: ApiRecord, keepIds: string[]) =>
    run(() =>
      apiClient.request<ApiRecord>(backendApi.brand.schedulePlanChange(brandId!), {
        body: { plan: plan.slug, keep_campaign_ids: keepIds },
      })
    );

  const startChange = (plan: ApiRecord) => {
    setError("");
    if (running.length > Number(plan.max_active_campaigns)) {
      setKeep([]);
      setChoosing(plan);
    } else {
      void schedule(plan, []);
    }
  };

  if (!overview) {
    return <p className="text-sm text-[#64748B] font-manrope">{error || "Loading your plan…"}</p>;
  }
  const scheduled = (overview.scheduled_change ?? null) as ApiRecord | null;
  const recommendation = (overview.recommendation ?? {}) as ApiRecord;
  const history = (Array.isArray(overview.billing_history) ? overview.billing_history : []) as ApiRecord[];

  return (
    <div className="flex flex-col gap-8 w-full animate-slide-up text-left font-manrope">
      <div>
        <h2 className="text-3xl font-extrabold font-jakarta text-[#131B2E] tracking-tight">Plans</h2>
        <p className="text-xs text-[#454656] font-medium mt-1">
          Plan changes begin on your next 30-day renewal. Your current pricing and access stay active until then.
        </p>
      </div>

      {error && <div className="bg-red-50 border border-red-100 text-red-700 text-sm font-semibold rounded-xl px-4 py-3">{error}</div>}

      <section className="bg-white border border-[#EAEDFF] rounded-[20px] p-6 shadow-sm grid grid-cols-2 lg:grid-cols-5 gap-6">
        {[
          ["Current plan", `${String(overview.plan_name)} · ${formatMoney(overview.price)}`],
          ["Next renewal", formatDate(String(overview.renewal_date ?? ""))],
          ["Active rebate campaigns", `${String(overview.active_campaigns_used)} of ${String(overview.active_campaign_limit)}`],
          ["Nibbl spend (30 days)", formatMoney(overview.spend_last_30_days)],
          ["Status", String(overview.status).replace("_", " ")],
        ].map(([label, value]) => (
          <div key={label}>
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">{label}</div>
            <div className="font-jakarta font-extrabold text-lg text-[#131B2E] mt-1 capitalize">{value}</div>
          </div>
        ))}
      </section>

      {scheduled && (
        <div className="bg-[#E2E7FF] rounded-2xl px-5 py-4 flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-[#131B2E]">
            Changing to <b>{String(scheduled.plan_name)}</b> on {formatDate(String(scheduled.effective_at ?? ""))}.
            {Array.isArray(scheduled.keep_campaign_ids) && scheduled.keep_campaign_ids.length > 0 &&
              " Campaigns you didn't keep will pause then."}
          </span>
          <button disabled={busy}
            onClick={() => run(() => apiClient.request<ApiRecord>(backendApi.brand.cancelPlanChange(brandId!)))}
            className="h-9 px-4 rounded-full bg-white text-[#001BD2] text-xs font-bold disabled:opacity-50 cursor-pointer">
            Cancel scheduled change
          </button>
        </div>
      )}

      {Boolean(recommendation.plan) && (
        <div className="bg-white border border-[#EAEDFF] rounded-2xl px-5 py-4 text-sm text-[#454656]">
          <b className="text-[#131B2E]">Recommended: {String(plans.find((p) => p.slug === recommendation.plan)?.name ?? recommendation.plan)}.</b>{" "}
          {String(recommendation.reason ?? "")}{" "}
          <span className="text-xs text-[#94A3B8]">Spend ranges show general plan fit and don&apos;t guarantee total savings.</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {plans.map((plan) => {
          const slug = String(plan.slug);
          const isCurrent = slug === overview.plan;
          const isScheduled = scheduled?.plan === slug;
          return (
            <div key={slug} className={`bg-white rounded-[20px] p-6 shadow-sm flex flex-col gap-4 border ${
              recommendation.plan === slug ? "border-[#001BD2]" : "border-[#EAEDFF]"
            }`}>
              <div>
                <h3 className="font-jakarta font-extrabold text-xl text-[#131B2E]">{String(plan.name)}</h3>
                <p className="text-sm text-[#454656]"><b className="text-2xl text-[#131B2E]">{formatMoney(plan.monthly_price)}</b> every 30 days</p>
              </div>
              <ul className="text-sm text-[#454656] flex flex-col gap-1.5 list-disc pl-5 flex-1">
                <li>{String(plan.max_active_campaigns)} active rebate campaign{Number(plan.max_active_campaigns) === 1 ? "" : "s"}</li>
                <li>{fee(plan)} fee on rebate rewards</li>
                <li>{reviewCost(plan)} per completed review, including the $1 shopper reward</li>
                <li>Unlimited products and review campaigns</li>
                {(FEATURES[slug] ?? []).map((f) => <li key={f}>{f}</li>)}
              </ul>
              {isCurrent ? (
                <span className="h-10 flex items-center justify-center rounded-full bg-[#F2F3FF] text-[#454656] text-sm font-bold">Current plan</span>
              ) : isScheduled ? (
                <span className="h-10 flex items-center justify-center rounded-full bg-[#E2E7FF] text-[#001BD2] text-sm font-bold">Starts at renewal</span>
              ) : (
                <button disabled={busy} onClick={() => startChange(plan)}
                  className="h-10 rounded-full bg-[#001BD2] hover:bg-blue-700 text-white text-sm font-bold disabled:opacity-50 cursor-pointer">
                  Switch to {String(plan.name)} at renewal
                </button>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-xs text-[#64748B] -mt-4">{INCLUDED}</p>

      {plans.length > 0 && (
        <section className="bg-white border border-[#EAEDFF] rounded-[20px] p-6 shadow-sm flex flex-col gap-3">
          <h3 className="font-jakarta font-bold text-base text-[#131B2E]">Feature Comparison</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] font-bold uppercase tracking-wider text-[#454656] border-b border-[#EAEDFF]">
                  <th className="py-2 pr-4 text-left">Feature</th>
                  {plans.map((plan) => (
                    <th key={String(plan.slug)} className={`py-2 px-4 text-center ${plan.slug === overview.plan ? "text-[#001BD2]" : ""}`}>
                      {String(plan.name)}{plan.slug === overview.plan ? " (current)" : ""}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {([
                  ["Active rebate campaigns", (p: ApiRecord) => String(p.max_active_campaigns)],
                  ["Rebate reward fee", fee],
                  ["Completed review cost", reviewCost],
                  ["Customer identity", (p: ApiRecord) =>
                    p.data_access_level === "full" ? "Full opted-in contacts" : "Limited (first name + last initial)"],
                  ["Customer CSV download", (p: ApiRecord) => (p.data_access_level === "full" ? "Yes" : "No")],
                  ...Object.entries(SCALE_ONLY).map(([label, values]) =>
                    [label, (p: ApiRecord) => values[String(p.slug)] ?? "No"] as const),
                ] as const).map(([label, value]) => (
                  <tr key={label} className="border-b border-[#F8F9FF]">
                    <td className="py-2 pr-4 text-[#454656]">{label}</td>
                    {plans.map((plan) => (
                      <td key={String(plan.slug)} className="py-2 px-4 text-center font-semibold text-[#131B2E]">{value(plan)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="bg-white border border-[#EAEDFF] rounded-[20px] p-6 shadow-sm flex flex-col gap-3">
        <h3 className="font-jakarta font-bold text-base text-[#131B2E]">Billing history</h3>
        {history.length === 0 ? (
          <p className="text-sm text-[#94A3B8]">No plan charges yet.</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {history.map((row, i) => (
                <tr key={i} className="border-b border-[#F8F9FF]">
                  <td className="py-2">{formatDate(String(row.date ?? ""))}</td>
                  <td className="py-2">{String(row.description ?? "Plan charge")}{row.paid_with_credit ? " (promotional credit)" : ""}</td>
                  <td className="py-2 text-right font-semibold">{formatMoney(row.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {choosing && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-[24px] p-6 w-full max-w-lg flex flex-col gap-4">
            <h3 className="font-jakarta font-extrabold text-lg text-[#131B2E]">Choose campaigns to keep</h3>
            <p className="text-sm text-[#454656]">
              {String(choosing.name)} allows {String(choosing.max_active_campaigns)} active rebate campaign(s). Choose which stay
              active — the others pause when {String(choosing.name)} begins on {formatDate(String(overview.renewal_date ?? ""))}.
            </p>
            <div className="flex flex-col gap-2 max-h-72 overflow-y-auto">
              {running.map((c) => {
                const id = String(c.id);
                const checked = keep.includes(id);
                return (
                  <label key={id} className="flex items-center gap-3 border border-[#EAEDFF] rounded-xl px-3 py-2.5 cursor-pointer">
                    <input type="checkbox" checked={checked}
                      disabled={!checked && keep.length >= Number(choosing.max_active_campaigns)}
                      onChange={() => setKeep((cur) => (checked ? cur.filter((x) => x !== id) : [...cur, id]))} />
                    <span className="text-sm font-semibold text-[#131B2E]">{String(c.name)}</span>
                  </label>
                );
              })}
            </div>
            {error && <p className="text-xs font-semibold text-red-600">{error}</p>}
            <div className="flex justify-end gap-3">
              <button onClick={() => setChoosing(null)} className="h-10 px-4 text-sm font-bold text-[#454656] cursor-pointer">Cancel</button>
              <button disabled={busy || keep.length !== Number(choosing.max_active_campaigns)} onClick={() => void schedule(choosing, keep)}
                className="h-10 px-5 rounded-full bg-[#001BD2] text-white text-sm font-bold disabled:opacity-50 cursor-pointer">
                Schedule change
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
