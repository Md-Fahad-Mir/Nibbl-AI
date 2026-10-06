import { useMemo, useState } from "react";
import RebatesLanding from "./RebatesLanding";
import CreateCampaignPublishPage from "./CreateCampaignPublishPage";
import AddCustomTierModal from "./AddCustomTierModal";
import { useBrandApiStore } from "@/stores/useBrandApiStore";
import { ApiRecord } from "@/lib/api/backendApi";
import { toNumber } from "../../utils/backendMappers";

interface Campaign {
  id: string;
  name: string;
  category: string;
  scope: string;
  dailyBudget: number;
  purchases: number;
  spendToday: number;
  status: "ACTIVE" | "PAUSED" | "COMPLETED";
}

interface RewardTier {
  id: string;
  name: string;
  structure: string;
  reward: string;
  maxPayout: string;
  minPurchase: string;
  allocation: number;
}

interface CampaignDraft {
  name: string;
  description?: string;
  imageSrc?: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  dailyBudget?: number;
  fallback?: {
    rewardAmount: string;
    isEnabled: boolean;
    description?: string;
  };
}

interface CampaignPublishPayload extends CampaignDraft {
  selectedProductIds: string[];
}

const initialTiers: RewardTier[] = [
  { id: "1", name: "01 Executive Peak", structure: "Free up to X", reward: "Free", maxPayout: "20", minPurchase: "50", allocation: 20 },
  { id: "2", name: "02 Mid-Tier Value", structure: "Dollar Off", reward: "$10 off", maxPayout: "10", minPurchase: "30", allocation: 30 },
  { id: "3", name: "03 Entry Level", structure: "Percent Off", reward: "10% off", maxPayout: "5", minPurchase: "15", allocation: 50 },
  { id: "4", name: "04 BOGO Deal", structure: "BOGO", reward: "BOGO", maxPayout: "15", minPurchase: "Min 2", allocation: 0 },
];

const statusMap = (status: unknown): Campaign["status"] => {
  const value = String(status || "").toUpperCase();
  if (value === "ACTIVE" || value === "PAUSED" || value === "COMPLETED") return value;
  return "PAUSED";
};

const campaignId = (campaign: ApiRecord) =>
  String(campaign.id ?? campaign.campaign_id ?? "");

const mapCampaign = (campaign: ApiRecord, metrics?: ApiRecord): Campaign => ({
  id: String(campaign.id),
  name: String(campaign.name ?? "Untitled rebate campaign"),
  category: String(campaign.product_name ?? "Products"),
  scope: String(campaign.description ?? "Backend campaign"),
  dailyBudget: toNumber(campaign.daily_budget),
  purchases: toNumber(metrics?.approvals ?? campaign.approvals ?? campaign.reservations),
  spendToday: toNumber(metrics?.total_spend ?? campaign.total_spend),
  status: statusMap(campaign.status),
});

const parseRewardAmount = (reward: string) => {
  const numeric = Number(reward.replace(/[^0-9.]/g, ""));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 1;
};

