"use client";

import { useState } from "react";
import Image from "next/image";
import { imageUrl } from "../lib/offerMappers";

interface ProductOffer {
  id: number | string;
  campaignId?: string;
  brand: string;
  expires: string;
  title: string;
  rating: number;
  reviewsCount: number;
  discount: string;
  image: string | null;
  category: string;
}

interface RewardsSectionProps {
  offers?: Record<string, unknown>[];
  categories?: string[];
  activeCategory?: string;
  isLoading?: boolean;
  error?: string | null;
  pagination?: {
    count: number;
    next: string | null;
    previous: string | null;
    page: number;
    pageSize: number;
  };
  onCategoryChange?: (category: string) => void;
  onPageChange?: (page: number) => void;
  onClaimOffer?: (campaignId?: string) => void;
  onViewOffer?: (campaignId?: string) => void;
}

const offerImage = (value: unknown) =>
  imageUrl(value, "") || null;

const discountText = (offer: Record<string, unknown>) =>
  String(offer.discount_label || (offer.reward_amount ? `$${offer.reward_amount}` : ""));

const normalizeCategory = (value: string) => value.trim().toLowerCase();

const formatCategoryLabel = (value: string) => {
  if (normalizeCategory(value) === "all") return "All";

  return value
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const mapOffer = (offer: Record<string, unknown>, index: number): ProductOffer => ({
  id: String(offer.campaign_id ?? offer.id ?? index),
  campaignId: String(offer.campaign_id ?? offer.id ?? ""),
  brand: String(offer.brand_name ?? offer.brand ?? ""),
  expires: String(offer.end_at ?? offer.expires ?? "").slice(0, 10),
  title: String(offer.product_name ?? offer.name ?? ""),
  rating: Number(offer.rating ?? 0),
  reviewsCount: Number(offer.review_count ?? 0),
  discount: discountText(offer),
  image: offerImage(offer.product_image),
  category: String(offer.category ?? ""),
});

export default function RewardsSection({
  offers,
  categories: categoryOptions,
  activeCategory,
  isLoading = false,
  error,
  pagination,
  onCategoryChange,
  onPageChange,
  onClaimOffer,
  onViewOffer,
}: RewardsSectionProps) {
  const [localActiveCategory, setLocalActiveCategory] = useState<string>("All");

  const sourceOffers = (offers || []).map(mapOffer);
  const selectedCategory = activeCategory || localActiveCategory;
  const categoryValues = [
    "All",
    ...(categoryOptions?.length
      ? categoryOptions
      : sourceOffers.map((offer) => offer.category)),
  ].filter((category) => category.trim());
  const categories = Array.from(
    new Map(
      categoryValues.map((category) => [normalizeCategory(category), category])
    ).values()
  );
  const currentPage = pagination?.page || 1;
  const pageSize = pagination?.pageSize || Math.max(sourceOffers.length, 1);
  const totalItems = pagination?.count || sourceOffers.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const canGoBack = Boolean(pagination?.previous) || currentPage > 1;
  const canGoNext = Boolean(pagination?.next) || currentPage < totalPages;
  const pages = Array.from(new Set([1, currentPage, totalPages]))
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((a, b) => a - b);

  const filteredOffers = normalizeCategory(selectedCategory) === "all"
    ? sourceOffers
    : sourceOffers.filter(
        (offer) =>
          normalizeCategory(offer.category) === normalizeCategory(selectedCategory)
      );

  return (
    <div className="w-full max-w-[1137px] mx-auto font-sans flex flex-col gap-6">
      {/* Title & Filters Column */}
      <div className="flex flex-col items-start gap-4">
        {/* Title */}
        <h2 className="text-[24px] font-semibold leading-[29px] text-[#1F1D1D]">
          Your Rewards
        </h2>

        {/* Filter Categories (Frame 2147229006) */}
        <div className="flex items-center gap-[24px] overflow-x-auto py-1 scrollbar-none w-full">
          {categories.map((cat) => {
            const isActive =
              normalizeCategory(selectedCategory) === normalizeCategory(cat);

            return (
              <button
                key={cat}
                type="button"
                aria-pressed={isActive}
                onClick={() => {
                  setLocalActiveCategory(cat);
                  onCategoryChange?.(cat);
                }}
                className={`h-[27px] min-w-[39px] max-w-[160px] rounded-[36px] px-4 flex items-center justify-center text-xs font-normal transition-all cursor-pointer flex-shrink-0 focus:outline-none ${
                  isActive
                    ? "bg-[#3E3EDF] text-[#FEFEFE] shadow-[0_4px_4px_rgba(0,0,0,0.08)]"
                    : "bg-[#FEFEFE] text-[#575757] border border-[#707070] shadow-[0_4px_4px_rgba(0,0,0,0.08)]"
                }`}
              >
                <span className="truncate">{formatCategoryLabel(cat)}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Products Grid (Frame 2147229128 layout) */}
      {isLoading ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-100 text-gray-500">
          Loading rewards...
        </div>
      ) : error ? (
        <div className="text-center py-12 bg-white rounded-xl border border-red-100 text-red-500">
          {error}
        </div>
      ) : filteredOffers.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-100 text-gray-400">
          No rewards found from the backend.
        </div>
      ) : (
        <div className="grid w-full grid-cols-1 justify-items-center gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {filteredOffers.map((offer) => (
            <div
              key={offer.id}
              className="w-full max-w-[335px] h-[320px] bg-[#FFFFFF] shadow-[0px_2px_4px_rgba(0,0,0,0.12)] rounded-[14px] flex flex-col relative overflow-hidden"
            >
              {/* Product Image Section (Mask group + Rectangle 34628211) */}
              <div className="w-full h-[180px] bg-[#D9D9D9] rounded-t-[10px] relative overflow-hidden flex-shrink-0">
                {offer.image ? (
                  <Image
                    src={offer.image}
                    alt={offer.title || "Backend offer image"}
                    fill
                    sizes="(max-w-[335px]) 100vw, 335px"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gray-100 text-xs text-gray-500">
                    No image returned
                  </div>
                )}
                
                {/* Discount Badge */}
                {offer.discount && (
                  <span className="absolute right-4 top-4 min-w-[64px] h-[30px] px-2 bg-[#E65353] shadow-[0px_4px_4px_rgba(0,0,0,0.12)] rounded-lg text-[#FEFEFE] text-[12px] font-medium leading-[15px] flex items-center justify-center z-10 select-none">
                    {offer.discount}
                  </span>
                )}
              </div>

              {/* Card Body (Frame 2147228498) */}
              <div className="w-full h-[140px] p-3 flex flex-col gap-4 justify-between bg-white relative z-10">
                {/* Frame 2147228976 */}
                <div className="w-full flex flex-col gap-2">
                  {/* Brand & Expiry Row (Frame 2147228975) */}
                  <div className="w-full h-[15px] flex justify-between items-center text-[12px] font-normal leading-[15px] text-[#4D4D4D]">
                    <span className="truncate max-w-[100px]">{offer.brand || "No brand returned"}</span>
                    <span>{offer.expires ? `Expires ${offer.expires}` : "No expiry returned"}</span>
                  </div>

                  {/* Title & Rating Block (Frame 2147229110) */}
                  <div className="w-full flex flex-col gap-1">
                    <h3 className="text-[16px] font-semibold leading-[19px] text-[#2D2D2D] truncate w-full">
                      {offer.title || "No title returned"}
                    </h3>
                    
                    {/* Star ratings row (Frame 2147228493) */}
                    <div className="w-full h-[20px] flex items-center gap-2 text-[14px] font-semibold leading-[17px] text-[#1F1D1D]">
                      {/* Star Rating Group (Frame 2147228492) */}
                      <div className="w-[116px] h-[20px] flex items-center gap-1 flex-shrink-0">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <svg
                            key={i}
                            className={`w-[20px] h-[20px] fill-current ${i < Math.round(offer.reviewsCount > 0 ? Math.max(0, Math.min(5, offer.rating)) : 0) ? "text-[#FF9F19]" : "text-[#C0C0C0]"}`}
                            viewBox="0 0 20 20"
                          >
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                        ))}
                      </div>
                      <span className="truncate">
                        {(offer.reviewsCount > 0 ? Math.max(0, Math.min(5, offer.rating)) : 0).toFixed(2)} ({offer.reviewsCount})
                      </span>
                    </div>
                  </div>
                </div>

                {/* CTA Row (Frame 2147229011) */}
                <div className="w-full h-[34px] flex items-center gap-[15px]">
                  {/* Claim Offer CTA */}
                  <button
                    onClick={() => onClaimOffer?.(offer.campaignId)}
                    className="flex-grow h-[34px] bg-gradient-to-b from-[#3E3EDF] to-[#3E3EDF] hover:opacity-90 active:scale-[0.98] text-[#FEFEFE] text-[16px] font-medium leading-[24px] rounded-lg shadow-[0_4px_4px_rgba(0,0,0,0.12),inset_0_4px_4px_rgba(255,255,255,0.12)] flex items-center justify-center cursor-pointer focus:outline-none min-w-0"
                  >
                    Claim offer
                  </button>
                  
                  {/* View Offer CTA */}
                  <button
                    onClick={() => onViewOffer?.(offer.campaignId)}
                    className="w-[85px] h-[34px] border border-[#707070] bg-[#FFFFFF] hover:bg-gray-50 active:scale-[0.98] text-[#1F1D1D] text-[12px] font-medium leading-[15px] rounded-lg shadow-[inset_0px_4px_4px_rgba(255,255,255,0.12)] filter drop-shadow(0px 4px 4px rgba(0, 0, 0, 0.12)) flex items-center justify-center cursor-pointer flex-shrink-0 focus:outline-none"
                  >
                    View Offer
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination Controls */}
      {totalItems > pageSize && (
      <div className="flex justify-center mt-6">
        <div className="flex items-center gap-[23px] select-none">
          <div className="min-h-[36px] flex items-center gap-4">
            <button
              onClick={() => {
                if (canGoBack) onPageChange?.(currentPage - 1);
              }}
              disabled={!canGoBack}
              className={`w-[78px] h-[36px] border rounded-[4px] flex items-center justify-center gap-1 text-[14px] font-normal leading-[21px] font-poppins cursor-pointer focus:outline-none transition-all ${
                canGoBack
                  ? "bg-[#FFFFFF] border-[#FEFEFE] hover:bg-gray-50 shadow-[0px_2px_8px_rgba(0,0,0,0.1)] text-[#1F1D1D]"
                  : "bg-[#F5F5F5] border-[#E0E0E0] text-[#A0A0A0] cursor-not-allowed"
              }`}
            >
              <svg className="w-4 h-4 transform rotate-90" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
              Back
            </button>

            {pages.map((page, index) => (
              <div key={page} className="flex items-center gap-4">
                {index > 0 && page - pages[index - 1] > 1 && (
                  <div className="w-[31px] h-[36px] bg-[#FFFFFF] border border-[#FEFEFE] shadow-[0px_2px_8px_rgba(0,0,0,0.1)] rounded-[4px] flex items-center justify-center text-[14px] font-normal text-[#1F1D1D] font-poppins">
                    ...
                  </div>
                )}
                <button
                  onClick={() => onPageChange?.(page)}
                  className={`min-w-[29px] px-2 h-[37px] border rounded-[4px] flex items-center justify-center text-[14px] font-normal leading-[21px] font-poppins cursor-pointer focus:outline-none transition-all ${
                    currentPage === page
                      ? "bg-[#3E3EDF] text-white border-[#3E3EDF]"
                      : "bg-[#FFFFFF] border-[#FEFEFE] hover:bg-gray-50 shadow-[0px_2px_8px_rgba(0,0,0,0.1)] text-[#1F1D1D]"
                  }`}
                >
                  {page}
                </button>
              </div>
            ))}

            <button
              onClick={() => {
                if (canGoNext) onPageChange?.(currentPage + 1);
              }}
              disabled={!canGoNext}
              className={`w-[75px] h-[36px] border rounded-[4px] flex items-center justify-center gap-1 text-[14px] font-normal leading-[21px] font-poppins cursor-pointer focus:outline-none transition-all ${
                canGoNext
                  ? "bg-[#FFFFFF] border-[#FEFEFE] hover:bg-gray-50 shadow-[0px_2px_8px_rgba(0,0,0,0.1)] text-[#1F1D1D]"
                  : "bg-[#F5F5F5] border-[#E0E0E0] text-[#A0A0A0] cursor-not-allowed"
              }`}
            >
              Next
              <svg className="w-4 h-4 transform -rotate-90" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

          </div>
        </div>
      </div>
      )}
    </div>
  );
}
