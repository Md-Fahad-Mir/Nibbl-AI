import { useMemo, useState } from "react";
import RebatesLanding from "./RebatesLanding";
import DealCampaignBuilder from "./deal/DealCampaignBuilder";
import CampaignDetail from "./deal/CampaignDetail";
import { useBrandApiStore } from "@/stores/useBrandApiStore";
import { ApiRecord } from "@/lib/api/backendApi";
import { toNumber } from "../../utils/backendMappers";

interface Campaign {
  id: string;
  name: string;
  category: string;
  scope: string;
  cycleClaims: number;
  capacity: number;
  redemptions: number;
  rewardSpend: number;
  status: "ACTIVE" | "PAUSED" | "COMPLETED" | "IN_REVIEW";
  // Nibbl approval label, e.g. "Pending review" (rebate campaigns).
  reviewLabel?: string;
  // Nibbl comment when changes were requested or the campaign was rejected.
  reviewComment?: string;
}

// display_status (backend) → landing tab.
const TAB_FOR_STATUS: Record<string, Campaign["status"]> = {
  active: "ACTIVE",
  scheduled: "ACTIVE",
  paused: "PAUSED",
  approved: "PAUSED",
  draft: "PAUSED",
  ended: "COMPLETED",
  pending_review: "IN_REVIEW",
  changes_requested: "IN_REVIEW",
  rejected: "IN_REVIEW",
};

const LABELS: Record<string, string> = {
  draft: "Draft",
  pending_review: "Pending review",
  changes_requested: "Changes requested",
  rejected: "Rejected",
  approved: "Approved",
  scheduled: "Scheduled",
  ended: "Ended",
};

const campaignId = (campaign: ApiRecord) => String(campaign.id ?? campaign.campaign_id ?? "");

const mapCampaign = (campaign: ApiRecord, metrics?: ApiRecord): Campaign => {
  const display = String(campaign.display_status ?? "draft");
  const label = LABELS[display] ?? (campaign.pending_revision ? "Changes pending review" : undefined);
  return {
    id: String(campaign.id),
    name: String(campaign.name ?? "Untitled rebate campaign"),
    category: String(campaign.product_name ?? "Products"),
    scope: String(campaign.offer_headline || campaign.description || ""),
    cycleClaims: toNumber(campaign.current_cycle_claims),
    capacity: toNumber(campaign.claim_capacity),
    redemptions: toNumber(metrics?.redemptions),
    rewardSpend: toNumber(metrics?.reward_spend),
    status: TAB_FOR_STATUS[display] ?? "PAUSED",
    reviewLabel: label,
    reviewComment: String(campaign.review_comment ?? "") || undefined,
  };
};

type Screen = { name: "list" } | { name: "builder"; campaign: ApiRecord | null } | { name: "detail"; id: string };

export default function RebatesView({ onOpenPlans }: { onOpenPlans?: () => void } = {}) {
  const [screen, setScreen] = useState<Screen>({ name: "list" });
  const apiCampaigns = useBrandApiStore((state) => state.campaigns);
  const analyticsCampaigns = useBrandApiStore((state) => state.analyticsCampaigns);

  const campaigns = useMemo(() => {
    const metricsByCampaign = new Map(analyticsCampaigns.map((metrics) => [campaignId(metrics), metrics]));
    return apiCampaigns.map((campaign) => mapCampaign(campaign, metricsByCampaign.get(campaignId(campaign))));
  }, [analyticsCampaigns, apiCampaigns]);

  return (
    <div className="w-full">
      {screen.name === "list" && (
        <RebatesLanding
          campaigns={campaigns}
          onCreateNew={() => setScreen({ name: "builder", campaign: null })}
          onEditCampaign={(camp) => setScreen({ name: "detail", id: camp.id })}
          onOpenPlans={onOpenPlans}
        />
      )}
      {screen.name === "builder" && (
        <DealCampaignBuilder
          key={String(screen.campaign?.id ?? "new")}
          campaign={screen.campaign}
          onCancel={() =>
            setScreen(screen.campaign ? { name: "detail", id: String(screen.campaign.id) } : { name: "list" })
          }
          // The detail page opens right after saving or submitting.
          onSaved={(saved) => setScreen({ name: "detail", id: String(saved.id) })}
        />
      )}
      {screen.name === "detail" && (
        <CampaignDetail
          campaignId={screen.id}
          onBack={() => setScreen({ name: "list" })}
          onEdit={(campaign) => setScreen({ name: "builder", campaign })}
        />
      )}
    </div>
  );
}