const dateInputValue = (value: unknown) => {
  if (typeof value !== "string" || !value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

const productIdsForCampaign = (campaign: ApiRecord) => {
  const rawProducts = campaign.products ?? campaign.product ?? campaign.product_ids;
  const products = Array.isArray(rawProducts) ? rawProducts : rawProducts ? [rawProducts] : [];

  return products
    .map((product) => {
      if (product && typeof product === "object" && "id" in product) {
        return String((product as { id: unknown }).id);
      }
      return String(product || "");
    })
    .filter(Boolean);
};

const tiersForCampaign = (campaign: ApiRecord): RewardTier[] => {
  const campaignTiers = Array.isArray(campaign.tiers) ? campaign.tiers : [];
  if (!campaignTiers.length) return initialTiers;

  return campaignTiers.map((tier, index) => {
    const record = tier as ApiRecord;
    const rewardAmount = String(record.reward_amount ?? "1");
    return {
      id: String(record.id ?? index + 1),
      name: `Tier ${index + 1}`,
      structure: "Dollar Off",
      reward: `$${rewardAmount} off`,
      maxPayout: rewardAmount,
      minPurchase: "",
      allocation: toNumber(record.allocation_percent),
    };
  });
};

export default function RebatesView() {
  const [step, setStep] = useState<0 | 1>(0);
  const [draftData, setDraftData] = useState<CampaignDraft>({
    name: "",
    description: "",
    imageSrc: "/Rebate/bannerPreviewImage.svg",
    startDate: "",
    endDate: "",
    isActive: true,
  });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [tiers, setTiers] = useState<RewardTier[]>(initialTiers);
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAddTierModal, setShowAddTierModal] = useState(false);
  const [editingTier, setEditingTier] = useState<RewardTier | null>(null);
  const [submitError, setSubmitError] = useState("");
  const [publishAccess, setPublishAccess] = useState<ApiRecord | null>(null);
  const apiCampaigns = useBrandApiStore((state) => state.campaigns);
  const analyticsCampaigns = useBrandApiStore((state) => state.analyticsCampaigns);
  const apiProducts = useBrandApiStore((state) => state.products);
  const createCampaign = useBrandApiStore((state) => state.createCampaign);
  const updateCampaign = useBrandApiStore((state) => state.updateCampaign);

  const stepProducts = apiProducts.map((product) => ({
    id: product.id,
    name: product.name,
    brand: product.brand || "",
    description: product.description || "",
    category: product.category,
    imageSrc: product.imageSrc,
  }));
  const campaigns = useMemo(() => {
    const metricsByCampaign = new Map(
      analyticsCampaigns.map((metrics) => [campaignId(metrics), metrics])
    );
    return apiCampaigns.map((campaign) =>
      mapCampaign(campaign, metricsByCampaign.get(campaignId(campaign)))
    );
  }, [analyticsCampaigns, apiCampaigns]);
  const handleCreateNewClick = () => {
    setDraftData({
      name: "",
      description: "",
      imageSrc: "/Rebate/bannerPreviewImage.svg",
      startDate: "",
      endDate: "",
      isActive: true,
    });
    setSelectedIds(stepProducts[0] ? [stepProducts[0].id] : []);
    setTiers(initialTiers);
    setEditingCampaignId(null);
    setPublishAccess(null);
    setSubmitError("");
    setStep(1);
  };

  const handleEditCampaign = (campaign: Campaign) => {
    const rawCampaign = apiCampaigns.find((item) => String(item.id) === campaign.id);
    if (!rawCampaign) return;
    const fallback = rawCampaign.fallback_offer as ApiRecord | undefined;
    setDraftData({
      name: String(rawCampaign.name ?? ""),
      description: String(rawCampaign.description ?? ""),
      imageSrc: typeof rawCampaign.image_url === "string" ? rawCampaign.image_url : "/Rebate/bannerPreviewImage.svg",
      startDate: dateInputValue(rawCampaign.start_at),
      endDate: dateInputValue(rawCampaign.end_at),
      isActive: String(rawCampaign.status ?? "").toLowerCase() === "active",
      dailyBudget: toNumber(rawCampaign.daily_budget),
      fallback: fallback
        ? {
            rewardAmount: String(fallback.reward_amount ?? ""),
            isEnabled: Boolean(fallback.is_enabled),
            description: String(fallback.description ?? ""),
          }
        : undefined,
    });
    setSelectedIds(productIdsForCampaign(rawCampaign));
    setTiers(tiersForCampaign(rawCampaign));
    setEditingCampaignId(campaign.id);
    setPublishAccess(null);
    setSubmitError("");
    setStep(1);
  };

  const handlePublishCampaign = async (payload: CampaignPublishPayload) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      setSubmitError("");
      setDraftData({
        name: payload.name,
        description: payload.description,
        imageSrc: payload.imageSrc,
        startDate: payload.startDate,
        endDate: payload.endDate,
        isActive: payload.isActive,
        dailyBudget: payload.dailyBudget,
        fallback: payload.fallback,
      });
      setSelectedIds(payload.selectedProductIds);
      const campaignPayload = {
        name: payload.name || "Untitled Rebate Campaign",
        description: payload.description,
        productIds: payload.selectedProductIds,
        dailyBudget: payload.dailyBudget ?? 150,
        startAt: payload.startDate ? new Date(payload.startDate).toISOString() : undefined,
        endAt: payload.endDate ? new Date(payload.endDate).toISOString() : undefined,
        isActive: payload.isActive,
        fallback: payload.fallback,
        tiers: tiers
          .filter((tier) => tier.allocation > 0)
          .map((tier) => ({
            rewardAmount: parseRewardAmount(tier.maxPayout || tier.reward),
            allocationPercent: tier.allocation,
          })),
      };
      let access: ApiRecord | undefined;
      if (editingCampaignId) {
        access = await updateCampaign(editingCampaignId, campaignPayload);
      } else {
        access = await createCampaign(campaignPayload);
        const savedCampaignId = access?.campaign_id ?? (access?.campaign as ApiRecord | undefined)?.id;
        if (savedCampaignId) setEditingCampaignId(String(savedCampaignId));
      }
      if (access) setPublishAccess(access);
      return access;
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Could not save campaign.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddTier = (newTier: Omit<RewardTier, "id">) => {
    const freshTier: RewardTier = { id: String(tiers.length + 1), ...newTier };
    setTiers([...tiers, freshTier]);
    setShowAddTierModal(false);
  };

  const handleUpdateTier = (updatedTier: Omit<RewardTier, "id">) => {
    if (!editingTier) return;
    setTiers(
      tiers.map((tier) =>
        tier.id === editingTier.id ? { id: editingTier.id, ...updatedTier } : tier
      )
    );
    setEditingTier(null);
  };

  return (
    <div className="w-full">
      {step === 0 && (
        <RebatesLanding campaigns={campaigns} onCreateNew={handleCreateNewClick} onEditCampaign={handleEditCampaign} />
      )}
      {submitError && (
        <div className="mb-4 bg-red-50 border border-red-100 text-red-700 text-sm font-semibold rounded-xl px-4 py-3">
          {submitError}
        </div>
      )}
      {step === 1 && (
        <CreateCampaignPublishPage
          mode={editingCampaignId ? "edit" : "create"}
          initialData={draftData}
          products={stepProducts}
          initialSelectedIds={selectedIds}
          tiers={tiers}
          accessData={publishAccess}
          isPublishing={isSubmitting}
          onCancel={() => setStep(0)}
          onPublish={handlePublishCampaign}
          onAddCustomTierClick={() => setShowAddTierModal(true)}
          onEditTierClick={setEditingTier}
        />
      )}
      {showAddTierModal && (
        <AddCustomTierModal onClose={() => setShowAddTierModal(false)} onAdd={handleAddTier} />
      )}
      {editingTier && (
        <AddCustomTierModal
          mode="edit"
          initialTier={editingTier}
          onClose={() => setEditingTier(null)}
          onAdd={handleUpdateTier}
        />
      )}
    </div>
  );
}
