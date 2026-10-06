/* eslint-disable @next/next/no-img-element */
interface ProductItem {
  id: string;
  name: string;
  brand?: string;
  description?: string;
  category: string;
  imageSrc: string;
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

interface CreateCampaignStep4Props {
  onBack: () => void;
  onPublish: () => void;
  isPublishing?: boolean;
  publishLabel?: string;
  draftData: CampaignDraft;
  selectedProducts: ProductItem[];
  tiers: RewardTier[];
}

const steps = [
  { step: "1", title: "Basic Info" },
  { step: "2", title: "Products" },
  { step: "3", title: "Budget & Offers" },
  { step: "4", title: "Review & publish" },
];

export default function CreateCampaignStep4({
  onBack,
  onPublish,
  isPublishing = false,
  publishLabel = "Publish Campaign",
  draftData,
  selectedProducts,
  tiers,
}: CreateCampaignStep4Props) {
  const fallbackReward = Number(draftData.fallback?.rewardAmount ?? 2).toFixed(2);
  const activeTiers = tiers.filter((tier) => tier.allocation > 0);
  const displayStart = draftData.startDate || "No start date";
  const displayEnd = draftData.endDate || "No end date";

  return (
    <div className="w-full max-w-[1120px] mx-auto flex flex-col gap-6 px-4 md:px-8 py-6 font-manrope text-left">
      <div className="relative grid grid-cols-4 items-start gap-2 w-full max-w-[920px] mx-auto py-3">
        <div className="absolute left-[12.5%] right-[12.5%] top-[31px] h-[2px] bg-[#EAEDFF]"></div>
        <div className="absolute left-[12.5%] w-[75%] top-[31px] h-[2px] bg-[#001BD2]"></div>
        {steps.map((item) => {
          const isCurrent = item.step === "4";
          return (
            <div key={item.step} className="relative z-10 flex flex-col items-center gap-2 min-w-0">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${
                  isCurrent
                    ? "bg-[#001BD2] text-white shadow-[0_0_0_8px_#DFE0FF]"
                    : "bg-[#DAE2FD] text-[#454656]"
                }`}
              >
                {item.step}
              </div>
              <span
                className={`text-[11px] font-semibold text-center leading-tight ${
                  isCurrent ? "text-[#001BD2]" : "text-[#454656]/70"
                }`}
              >
                {item.title}
              </span>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start">
        <div className="flex flex-col gap-6 min-w-0">
          <section className="bg-white shadow-sm rounded-3xl overflow-hidden border border-[#EAEDFF]">
            <div className="bg-[#F2F3FF] px-6 md:px-8 py-4 border-b border-[#EAEDFF]">
              <h3 className="font-jakarta font-bold text-lg text-[#131B2E]">
                Campaign Identity
              </h3>
            </div>
            <div className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-[160px_minmax(0,1fr)] gap-6 items-center">
              <div className="w-full aspect-square rounded-2xl bg-[#EAEDFF] overflow-hidden flex items-center justify-center">
                <img
                  src={draftData.imageSrc || "/Rebate/bannerPreviewImage.svg"}
                  alt={draftData.name || "Campaign creative"}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="min-w-0 flex flex-col gap-2">
                <span className="text-sm font-bold text-[#001BD2] tracking-[1.4px] uppercase">
                  {draftData.isActive ? "Active campaign" : "Paused campaign"}
                </span>
                <h4 className="text-2xl md:text-3xl font-extrabold text-[#131B2E] truncate">
                  {draftData.name || "Untitled Rebate Campaign"}
                </h4>
                <p className="text-sm text-[#454656] leading-6 line-clamp-2">
                  {draftData.description || "No campaign description added."}
                </p>
                <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-[#454656] font-medium">
                  <span>{displayStart} - {displayEnd}</span>
                  <span className="w-1.5 h-1.5 bg-[#C5C5D9] rounded-full"></span>
                  <span>Global Region</span>
                </div>
              </div>
            </div>
          </section>

          <section className="bg-white shadow-sm rounded-3xl overflow-hidden border border-[#EAEDFF]">
            <div className="bg-[#F2F3FF] px-6 md:px-8 py-4 border-b border-[#EAEDFF] flex items-center justify-between gap-4">
              <h3 className="font-jakarta font-bold text-lg text-[#131B2E]">
                Selected Product
              </h3>
              <span className="text-xs font-bold text-[#454656]">
                {selectedProducts.length === 1 ? "1 Product Managed" : "No Product Selected"}
              </span>
            </div>
            <div className="p-6 md:p-8 grid grid-cols-1 lg:grid-cols-2 gap-5">
              {selectedProducts.map((product) => (
                <article
                  key={product.id}
                  className="min-h-[184px] rounded-2xl bg-[#FAF8FF] border border-[#EAEDFF] p-5 grid grid-cols-[96px_minmax(0,1fr)] gap-5 items-start"
                >
                  <div className="w-24 h-24 bg-white border border-[#C5C5D9]/10 rounded-2xl flex items-center justify-center overflow-hidden">
                    <img
                      src={product.imageSrc}
                      alt={product.name}
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div className="min-w-0 flex flex-col gap-1">
                    <h4 className="text-base font-bold text-[#131B2E] truncate">
                      {product.name}
                    </h4>
                    <p className="text-xs font-bold text-[#001BD2] uppercase truncate">
                      {product.brand || product.category || "Brand not set"}
                    </p>
                    <p className="text-xs text-[#454656] leading-5 line-clamp-3">
                      {product.description || "No product description added."}
                    </p>
                  </div>
                </article>
              ))}
              {selectedProducts.length === 0 && (
                <div className="rounded-2xl bg-[#FAF8FF] border border-dashed border-[#C5C5D9] p-8 text-center text-sm font-semibold text-slate-400">
                  No products selected.
                </div>
              )}
            </div>
          </section>
        </div>

        <aside className="flex flex-col gap-6 min-w-0">
          <section className="bg-white border border-[#001BD2]/10 shadow-sm rounded-3xl overflow-hidden">
            <div className="bg-[#001BD2]/5 px-6 py-4 flex items-center gap-2 border-b border-[#001BD2]/10">
              <img src="/Rebate/budgetAndTier.svg" alt="Budget" className="w-[19px] h-[18px] object-contain" />
              <h3 className="font-jakarta font-bold text-lg text-[#001BD2]">
                Budget & Tiers
              </h3>
            </div>
            <div className="p-6 flex flex-col gap-6">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-[#454656] tracking-[0.7px] uppercase">
                  Daily Allocation
                </span>
                <span className="text-4xl font-extrabold text-[#131B2E] leading-none">
                  ${Number(draftData.dailyBudget ?? 150).toFixed(2)}
                </span>
              </div>
              <div className="flex flex-col gap-4">
                {activeTiers.map((tier, index) => (
                  <div key={tier.id} className="relative border-l-2 border-[#2D3FEA] pl-5 min-w-0">
                    <div className="absolute w-2 h-2 rounded-full bg-[#001BD2] -left-[5px] top-1"></div>
                    <span className="text-[11px] font-bold text-[#454656] uppercase block truncate">
                      {tier.name || `Tier ${index + 1}`}
                    </span>
                    <div className="flex items-center justify-between gap-2 mt-1">
                      <span className="text-base font-bold text-[#131B2E] truncate">
                        {tier.reward} / {tier.allocation}%
                      </span>
                      {index === 0 && (
                        <span className="bg-[#D0E1FB] text-[#505F76] text-[9px] font-bold px-2 py-0.5 rounded-lg uppercase shrink-0">
                          Optimal
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="bg-[#131B2E] shadow-xl rounded-3xl p-6 flex flex-col gap-5">
            <div className="flex justify-between items-center gap-4">
              <h3 className="font-jakarta font-bold text-lg text-white">
                Fallback
              </h3>
              <span className="bg-[#001BD2] text-white text-[10px] font-black px-3 py-1 rounded-full uppercase">
                {draftData.fallback?.isEnabled ? "Enabled" : "Disabled"}
              </span>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <span className="text-xs text-white/60">Standard Reward</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl font-black text-white">${fallbackReward}</span>
                <span className="text-sm font-medium text-white/40">Fixed Amount</span>
              </div>
            </div>
            <p className="text-xs text-white/50 leading-5 italic line-clamp-3">
              {draftData.fallback?.description ||
                "Fallback offers ensure customer satisfaction when primary tier inventory is depleted."}
            </p>
          </section>
        </aside>
      </div>

      <div className="w-full border-t border-[#C5C5D9]/10 py-6 flex flex-col md:flex-row justify-center items-center gap-4">
        <button
          onClick={onPublish}
          disabled={isPublishing}
          className="relative w-full max-w-[260px] h-[56px] bg-gradient-to-r from-[#001BD2] to-[#2D3FEA] text-white font-extrabold text-base rounded-full transition-all shadow-[0px_25px_50px_-12px_rgba(0,27,210,0.3)] hover:opacity-90 active:scale-[0.98] cursor-pointer flex items-center justify-center disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPublishing ? "Saving..." : publishLabel}
        </button>
        <button onClick={onBack} className="text-xs font-bold text-[#757688] hover:underline cursor-pointer">
          Go back and edit
        </button>
      </div>
    </div>
  );
}
