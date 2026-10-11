"use client";

import { useEffect, useState } from "react";
import { ApiRecord, apiClient, backendApi } from "@/lib/api/backendApi";
import { useBrandApiStore } from "@/stores/useBrandApiStore";

/** Master Plans: "X of Y active campaigns used" with an Upgrade link. */
export default function CampaignLimitBanner({ onOpenPlans }: { onOpenPlans?: () => void }) {
  const brandId = useBrandApiStore((s) => s.selectedBrandId);
  const campaigns = useBrandApiStore((s) => s.campaigns);
  const [plan, setPlan] = useState<ApiRecord | null>(null);
  // Re-read usage whenever a campaign's status changes.
  const statusKey = campaigns.map((c) => `${String(c.id)}:${String(c.status)}`).join(",");

  useEffect(() => {
    if (!brandId) return;
    let live = true;
    apiClient
      .request<ApiRecord>(backendApi.brand.brandPlan(brandId))
      .then((overview) => live && setPlan(overview))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [brandId, statusKey]);

  if (!plan) return null;
  const used = Number(plan.active_campaigns_used ?? 0);
  const limit = Number(plan.active_campaign_limit ?? 0);
  const full = limit > 0 && used >= limit;

  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl px-5 py-3 font-manrope border ${
      full ? "bg-amber-50 border-amber-200" : "bg-white border-[#EAEDFF]"
    }`}>
      <div className="flex flex-col gap-1.5 min-w-[220px] flex-1">
        <span className="text-sm text-[#131B2E]">
          <b>{used} of {limit}</b> active campaign{limit === 1 ? "" : "s"} used on the {String(plan.plan_name ?? "")} plan
          {full && <span className="text-amber-800"> — activate another by upgrading or pausing one.</span>}
        </span>
        <div className="h-1.5 w-full max-w-[320px] bg-[#EAEDFF] rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${full ? "bg-amber-500" : "bg-[#001BD2]"}`}
            style={{ width: `${limit ? Math.min(100, (used / limit) * 100) : 0}%` }} />
        </div>
      </div>
      {onOpenPlans && (
        <button onClick={onOpenPlans}
          className="h-9 px-4 rounded-full bg-[#001BD2] text-white text-xs font-bold cursor-pointer">
          Upgrade
        </button>
      )}
    </div>
  );
}
