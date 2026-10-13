"use client";

import { useEffect, useState } from "react";
import { ApiRecord, apiClient, backendApi } from "@/lib/api/backendApi";
import { useBrandApiStore } from "@/stores/useBrandApiStore";
import { formatDate, formatMoney } from "../../utils/backendMappers";
import {
  BadgeCheck,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Coins,
  Crown,
  FileText,
  Info,
  ListChecks,
  type LucideIcon,
  Megaphone,
  Percent,
  Receipt,
  Rocket,
  ShieldCheck,
  Sprout,
  Users,
  WalletMinimal,
} from "lucide-react";

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
const INCLUDED_LIST: [LucideIcon, string][] = [
  [Receipt, "OCR receipt verification"],
  [ShieldCheck, "Fraud protection"],
  [WalletMinimal, "Wallet funding"],
  [FileText, "Review exports"],
];
// Master Plans §3: icon, who each plan is for, and the spend range it fits.
const PLAN_STYLE: Record<string, { Icon: LucideIcon; tone: string; best: string; fit: string; badge?: string }> = {
  starter: { Icon: Sprout, tone: "bg-emerald-50 text-emerald-600", best: "Best for testing offers", fit: "Recommended under $1K monthly Nibbl spend." },
  pro: { Icon: Crown, tone: "bg-[#EEF0FF] text-[#4F46E5]", best: "Best for growing reviews and customer lists", fit: "Recommended for $1K–$5K monthly Nibbl spend." },
  scale: { Icon: Rocket, tone: "bg-[#F3E8FF] text-[#7C3AED]", best: "Best for high volume and customer growth", fit: "Recommended for $5K+ monthly Nibbl spend.", badge: "Best for High Volume" },
};
const RULES: [LucideIcon, string][] = [
  [CalendarDays, "Plan changes begin on your next 30-day renewal."],
  [ListChecks, "Before downgrading, choose which campaigns remain active if you exceed the new plan limit."],
  [Users, "Customer-data access changes when the new plan begins."],
  [FileText, "Previously downloaded customer data is not removed, but future access follows the new plan."],
];

