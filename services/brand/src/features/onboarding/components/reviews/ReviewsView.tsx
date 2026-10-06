import { useMemo, useState } from "react";
import ReviewsLanding from "./ReviewsLanding";
import ReviewDetails from "./ReviewDetails";
import CreateReviewStep1 from "./CreateReviewStep1";
import CreateReviewStep2 from "./CreateReviewStep2";
import CreateReviewStep3 from "./CreateReviewStep3";
import CreateReviewStep5 from "./CreateReviewStep5";
import ReviewManagement from "../reviews-management/ReviewManagement";
import { ApiRecord } from "@/lib/api/backendApi";
import { useBrandApiStore } from "@/stores/useBrandApiStore";
import { toNumber } from "../../utils/backendMappers";

interface CampaignItem {
  id: string;
  name: string;
  createdDate: string;
  status: "Active" | "Paused";
  reviews: number;
  todayReviews: number;
  spend: number;
  productId?: string;
  productImageUrl?: string;
}

const mapCampaign = (campaign: ApiRecord): CampaignItem => ({
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
  status: String(campaign.status).toLowerCase() === "active" ? "Active" : "Paused",
  reviews: Array.isArray(campaign.prompts) ? campaign.prompts.length : 0,
  todayReviews: 0,
  spend: toNumber(campaign.daily_budget),
});

const parseMoney = (value: string) => {
  const amount = Number(value.replace(/[^0-9.]/g, ""));
  return Number.isFinite(amount) && amount > 0 ? amount : 2;
};

export default function ReviewsView() {
  const [step, setStep] = useState<0 | 1 | 2 | 3 | 5 | 6 | 7>(0);
  const [selectedCamp, setSelectedCamp] = useState<CampaignItem | null>(null);
  const [submitError, setSubmitError] = useState("");
  const apiCampaigns = useBrandApiStore((state) => state.reviewCampaigns);
  const apiProducts = useBrandApiStore((state) => state.products);
  const apiReviews = useBrandApiStore((state) => state.reviews);
  const createReviewCampaign = useBrandApiStore((state) => state.createReviewCampaign);

  const [draft, setDraft] = useState({
    name: "",
    description: "",
    isActive: true,
    selectedIds: [] as string[],
    reward: "$2.00 Cashback",
    budget: 100,
  });

  const handleCreateNewClick = () => {
    setDraft({
      name: "",
      description: "",
      isActive: true,
      selectedIds: [],
      reward: "$2.00 Cashback",
      budget: 100,
    });
    setSubmitError("");
    setStep(1);
  };

  const handlePublish = async () => {
    try {
      setSubmitError("");
      await createReviewCampaign({
        name: draft.name || "Untitled Review Campaign",
        description: draft.description,
        productIds: draft.selectedIds,
        dailyBudget: draft.budget,
        rewardAmount: parseMoney(draft.reward),
        isActive: draft.isActive,
      });
      setStep(0);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Could not publish review campaign.");
    }
  };

  const reviewedProductRows = useMemo(() => {
    const byProduct = new Map<string, CampaignItem>();
    apiReviews.forEach((review) => {
      const productId = String(review.product_id ?? review.product ?? "");
      const productName = String(review.product_name ?? "Product reviews");
      const key = productId || productName;
      const existing = byProduct.get(key);
      const createdAt = typeof review.created_at === "string" ? review.created_at : "";
      const createdDate = createdAt
        ? new Date(createdAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        : "";

      if (existing) {
        existing.reviews += 1;
        return;
      }

      byProduct.set(key, {
        id: key,
        name: productName,
        createdDate,
        status: "Active",
        reviews: 1,
        todayReviews: 0,
        spend: 0,
        productId,
        productImageUrl: typeof review.product_image_url === "string" ? review.product_image_url : "",
      });
    });
    return Array.from(byProduct.values());
  }, [apiReviews]);
  const campaigns = apiCampaigns.length ? apiCampaigns.map(mapCampaign) : reviewedProductRows;
  const selectableProducts = apiProducts.map((product) => ({
    id: product.id,
    name: product.name,
    category: product.category,
    imageSrc: product.imageSrc,
  }));
  const selectedProducts = selectableProducts.filter((product) =>
    draft.selectedIds.includes(product.id)
  );

  return (
    <div className="w-full">
      {step === 0 && (
        <ReviewsLanding
          campaigns={campaigns}
          onCreateNew={handleCreateNewClick}
          onViewDetail={(camp) => { setSelectedCamp(camp); setStep(6); }}
          onReviewManagement={() => setStep(7)}
        />
      )}
      {submitError && (
        <div className="mb-4 bg-red-50 border border-red-100 text-red-700 text-sm font-semibold rounded-xl px-4 py-3">
          {submitError}
        </div>
      )}

      {step === 1 && (
        <CreateReviewStep1
          initialData={draft}
          onCancel={() => setStep(0)}
          onContinue={(data) => { setDraft({ ...draft, ...data }); setStep(2); }}
        />
      )}

      {step === 2 && (
        <CreateReviewStep2
          initialSelectedIds={draft.selectedIds}
          products={selectableProducts}
          onBack={() => setStep(1)}
          onContinue={(ids) => { setDraft({ ...draft, selectedIds: ids }); setStep(3); }}
        />
      )}

      {step === 3 && (
        <CreateReviewStep3
          onBack={() => setStep(2)}
          onContinue={(reward, budget) => { setDraft({ ...draft, reward, budget }); setStep(5); }}
        />
      )}

      {step === 5 && (
        <CreateReviewStep5
          draftData={{
            name: draft.name,
            description: draft.description,
            isActive: draft.isActive,
            reward: draft.reward,
            budget: draft.budget,
            selectedCount: draft.selectedIds.length,
          }}
          selectedProducts={selectedProducts}
          onBack={() => setStep(3)}
          onPublish={handlePublish}
        />
      )}

      {step === 6 && selectedCamp && (
        <ReviewDetails campaign={selectedCamp} onBack={() => setStep(0)} />
      )}

      {step === 7 && (
        <ReviewManagement onBack={() => setStep(0)} />
      )}
    </div>
  );
}
