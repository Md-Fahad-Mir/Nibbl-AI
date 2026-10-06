/* eslint-disable @next/next/no-img-element */
"use client";

import { useMemo } from "react";
import { ApiRecord } from "@/lib/api/backendApi";
import { useBrandApiStore } from "@/stores/useBrandApiStore";
import { formatDate, formatInteger, formatMoney, toNumber } from "../../utils/backendMappers";

interface Product {
  id: string;
  name: string;
  description?: string;
  brand?: string;
  imageSrc: string;
  category: string;
  flavor: string;
  format: string;
  size: string;
  sku?: string;
  aliases: string[];
  activeCampaigns: number;
}
interface ProductDetailsProps {
  product: Product;
  onBack: () => void;
  onEditProduct: (prod: Product) => void | Promise<void>;
  onEditAliases: (prod: Product) => void | Promise<void>;
  onDelete: (prodId: string) => void;
  onViewAllCampaigns: (type: "REBATE" | "REVIEW") => void;
}

const campaignId = (campaign: ApiRecord) =>
  String(campaign.id ?? campaign.campaign_id ?? "");

const productIdsForCampaign = (campaign: ApiRecord) => {
  const rawProducts = campaign.products ?? campaign.product ?? campaign.product_ids;
  const products = Array.isArray(rawProducts) ? rawProducts : rawProducts ? [rawProducts] : [];

  return new Set(
    products
      .map((item) => {
        if (item && typeof item === "object" && "id" in item) {
          return String((item as { id: unknown }).id);
        }
        return String(item || "");
      })
      .filter(Boolean)
  );
};

const isActiveCampaign = (campaign: ApiRecord) =>
  String(campaign.status ?? "").toLowerCase() === "active";

