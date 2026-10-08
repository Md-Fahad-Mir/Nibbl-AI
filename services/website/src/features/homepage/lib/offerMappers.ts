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
  return amount || text(offer.offer_type, "Reward");
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
  image: imageUrl(offer.product_image ?? offer.image ?? offer.thumbnail, "") || null,
  description: text(
    offer.description ?? offer.product_description ?? offer.summary,
    "Buy this product, upload your receipt, and receive your reward after verification."
  ),
  category: text(offer.category, "All"),
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
