import { ApiRecord } from "@/lib/api/backendApi";

export const toNumber = (value: unknown, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

export const formatMoney = (value: unknown, options?: { compact?: boolean }) => {
  const amount = toNumber(value);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: options?.compact ? "compact" : "standard",
    maximumFractionDigits: options?.compact ? 1 : 2,
  }).format(amount);
};

export const formatInteger = (value: unknown) =>
  new Intl.NumberFormat("en-US").format(toNumber(value));

export const hasBackendValue = (value: unknown) =>
  value !== null && value !== undefined && value !== "";

export const formatPercent = (value: unknown) =>
  `${toNumber(value).toFixed(1)}%`;

export const formatSignedPercent = (value: unknown) => {
  const numeric = toNumber(value);
  return `${numeric > 0 ? "+" : ""}${numeric.toFixed(1)}%`;
};

export const formatMinutes = (value: unknown) =>
  `${formatInteger(value)}m`;

// Master: the brand's default time zone controls dates across the dashboard.
let brandTimeZone: string | undefined;
export const setBrandTimeZone = (timeZone: unknown) => {
  brandTimeZone = typeof timeZone === "string" && timeZone ? timeZone : undefined;
};

export const formatDate = (value: unknown) => {
  if (typeof value !== "string" || !value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: brandTimeZone,
  });
};

export const formatTime = (value: unknown) => {
  if (typeof value !== "string" || !value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: brandTimeZone,
    timeZoneName: brandTimeZone ? "short" : undefined,
  });
};

export const titleCase = (value: unknown) =>
  String(value || "")
    .replace(/_/g, " ")
    .replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());

export const activeStatus = (value: unknown) => {
  const status = String(value || "").toLowerCase();
  if (status === "active") return "Active";
  return "Paused";
};

export const campaignSpend = (campaign: ApiRecord) => {
  if (campaign.total_spend !== undefined) return toNumber(campaign.total_spend);
  const tiers = Array.isArray(campaign.tiers) ? (campaign.tiers as ApiRecord[]) : [];
  return tiers.reduce(
    (sum, tier) => sum + toNumber(tier.reward_amount) * toNumber(tier.allocation_percent) / 100,
    0
  );
};

export const customerInitials = (nameOrEmail: string) => {
  const parts = nameOrEmail.split(/[ @._-]/).filter(Boolean);
  return (parts[0]?.[0] || "C") + (parts[1]?.[0] || "");
};