export default function ProductDetailsView({
  product,
  onBack,
  onEditProduct,
  onEditAliases,
  onDelete,
  onViewAllCampaigns,
}: ProductDetailsProps) {
  const campaigns = useBrandApiStore((state) => state.campaigns);
  const reviewCampaigns = useBrandApiStore((state) => state.reviewCampaigns);
  const analyticsCampaigns = useBrandApiStore((state) => state.analyticsCampaigns);
  const relatedCampaigns = useMemo(() => {
    const analyticsByCampaign = new Map(
      analyticsCampaigns.map((row) => [String(row.campaign_id), row])
    );
    const rebateRows = campaigns
      .filter((campaign) => isActiveCampaign(campaign) && productIdsForCampaign(campaign).has(product.id))
      .map((campaign) => {
        const metrics = analyticsByCampaign.get(campaignId(campaign));
        const approvals = toNumber(metrics?.approvals);
        const redemptions = toNumber(metrics?.redemptions);
        return {
          id: campaignId(campaign),
          name: String(campaign.name ?? "Untitled rebate campaign"),
          type: "REBATE" as const,
          subText: campaign.end_at ? `Ends ${formatDate(campaign.end_at)}` : "No expiration",
          metricLabel: "Participation",
          metricValue: `${formatInteger(approvals)} Purchases`,
          progress: Math.min(100, approvals ? Math.round((redemptions / approvals) * 100) : 0),
          iconSrc: "/ProductLibary/rebateIcon.svg",
          badgeClass: "bg-blue-50 text-[#001BD2]",
          barClass: "bg-[#001BD2]",
        };
      });

    const reviewRows = reviewCampaigns
      .filter((campaign) => isActiveCampaign(campaign) && productIdsForCampaign(campaign).has(product.id))
      .map((campaign) => {
        const promptCount = Array.isArray(campaign.prompts) ? campaign.prompts.length : 0;
        return {
          id: campaignId(campaign),
          name: String(campaign.name ?? "Untitled review campaign"),
          type: "REVIEW" as const,
          subText: "No expiration",
          metricLabel: "Reward",
          metricValue: `${formatMoney(campaign.reward_amount)} Reward`,
          progress: Math.min(100, promptCount * 20),
          iconSrc: "/ProductLibary/VerifyReview].svg",
          badgeClass: "bg-emerald-50 text-[#059669]",
          barClass: "bg-[#004956]",
        };
      });

    return [...rebateRows, ...reviewRows];
  }, [analyticsCampaigns, campaigns, product.id, reviewCampaigns]);
  const specs = [
    { label: "Category", val: product.category },
    { label: "Brand", val: product.brand || "Not set" },
    { label: "Flavor", val: product.flavor },
    { label: "Format", val: product.format },
    { label: "Size", val: product.size },
    { label: "SKU", val: product.sku || product.format || product.id },
  ];
  return (
    <div className="flex flex-col gap-8 w-full animate-slide-up">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-xs font-manrope font-semibold">
        <button onClick={onBack} className="text-slate-400 hover:text-slate-600 cursor-pointer">Product Library</button>
        <span className="text-slate-300">&gt;</span>
        <span className="text-[#001BD2]">{product.name}</span>
      </div>
      {/* Header Actions */}
      <div className="flex justify-between items-center w-full">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-extrabold font-jakarta text-[#131B2E] tracking-tight">{product.name}</h1>
          <span className="bg-[#ECFDF5] text-[#059669] text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5 uppercase">
            <span className="w-1.5 h-1.5 bg-[#10B981] rounded-full"></span>Active
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => onDelete(product.id)} className="px-6 h-11 bg-[#001BD2] hover:bg-blue-700 text-white font-bold text-sm rounded-full transition-colors active:scale-[0.98] cursor-pointer">Delete</button>
          <button onClick={() => onEditProduct(product)} className="px-6 h-11 bg-white hover:bg-slate-50 text-[#001BD2] border border-[#001BD2]/20 font-bold text-sm rounded-full transition-colors active:scale-[0.98] cursor-pointer flex items-center gap-2">
            <img src="/ProductLibary/editIcon.svg" alt="Edit" className="w-[14px] h-[14px] object-contain" />Edit Product
          </button>
        </div>
      </div>
      {/* Two Columns Grid */}
      <div className="flex flex-col lg:flex-row gap-8 items-start w-full">
        {/* Left Column */}
        <div className="flex-grow flex flex-col gap-6 w-full lg:max-w-[60%]">
          {/* Visual Image Card */}
          <div className="bg-white border border-slate-100 rounded-[20px] shadow-sm overflow-hidden w-full h-[420px] md:h-[460px] grid grid-rows-[minmax(0,1fr)_auto]">
            <div className="min-h-0 w-full bg-gradient-to-b from-slate-50 to-white flex items-center justify-center p-6">
              <img
                src={product.imageSrc}
                alt={product.name}
                className="block max-h-full max-w-full object-contain"
              />
            </div>
            <div className="border-t border-slate-100 bg-white px-6 py-4 flex flex-col gap-2 items-start">
              <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-3 py-1 rounded uppercase tracking-wider">BEST SELLER</span>
              <h2 className="text-lg md:text-xl font-bold text-slate-800 tracking-tight leading-snug">
                Premium {product.flavor || "Product"} Variant
              </h2>
            </div>
          </div>
          {/* Product Description */}
          <div className="bg-white border border-slate-100 rounded-[20px] p-8 shadow-sm flex flex-col gap-4">
            <div className="flex items-center gap-2 text-sm font-bold text-[#131B2E]">
              <img src="/ProductLibary/ProductDescription].svg" alt="Description" className="w-5 h-5 object-contain" />
              <span>Product Description</span>
            </div>
            <p className="text-sm font-manrope text-[#454656] leading-[1.62] font-medium">
              {product.description ||
                `Our ${product.name} is crafted with a dedication to simplicity and quality. Each batch is carefully processed to ensure the perfect quality and premium texture. Using only clean, high-quality ingredients, we deliver a timeless snacking and lifestyle experience for customers.`}
            </p>
          </div>
          {/* Technical Specifications */}
          <div className="bg-white border border-slate-100 rounded-[20px] p-8 shadow-sm flex flex-col gap-6">
            <div className="flex items-center gap-2 text-sm font-bold text-[#131B2E]">
              <img src="/ProductLibary/technicalSpecificaiton.svg" alt="Specs" className="w-5 h-5 object-contain" />
              <span>Technical Specifications</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6 font-manrope">
              {specs.map((spec, idx) => (
                <div key={idx} className="bg-[#FAF8FF] p-4 rounded-xl flex flex-col gap-1 border border-[#C5C5D9]/10">
                  <span className="text-[10px] font-bold text-[#454656]/60 uppercase tracking-wider">{spec.label}</span>
                  <span className="text-sm font-extrabold text-[#131B2E]">{spec.val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* Right Column */}
        <div className="w-full lg:max-w-[40%] flex flex-col gap-6">
          {/* Active Campaigns */}
          <div className="bg-white border border-slate-100 rounded-[20px] p-6 shadow-sm flex flex-col gap-6 w-full">
            <div className="flex justify-between items-center">
              <h2 className="text-base font-bold text-[#131B2E]">Active Campaigns</h2>
              <button
                type="button"
                onClick={() => onViewAllCampaigns(relatedCampaigns[0]?.type ?? "REBATE")}
                disabled={relatedCampaigns.length === 0}
                className="text-xs font-bold text-[#001BD2] hover:underline cursor-pointer disabled:cursor-not-allowed disabled:text-slate-300 disabled:no-underline"
              >
                View All
              </button>
            </div>
            <div className="flex flex-col gap-5">
              {relatedCampaigns.slice(0, 3).map((campaign) => (
                <div key={`${campaign.type}-${campaign.id}`} className="border border-slate-100 p-4 rounded-xl flex flex-col gap-3 font-manrope bg-[#FAF8FF]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-[#E2E7FF] flex items-center justify-center flex-shrink-0">
                        <img src={campaign.iconSrc} alt={campaign.type} className="w-[18px] h-[18px] object-contain" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-bold text-[#131B2E] truncate">{campaign.name}</span>
                        <span className="text-[10px] text-[#64748B] font-medium">{campaign.subText}</span>
                      </div>
                    </div>
                    <span className={`${campaign.badgeClass} text-[9px] font-bold px-2 py-0.5 rounded`}>
                      {campaign.type}
                    </span>
                  </div>
                  <div className="flex justify-between items-center gap-4 text-xs font-semibold text-[#454656] pt-1">
                    <span>{campaign.metricLabel}</span>
                    <span className="text-[#131B2E] font-bold">{campaign.metricValue}</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden relative">
                    <div
                      className={`absolute left-0 top-0 bottom-0 ${campaign.barClass} rounded-full`}
                      style={{ width: `${campaign.progress}%` }}
                    ></div>
                  </div>
                </div>
              ))}
              {relatedCampaigns.length === 0 && (
                <div className="border border-dashed border-slate-200 p-6 rounded-xl text-center font-manrope bg-[#FAF8FF]">
                  <p className="text-sm font-bold text-[#131B2E]">No active campaigns</p>
                  <p className="text-xs text-[#64748B] mt-1">This product is not attached to an active campaign yet.</p>
                </div>
              )}
            </div>
          </div>
          {/* OCR Aliases */}
          <div className="bg-white border border-slate-100 rounded-[20px] p-6 shadow-sm flex flex-col gap-4 w-full">
            <div>
              <h2 className="text-base font-bold text-[#131B2E]">OCR Aliases</h2>
              <p className="text-[10px] text-[#64748B] font-medium mt-1 leading-normal">Recognized variations for receipt scanning</p>
            </div>
            <div className="flex flex-wrap gap-2 py-2">
              {product.aliases.map((alias) => (
                <div key={alias} className="bg-[#F2F3FF] text-[#001BD2] px-3 py-1 rounded-full text-xs font-semibold border border-slate-100">{alias}</div>
              ))}
            </div>
            <button onClick={() => onEditAliases(product)} className="w-full h-11 bg-[#E2E7FF] hover:bg-blue-100 text-[#001BD2] font-bold text-xs rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5 active:scale-[0.98] font-manrope">
              + Add Alias
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
