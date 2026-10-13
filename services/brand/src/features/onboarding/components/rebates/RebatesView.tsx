import { useMemo, useState } from "react";
import RebatesLanding from "./RebatesLanding";
import DealCampaignBuilder from "./deal/DealCampaignBuilder";
import CampaignDetail from "./deal/CampaignDetail";
import { useBrandApiStore } from "@/stores/useBrandApiStore";
import { ApiRecord } from "@/lib/api/backendApi";
import { toNumber } from "../../utils/backendMappers";
import type { RebateCampaignCard, RebateTab } from "./RebatesLandingCard";

// display_status (backend) → Master status tab and pill label.
const TAB_FOR_STATUS: Record<string, RebateTab> = {
  draft: "Draft",
  pending_review: "Pending Review",
  approved: "Scheduled",
  scheduled: "Scheduled",
  active: "Active",
  paused: "Paused",
  changes_requested: "Changes Requested",
  rejected: "Changes Requested",
  ended: "Ended",
};

const LABELS: Record<string, string> = {
  draft: "Draft",
  pending_review: "Pending Review",
  approved: "Approved",
  scheduled: "Scheduled",
  active: "Active",
  paused: "Paused",
  changes_requested: "Changes Requested",
  rejected: "Rejected",
  ended: "Ended",
};

const campaignId = (campaign: ApiRecord) => String(campaign.id ?? campaign.campaign_id ?? "");

const day = (value: unknown) =>
  value ? new Date(String(value)).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";

const dateRange = (campaign: ApiRecord) => {
  // Campaigns launched without a planned start date show when they went live.
  const start = day(campaign.start_at || campaign.activated_at);
  const end = day(campaign.end_at);
  if (!start) return "Start date not set";
  return end ? `${start} – ${end}` : `${start} – No end date`;
};

const mapCampaign = (campaign: ApiRecord, metrics: ApiRecord | undefined, productImages: Map<string, string>): RebateCampaignCard => {
  const display = String(campaign.display_status ?? "draft");
  const productIds = Array.isArray(campaign.products) ? campaign.products.map(String) : [];
  const rate = metrics?.redemption_rate;
  return {
    id: campaignId(campaign),
    tab: TAB_FOR_STATUS[display] ?? "Draft",
    statusLabel: campaign.pending_revision && display === "active" ? "Active · Changes Pending" : LABELS[display] ?? "Draft",
    headline: String(campaign.offer_headline || campaign.name || "Untitled rebate campaign"),
    description: String(campaign.offer_description || ""),
    image: String(campaign.image_url || productIds.map((id) => productImages.get(id)).find(Boolean) || ""),
    dates: dateRange(campaign),
    claims: toNumber(metrics?.reservations),
    activeClaims: toNumber(metrics?.active_reservations),
    pendingReview: toNumber(metrics?.pending_review),
    redemptions: toNumber(metrics?.redemptions),
    redemptionRate: rate === null || rate === undefined ? null : toNumber(rate),
    rewardSpend: toNumber(metrics?.reward_spend),
    cycleClaims: toNumber(campaign.current_cycle_claims),
    capacity: toNumber(campaign.claim_capacity),
    canEdit: !["pending_review", "rejected", "ended"].includes(display),
    reviewComment: String(campaign.review_comment ?? "") || undefined,
  };
};

type Screen = { name: "list" } | { name: "builder"; campaign: ApiRecord | null } | { name: "detail"; id: string };

export default function RebatesView({
  onOpenPlans,
  initialCampaignId = "",
}: { onOpenPlans?: () => void; initialCampaignId?: string } = {}) {
  const [screen, setScreen] = useState<Screen>(
    initialCampaignId ? { name: "detail", id: initialCampaignId } : { name: "list" }
  );
  const apiCampaigns = useBrandApiStore((state) => state.campaigns);
  const analyticsCampaigns = useBrandApiStore((state) => state.analyticsCampaigns);
  const products = useBrandApiStore((state) => state.products);

  // Archived campaigns stay out of the list (same as the dashboard).
  const visible = useMemo(
    () => apiCampaigns.filter((campaign) => String(campaign.status ?? "") !== "archived"),
    [apiCampaigns]
  );
  const campaigns = useMemo(() => {
    const metricsByCampaign = new Map(analyticsCampaigns.map((metrics) => [campaignId(metrics), metrics]));
    const productImages = new Map(products.map((product) => [String(product.id), String(product.imageSrc || "")]));
    return visible.map((campaign) =>
      mapCampaign(campaign, metricsByCampaign.get(campaignId(campaign)), productImages)
    );
  }, [analyticsCampaigns, products, visible]);
  const rawById = useMemo(() => new Map(visible.map((campaign) => [campaignId(campaign), campaign])), [visible]);

  return (
    <div className="w-full">
      {screen.name === "list" && (
        <RebatesLanding
          campaigns={campaigns}
          onCreateNew={() => setScreen({ name: "builder", campaign: null })}
          onViewCampaign={(id) => setScreen({ name: "detail", id })}
          onEditCampaign={(id) => {
            const campaign = rawById.get(id);
            if (campaign) setScreen({ name: "builder", campaign });
          }}
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
