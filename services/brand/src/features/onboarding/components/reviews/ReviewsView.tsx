import { useEffect, useState } from "react";
import ReviewsLanding from "./ReviewsLanding";
import ReviewCampaignBuilder from "./campaign/ReviewCampaignBuilder";
import ReviewCampaignDetail from "./campaign/ReviewCampaignDetail";
import ReviewManagement from "../reviews-management/ReviewManagement";
import { ApiRecord } from "@/lib/api/backendApi";
import { useBrandApiStore } from "@/stores/useBrandApiStore";
import { toNumber } from "../../utils/backendMappers";

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft", active: "Active", paused: "Paused", scheduled: "Scheduled", ended: "Ended",
};

const mapCampaign = (campaign: ApiRecord) => {
  const status = String(campaign.display_status ?? campaign.status ?? "").toLowerCase();
  return {
    id: String(campaign.id),
    name: String(campaign.name ?? "Untitled review campaign"),
    createdDate:
      typeof campaign.created_at === "string"
        ? new Date(campaign.created_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        : "",
    status: STATUS_LABEL[status] ?? status,
    opportunitiesToday: toNumber(campaign.opportunities_today),
    dailyOpportunities: toNumber(campaign.daily_opportunities),
  };
};

type View =
  | { name: "landing" }
  | { name: "builder"; campaign: ApiRecord | null }
  | { name: "detail"; campaignId: string }
  | { name: "management" };

interface ReviewsViewProps {
  initialProductFilter?: string;
  onFilterConsumed?: () => void;
}

export default function ReviewsView({
  initialProductFilter = "",
  onFilterConsumed,
}: ReviewsViewProps = {}) {
  const [view, setView] = useState<View>(
    initialProductFilter ? { name: "management" } : { name: "landing" }
  );
  // Captured once at mount so clearing the parent intent can't reset it.
  const [managementFilter] = useState(initialProductFilter);

  // The product-filter intent is one-shot: clear it in the parent after mount
  // so normal navigation back to Reviews opens the landing, not this filter.
  useEffect(() => {
    if (initialProductFilter) onFilterConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const apiCampaigns = useBrandApiStore((state) => state.reviewCampaigns);
  const campaigns = apiCampaigns
    .filter((campaign) => String(campaign.status) !== "archived")
    .map(mapCampaign);
  const toLanding = () => setView({ name: "landing" });

  return (
    <div className="w-full">
      {view.name === "landing" && (
        <ReviewsLanding
          campaigns={campaigns}
          onCreateNew={() => setView({ name: "builder", campaign: null })}
          onViewDetail={(camp) => setView({ name: "detail", campaignId: camp.id })}
          onReviewManagement={() => setView({ name: "management" })}
        />
      )}

      {view.name === "builder" && (
        <ReviewCampaignBuilder
          campaign={view.campaign}
          onCancel={() =>
            view.campaign ? setView({ name: "detail", campaignId: String(view.campaign.id) }) : toLanding()
          }
          onSaved={(saved) => setView({ name: "detail", campaignId: String(saved.id) })}
        />
      )}

      {view.name === "detail" && (
        <ReviewCampaignDetail
          campaignId={view.campaignId}
          onBack={toLanding}
          onEdit={(campaign) => setView({ name: "builder", campaign })}
          onReviewManagement={() => setView({ name: "management" })}
        />
      )}

      {view.name === "management" && (
        <ReviewManagement onBack={toLanding} initialProductFilter={managementFilter} />
      )}
    </div>
  );
}
