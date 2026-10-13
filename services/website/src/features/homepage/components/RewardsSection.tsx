"use client";

import { useState } from "react";
import Image from "next/image";
import { imageUrl, rewardLabel, unavailableReason } from "../lib/offerMappers";

interface CampaignCard {
  id: string;
  brand: string;
  headline: string;
  description: string;
  reward: string;
  image: string | null;
  goingFast: boolean;
  unavailable: boolean;
  productCount: number;
  retailers: string[];
}

interface RewardsSectionProps {
  offers?: Record<string, unknown>[];
  categories?: string[];
  activeCategory?: string;
  isLoading?: boolean;
  error?: string | null;
  onCategoryChange?: (category: string) => void;
  onClaimOffer?: (campaignId?: string) => void;
  onViewOffer?: (campaignId?: string) => void;
}

const normalizeCategory = (value: string) => value.trim().toLowerCase();

// Master: the first tab is "For You" (every category).
const formatCategoryLabel = (value: string) =>
  normalizeCategory(value) === "all"
    ? "For You"
    : value.replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

const list = (value: unknown) => (Array.isArray(value) ? value.map(String).filter(Boolean) : []);

const mapCampaign = (offer: Record<string, unknown>, index: number): CampaignCard => {
  const featured = list(offer.featured_retailers);
  return {
    id: String(offer.campaign_id ?? offer.id ?? index),
    brand: String(offer.brand_name ?? ""),
    headline: String(offer.offer_headline || offer.product_name || ""),
    description: String(offer.offer_description ?? ""),
    reward: offer.reward_amount ? rewardLabel(offer) : "",
    image: imageUrl(offer.campaign_image || offer.product_image, "") || null,
    goingFast: Boolean(offer.going_fast),
    unavailable: unavailableReason(offer) !== null,
    productCount: Array.isArray(offer.eligible_products) ? offer.eligible_products.length : 1,
    retailers: featured.length ? featured : list(offer.where_to_buy).slice(0, 3),
  };
};

/** Master "Campaigns on For You": campaign cards only (never product cards or
 *  a campaign-level rating), category tabs, up to 24 per category, one
 *  vertical list. */
export default function RewardsSection({
  offers,
  categories: categoryOptions,
  activeCategory,
  isLoading = false,
  error,
  onCategoryChange,
  onClaimOffer,
  onViewOffer,
}: RewardsSectionProps) {
  const [localActiveCategory, setLocalActiveCategory] = useState<string>("All");
  const cards = (offers || []).map(mapCampaign);
  const selectedCategory = activeCategory || localActiveCategory;
  const categories = Array.from(
    new Map(
      ["All", ...(categoryOptions || [])]
        .filter((c) => c.trim())
        .map((c) => [normalizeCategory(c), c])
    ).values()
  );

  return (
    <div className="w-full max-w-[1137px] mx-auto font-sans flex flex-col gap-6">
      <div className="flex items-center gap-3 overflow-x-auto py-1 scrollbar-none w-full">
        {categories.map((cat) => {
          const isActive = normalizeCategory(selectedCategory) === normalizeCategory(cat);
          return (
            <button key={cat} type="button" aria-pressed={isActive}
              onClick={() => {
                setLocalActiveCategory(cat);
                onCategoryChange?.(cat);
              }}
              className={`h-[32px] rounded-full px-4 flex items-center text-sm font-medium flex-shrink-0 cursor-pointer ${
                isActive ? "bg-[#3E3EDF] text-white" : "bg-white text-[#575757] border border-[#D0D0D0]"
              }`}>
              {formatCategoryLabel(cat)}
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-100 text-gray-500">Loading offers…</div>
      ) : error ? (
        <div className="text-center py-12 bg-white rounded-xl border border-red-100 text-red-500">{error}</div>
      ) : cards.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-100 text-gray-400">
          No offers near you in this category yet.
        </div>
      ) : (
        <div className="flex flex-col gap-4 w-full max-w-[720px] mx-auto">
          {cards.map((card) => (
            <article key={card.id}
              className="w-full bg-white shadow-[0px_2px_6px_rgba(0,0,0,0.10)] rounded-[14px] p-3 flex gap-4">
              <button onClick={() => onViewOffer?.(card.id)}
                className="relative w-[120px] sm:w-[160px] aspect-square flex-shrink-0 rounded-[10px] overflow-hidden bg-gray-100 cursor-pointer">
                {card.image ? (
                  <Image src={card.image} alt={card.headline} fill sizes="160px" className="object-cover" />
                ) : (
                  <span className="absolute inset-0 flex items-center justify-center text-xs text-gray-400">No image</span>
                )}
              </button>
              <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                <span className="text-[11px] font-semibold tracking-wide uppercase text-[#575757] truncate">{card.brand}</span>
                <h3 className="text-[17px] font-semibold leading-tight text-[#1F1D1D] line-clamp-2">{card.headline}</h3>
                {card.description && <p className="text-[13px] text-[#4D4D4D] line-clamp-2">{card.description}</p>}
                <div className="flex flex-wrap items-center gap-2">
                  {card.reward && (
                    <span className="h-7 px-3 rounded-lg bg-[#EEEAFE] text-[#3E3EDF] text-[13px] font-semibold flex items-center">{card.reward}</span>
                  )}
                  {card.goingFast && (
                    <span className="h-7 px-2 rounded-lg bg-[#FFF1E6] text-[#E0700B] text-[12px] font-semibold flex items-center">🔥 Going fast</span>
                  )}
                </div>
                {card.retailers.length > 0 && (
                  <span className="text-[12px] text-[#575757] truncate">Buy at {card.retailers.join(", ")}</span>
                )}
                <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1">
                  <button onClick={() => onViewOffer?.(card.id)} className="text-[13px] font-medium text-[#3E3EDF] cursor-pointer">
                    {card.productCount} eligible product{card.productCount === 1 ? "" : "s"} · View Products ›
                  </button>
                  <button onClick={() => onClaimOffer?.(card.id)} disabled={card.unavailable}
                    className="h-9 px-4 rounded-lg bg-[#3E3EDF] text-white text-sm font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                    {card.unavailable ? "Unavailable" : "Claim Offer"}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