const Title = ({ children }: { children: React.ReactNode }) => (
  <h3 className="font-jakarta font-bold text-xl text-[#001BD2]">{children}</h3>
);
const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

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
    <div className="flex flex-col gap-6 w-full animate-slide-up text-left font-manrope">
      <div>
        <h2 className="text-3xl font-extrabold font-jakarta text-[#131B2E] tracking-tight">Plans</h2>
        <p className="text-sm text-[#454656] font-medium mt-1">
          Choose the right plan for your campaign volume, customer access, and growth.
        </p>
      </div>

      {error && <div className="bg-red-50 border border-red-100 text-red-700 text-sm font-semibold rounded-xl px-4 py-3">{error}</div>}

      <section className="bg-white border border-[#EAEDFF] rounded-2xl p-6 flex flex-col gap-4">
        <Title>Current Plan</Title>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-[1.4fr_1fr_1fr_1fr_auto] gap-4 items-center">
          <div className="flex items-center gap-4">
            <span className={`w-14 h-14 rounded-full flex items-center justify-center ${(PLAN_STYLE[String(overview.plan)] ?? PLAN_STYLE.pro).tone}`}>
              <Crown className="w-7 h-7" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-[#454656]">Current Plan</span>
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 rounded-full px-2.5 py-0.5 capitalize">
                  {String(overview.status).replace("_", " ")}
                </span>
              </div>
              <div className="font-jakarta font-extrabold text-2xl text-[#131B2E]">{String(overview.plan_name)}</div>
              <div className="text-sm text-[#454656]">{formatMoney(overview.price)} every 30 days</div>
            </div>
          </div>
          {([
            [CalendarDays, "Next renewal", formatDate(String(overview.renewal_date ?? ""))],
            [Megaphone, "Active rebate campaigns", `${String(overview.active_campaigns_used)} of ${String(overview.active_campaign_limit)}`],
            [Coins, "Last 30 days Nibbl spend", formatMoney(overview.spend_last_30_days)],
          ] as [LucideIcon, string, string][]).map(([Icon, label, value]) => (
            <div key={label} className="flex items-center gap-3">
              <span className="w-11 h-11 rounded-full bg-[#EEF0FF] text-[#001BD2] flex items-center justify-center flex-shrink-0">
                <Icon className="w-5 h-5" />
              </span>
              <div>
                <div className="text-xs text-[#454656]">{label}</div>
                <div className="font-jakarta font-extrabold text-lg text-[#131B2E]">{value}</div>
              </div>
            </div>
          ))}
          <button type="button" onClick={() => scrollTo("billing-history")}
            className="flex items-center gap-1 text-sm font-semibold text-[#001BD2] underline underline-offset-2 cursor-pointer">
            View billing history <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </section>

      {Boolean(recommendation.plan) && (() => {
        const target = plans.find((p) => p.slug === recommendation.plan);
        const current = plans.find((p) => p.slug === overview.plan);
        const isCurrent = recommendation.plan === overview.plan;
        return (
          <section className="bg-white border border-[#EAEDFF] rounded-2xl p-6 flex flex-col gap-4">
            <Title>
              {isCurrent
                ? `${String(target?.name ?? "")} fits your current volume`
                : Number(target?.monthly_price) > Number(current?.monthly_price)
                  ? `You're approaching ${String(target?.name ?? recommendation.plan)} volume`
                  : `${String(target?.name ?? recommendation.plan)} may fit your current volume`}
            </Title>
            <p className="text-sm text-[#454656] -mt-2">{String(recommendation.reason ?? "")}</p>
            {target && current && !isCurrent && (
              <div className="grid grid-cols-1 xl:grid-cols-[1fr_auto] gap-4 items-center">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-[#F7F8FF] rounded-xl p-4">
                  {([
                    [Megaphone, `${String(target.name)} supports up to ${String(target.max_active_campaigns)} active rebate campaigns`],
                    [Percent, `Rebate fee ${Number(target.rebate_fee_percent) < Number(current.rebate_fee_percent) ? "drops" : "changes"} from ${fee(current)} to ${fee(target)}`],
                    [BarChart3, `Completed review cost ${1 + Number(target.review_fee ?? 0) < 1 + Number(current.review_fee ?? 0) ? "drops" : "changes"} from ${reviewCost(current)} to ${reviewCost(target)}`],
                  ] as [LucideIcon, string][]).map(([Icon, text]) => (
                    <div key={text} className="flex items-center gap-3 text-sm font-semibold text-[#131B2E]">
                      <span className="w-10 h-10 rounded-full bg-[#EEF0FF] text-[#001BD2] flex items-center justify-center flex-shrink-0">
                        <Icon className="w-5 h-5" />
                      </span>
                      {text}
                    </div>
                  ))}
                </div>
                <div className="flex flex-col items-center gap-2">
                  <button type="button" onClick={() => scrollTo("choose-plan")}
                    className="h-11 px-8 rounded-xl bg-[#001BD2] text-white text-sm font-bold cursor-pointer">
                    Compare {String(target.name)}
                  </button>
                  <span className="text-[11px] text-[#94A3B8] text-center max-w-[220px]">
                    Recommended ranges indicate general fit and do not guarantee total savings.
                  </span>
                </div>
              </div>
            )}
          </section>
        );
      })()}

      <section id="choose-plan" className="bg-white border border-[#EAEDFF] rounded-2xl p-6 flex flex-col gap-4 scroll-mt-24">
        <Title>Choose Your Plan</Title>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {plans.map((plan) => {
            const slug = String(plan.slug);
            const style = PLAN_STYLE[slug] ?? PLAN_STYLE.pro;
            const isCurrent = slug === overview.plan;
            const isScheduled = scheduled?.plan === slug;
            const upgrade = Number(plan.monthly_price) > Number(overview.price);
            const bullets = [
              `${String(plan.max_active_campaigns)} active rebate campaign${Number(plan.max_active_campaigns) === 1 ? "" : "s"}`,
              "Unlimited products",
              "Unlimited review campaigns",
              `${fee(plan)} fee on rebate rewards`,
              `${reviewCost(plan)} per completed review, includes $1 shopper reward`,
              ...(FEATURES[slug] ?? []),
            ];
            return (
              <div key={slug} className={`rounded-2xl p-5 flex flex-col gap-4 border ${
                isCurrent ? "border-[#001BD2]/40 bg-[#FAFAFF]" : "border-[#EAEDFF]"
              }`}>
                <div className="flex items-start gap-3">
                  <span className={`w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 ${style.tone}`}>
                    <style.Icon className="w-7 h-7" />
                  </span>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-jakarta font-extrabold text-xl text-[#131B2E]">{String(plan.name)}</h4>
                      {isCurrent && <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 rounded-full px-2.5 py-0.5">Current Plan</span>}
                      {!isCurrent && style.badge && <span className="text-[11px] font-bold text-[#7C3AED] bg-[#F3E8FF] rounded-full px-2.5 py-0.5">{style.badge}</span>}
                    </div>
                    <p className="text-[#001BD2]"><b className="text-2xl">{formatMoney(plan.monthly_price)}</b> / 30 days</p>
                    <p className="text-sm font-semibold text-[#001BD2]">{style.best}</p>
                    <p className="text-xs text-[#94A3B8]">{style.fit}</p>
                  </div>
                </div>
                <div className="flex flex-col gap-3 flex-1">
                  <ul className="flex flex-col gap-1.5 text-sm text-[#454656]">
                    {bullets.map((b) => (
                      <li key={b} className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" /> {b}
                      </li>
                    ))}
                  </ul>
                  <div className="bg-[#F7F8FF] rounded-xl p-3 grid grid-cols-2 gap-2 text-xs text-[#454656] mt-auto">
                    <span className="col-span-2 font-bold text-[#131B2E]">Included for all plans:</span>
                    {INCLUDED_LIST.map(([Icon, text]) => (
                      <span key={text} className="flex items-center gap-2"><Icon className="w-3.5 h-3.5 text-[#001BD2]" /> {text}</span>
                    ))}
                  </div>
                </div>
                {isCurrent ? (
                  <span className="h-11 flex items-center justify-center rounded-xl bg-[#EEF0FF] text-[#94A3B8] text-sm font-bold">Current Plan</span>
                ) : isScheduled ? (
                  <span className="h-11 flex items-center justify-center rounded-xl bg-[#E2E7FF] text-[#001BD2] text-sm font-bold">Starts at renewal</span>
                ) : (
                  <button disabled={busy} onClick={() => startChange(plan)}
                    className={`h-11 rounded-xl text-sm font-bold disabled:opacity-50 cursor-pointer ${
                      upgrade ? "bg-[#001BD2] text-white" : "border-2 border-[#001BD2] text-[#001BD2] bg-white"
                    }`}>
                    {upgrade ? "Schedule Upgrade" : "Schedule Downgrade"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <p className="text-xs text-[#64748B]">{INCLUDED}</p>
      </section>

      {plans.length > 0 && (
        <section className="bg-white border border-[#EAEDFF] rounded-[20px] p-6 shadow-sm flex flex-col gap-3">
          <Title>Feature Comparison</Title>
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

      <section className="bg-white border border-[#EAEDFF] rounded-2xl p-6 flex flex-col gap-4">
        <Title>Plan Change Rules</Title>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1fr_auto] gap-4 items-center">
          {RULES.map(([Icon, text]) => (
            <div key={text} className="flex items-start gap-3 text-xs text-[#454656]">
              <Icon className="w-6 h-6 text-[#001BD2] flex-shrink-0" /> {text}
            </div>
          ))}
          <div className="flex flex-col items-center gap-2">
            {scheduled ? (
              <>
                <span className="text-xs text-[#131B2E] text-center">
                  {String(scheduled.plan_name)} scheduled for {formatDate(String(scheduled.effective_at ?? ""))}
                </span>
                <button type="button" onClick={() => scrollTo("choose-plan")}
                  className="h-9 px-4 rounded-lg bg-[#001BD2] text-white text-xs font-bold cursor-pointer">
                  Manage Scheduled Change
                </button>
                <button type="button" disabled={busy}
                  onClick={() => run(() => apiClient.request<ApiRecord>(backendApi.brand.cancelPlanChange(brandId!)))}
                  className="text-xs font-semibold text-[#001BD2] underline underline-offset-2 disabled:opacity-50 cursor-pointer">
                  Cancel Scheduled Change
                </button>
              </>
            ) : (
              <span className="flex items-center gap-1.5 text-xs text-[#64748B]"><BadgeCheck className="w-4 h-4 text-[#001BD2]" /> No change scheduled</span>
            )}
          </div>
        </div>
        <p className="flex items-center gap-2 text-xs text-[#64748B] bg-[#F7F8FF] rounded-lg px-3 py-2">
          <Info className="w-4 h-4 text-[#001BD2]" />
          Lower tiers keep core campaign and review tools. Higher tiers increase active campaign capacity, reduce fees, and
          unlock customer-growth features.
        </p>
      </section>

      <section id="billing-history" className="bg-white border border-[#EAEDFF] rounded-2xl p-6 flex flex-col gap-3 scroll-mt-24">
        <Title>Billing History</Title>
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
