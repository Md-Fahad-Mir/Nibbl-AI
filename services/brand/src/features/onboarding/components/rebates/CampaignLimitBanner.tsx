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
  // Master plans: Starter 1 → Pro 3 → Scale 10 active rebate campaigns.
  const next = limit < 3 ? "Pro for up to 3" : limit < 10 ? "Scale for up to 10" : "";

  return (
    <div
      className={`flex flex-col justify-center rounded-xl px-4 py-2 font-manrope border ${
        full ? "bg-amber-50 border-amber-200" : "bg-[#F2F3FF] border-[#EAEDFF]"
      }`}
    >
      <span className="text-sm font-bold text-[#131B2E]">
        {used} of {limit} active campaign{limit === 1 ? "" : "s"} used
      </span>
      {next && onOpenPlans && (
        <button
          type="button"
          onClick={onOpenPlans}
          className="text-xs font-semibold text-[#001BD2] underline underline-offset-2 text-left bg-transparent border-none p-0 cursor-pointer"
        >
          Upgrade to {next}
        </button>
      )}
    </div>
  );
}
