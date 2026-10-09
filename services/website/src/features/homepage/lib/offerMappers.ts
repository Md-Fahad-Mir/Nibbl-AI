"use client";

import { API_BASE_URL, type ApiRecord } from "@/lib/api/backendApi";

export interface DisplayOffer {
  id: string;
  brand: string;
  campaignName: string;
  expires: string;
  title: string;
  rating: number;
  reviewsCount: number;
  rewardLabel: string;
  image: string | null;
  description: string;
  category: string;
  /** Brand's shopper headline (never the internal campaign name). */
  headline: string;
  retailerWording: string;
  cooldownWording: string;
  goingFast: boolean;
  /** Why the offer can't be claimed right now; null when claimable. */
  unavailableReason: string | null;
  products: { id: string; name: string; image: string | null }[];
  /** Up to three retailers shown in the offer summary. */
  featuredRetailers: string[];
  /** Where to Buy (only the eligible retailers when one is required). */
  whereToBuy: string[];
}

export interface DisplayReview {
  id: string;
  author: string;
  rating: number;
  body: string;
  date: string;
  avatar: string | null;
}

const fallbackImage = "/homepage/rewardImage.svg";
const apiOrigin = new URL(API_BASE_URL).origin;

export const text = (value: unknown, fallback = "") =>
  typeof value === "string" && value.trim() ? value : fallback;

export const money = (value: unknown) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? `$${amount.toFixed(2)}` : "";
};

export const dateOnly = (value: unknown, fallback = "") =>
  text(value).slice(0, 10) || fallback;

export const imageUrl = (value: unknown, fallback = fallbackImage) => {
  const raw = text(value, fallback);
  if (!raw) return raw;
  if (raw.startsWith("http://") || raw.startsWith("https://") || raw.startsWith("data:")) return raw;
  if (raw.startsWith("/media/")) return `${apiOrigin}${raw}`;
  return raw;
};

export const campaignId = (offer?: ApiRecord | null) =>
  offer ? String(offer.campaign_id ?? offer.id ?? offer.campaign ?? "") : "";

export const rewardLabel = (offer?: ApiRecord | null) => {
  if (!offer) return "Reward";
  const label = text(offer.discount_label);
  if (label) return label;
  const amount = money(offer.reward_amount ?? offer.amount);
  // Deal offers: reward_amount is the most one redemption pays.
  if (amount && offer.deal_type) {
    return offer.deal_type === "buy_x_get_y" ? `${amount} back` : `Up to ${amount}`;
  }
  return amount || text(offer.offer_type, "Reward");
};

export const retailerWording = (offer: ApiRecord) => {
  const retailers = Array.isArray(offer.eligible_retailers) ? offer.eligible_retailers.map(String) : [];
  return offer.retailer_required && retailers.length
    ? `Purchase required at: ${retailers.join(", ")}. Your receipt must clearly show the retailer name.`
    : "Buy at any retailer — your receipt just needs to clearly show the eligible product.";
};

export const cooldownWording = (offer: ApiRecord) => {
  if (offer.one_time_only) return "One redemption per customer.";
  const days = Number(offer.cooldown_days ?? 0);
  return days > 0
    ? `After a redemption is approved, you can redeem this offer again in ${days} days.`
    : "You can redeem this offer again once your previous redemption is approved.";
};

export const unavailableReason = (offer: ApiRecord): string | null => {
  if (offer.claimable !== false) return null;
  if (offer.temporarily_unavailable) {
    return "Current rebates have been claimed. This offer is temporarily unavailable — check back soon.";
  }
  if (offer.in_cooldown) {
    return offer.one_time_only
      ? "You've already redeemed this offer."
      : "You've redeemed this offer recently. It will be available again after your cooldown.";
  }
  return "This offer isn't available right now.";
};

export const displayOffer = (offer: ApiRecord, index = 0): DisplayOffer => ({
  id: campaignId(offer) || String(index),
  brand: text(offer.brand_name ?? offer.brand, "NibblAI"),
  campaignName: text(offer.campaign_name ?? offer.name ?? offer.title, "Reward offer"),
  expires: dateOnly(offer.end_at ?? offer.expires_at ?? offer.expires),
  title: text(offer.product_name ?? offer.campaign_name ?? offer.name ?? offer.title, "Reward offer"),
  rating: Number(offer.rating ?? offer.average_rating ?? 0),
  reviewsCount: Number(offer.review_count ?? offer.reviews_count ?? 0),
  rewardLabel: rewardLabel(offer),
  image: imageUrl(text(offer.campaign_image) || (offer.product_image ?? offer.image ?? offer.thumbnail), "") || null,
  description: text(
    text(offer.offer_description) || (offer.description ?? offer.product_description ?? offer.summary),
    "Buy this product, upload your receipt, and receive your reward after verification."
  ),
  category: text(offer.category, "All"),
  headline: text(offer.offer_headline, text(offer.product_name, "Reward offer")),
  retailerWording: retailerWording(offer),
  cooldownWording: cooldownWording(offer),
  goingFast: Boolean(offer.going_fast),
  unavailableReason: unavailableReason(offer),
  products: Array.isArray(offer.eligible_products)
    ? offer.eligible_products.map((item, i) => {
        const product = item as ApiRecord;
        return {
          id: String(product.id ?? i),
          name: text(product.name, "Eligible product"),
          image: imageUrl(product.image, "") || null,
        };
      })
    : [],
  featuredRetailers: Array.isArray(offer.featured_retailers) ? offer.featured_retailers.map(String) : [],
  whereToBuy: Array.isArray(offer.where_to_buy) ? offer.where_to_buy.map(String) : [],
});

export const displayReviews = (offer?: ApiRecord | null): DisplayReview[] => {
  const rawReviews = offer?.reviews;
  if (!Array.isArray(rawReviews)) return [];

  return rawReviews.map((review, index) => {
    const item = review as ApiRecord;
    const user = (item.user || item.consumer || {}) as ApiRecord;

    return {
      id: String(item.id ?? index),
      author: text(user.full_name ?? user.name ?? item.author_name, "NibblAI shopper"),
      rating: Number(item.rating ?? 0),
      body: text(item.content ?? item.body ?? item.comment, "No review text was provided."),
      date: dateOnly(item.created_at ?? item.updated_at, "Recent"),
      avatar: imageUrl(user.avatar ?? user.avatar_url ?? item.avatar, "") || null,
    };
  });
};
