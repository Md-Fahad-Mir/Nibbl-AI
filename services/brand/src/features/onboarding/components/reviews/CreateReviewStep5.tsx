/* eslint-disable @next/next/no-img-element */
"use client";

import ReviewsStepper from "./ReviewsStepper";
import ReviewsCampaignIdentity from "./ReviewsCampaignIdentity";
import ReviewsSurveySummary from "./ReviewsSurveySummary";
import FinancialsCard from "./FinancialsCard";
import ReviewsFooter from "./ReviewsFooter";

interface CreateReviewStep5Props {
  draftData: {
    name: string;
    description: string;
    isActive: boolean;
    reward: string;
    budget: number;
    selectedCount: number;
  };
  selectedProducts: { id: string; name: string; category: string; imageSrc: string }[];
  onBack: () => void;
  onPublish: () => void;
}

export default function CreateReviewStep5({
  draftData,
  selectedProducts,
  onBack,
  onPublish,
}: CreateReviewStep5Props) {
  return (
    <div className="flex flex-col gap-8 w-full animate-slide-up text-left font-manrope">
      <ReviewsStepper activeStep={5} />

      <div className="flex flex-col gap-2">
        <h2 className="text-3xl font-extrabold font-jakarta text-[#131B2E] tracking-tight">
          Review Your Campaign
        </h2>
        <p className="text-base text-[#454656] font-medium leading-relaxed max-w-[700px]">
          Please ensure all financial and product details are accurate before proceeding to go live.
          Once published, the budget will be reserved for immediate distribution.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 items-start w-full">
        <div className="flex-1 flex flex-col gap-6 w-full">
          <ReviewsCampaignIdentity name={draftData.name} description={draftData.description} />

          <div className="w-full bg-white shadow-[0px_1px_2px_rgba(0,0,0,0.05)] rounded-xl overflow-hidden flex flex-col flex-shrink-0">
            <div className="bg-[#F2F3FF] px-8 py-4 flex items-center gap-2 border-b border-[#EAEDFF]">
              <h3 className="font-jakarta font-bold text-base text-[#131B2E]">
                Selected Products
              </h3>
            </div>
            <div className="p-8 flex flex-row gap-6 overflow-x-auto w-full">
              {selectedProducts.map((product) => (
                <div
                  key={product.id}
                  className="w-[256px] h-[308px] bg-[#FAF8FF] rounded-lg p-3 flex flex-col gap-3 flex-shrink-0 border border-slate-100"
                >
                  <div className="w-full h-[232px] bg-[#DAE2FD] rounded-md overflow-hidden flex items-center justify-center">
                    <img
                      src={product.imageSrc}
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex flex-col text-left">
                    <h4 className="text-base font-bold text-[#131B2E] truncate">
                      {product.name}
                    </h4>
                    <span className="text-xs text-[#454656] mt-0.5">
                      {product.category}
                    </span>
                  </div>
                </div>
              ))}
              {selectedProducts.length === 0 && (
                <div className="w-full p-8 text-center text-sm font-semibold text-slate-400">
                  No products selected.
                </div>
              )}
            </div>
          </div>

          <ReviewsSurveySummary />
        </div>

        <div className="w-full lg:w-[359.33px] flex-shrink-0">
          <FinancialsCard dailyBudget={draftData.budget} />
        </div>
      </div>

      <ReviewsFooter
        leftElement={
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#ACEDFF] text-[#001F26] rounded-full flex items-center justify-center text-sm font-bold">
              OK
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-[#131B2E]">
                Everything looks good. Ready to go live?
              </span>
              <span className="text-xs text-[#454656] font-medium mt-0.5">
                Campaign verified against current inventory and credit limits.
              </span>
            </div>
          </div>
        }
        rightElement={
          <>
            <button
              onClick={onBack}
              className="px-8 h-11 bg-[#E2E7FF] hover:bg-[#D0D7FF] text-[#001BD2] font-bold text-sm rounded-full transition-all border-none cursor-pointer flex items-center justify-center"
            >
              Save as Draft
            </button>
            <button
              onClick={onPublish}
              className="px-8 h-11 bg-gradient-to-r from-[#001BD2] to-[#2D3FEA] hover:opacity-95 text-white font-extrabold text-sm rounded-full shadow-[0px_12px_24px_rgba(0,27,210,0.2)] transition-all border-none cursor-pointer flex items-center justify-center"
            >
              Publish Review Campaign
            </button>
          </>
        }
      />
    </div>
  );
}
