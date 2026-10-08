// Mirrors the backend's locked deal rules (Apps/campaigns/deals.py and
// Apps/rebates/reward_math.py) so the builder preview shows exactly what the
// server will save and enforce.

export type DealType = "free" | "bogo_free" | "bogo_half" | "buy_x_get_y";

export const DEAL_TYPES: { value: DealType; label: string; hint: string }[] = [
  { value: "free", label: "Free", hint: "Best for product trial and usually the strongest conversion." },
  { value: "bogo_free", label: "BOGO Free", hint: "Requires two eligible products and reimburses the lower-priced product." },
  {
    value: "bogo_half",
    label: "Buy 1, Get 1 50% Off",
    hint: "Requires two eligible products and reimburses 50% of the lower-priced product.",
  },
  { value: "buy_x_get_y", label: "Buy X, Get $Y Off", hint: "Brand chooses the required quantity and fixed reward." },
];

export const COOLDOWN_OPTIONS: { value: string; label: string }[] = [
  { value: "0", label: "No cooldown" },
  { value: "30", label: "30 days — Recommended" },
  { value: "60", label: "60 days" },
  { value: "90", label: "90 days" },
  { value: "one_time", label: "One time per customer" },
];

const WORDS: Record<number, string> = { 1: "one", 2: "two", 3: "three" };

export const money = (value: string | number | null | undefined) => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return "$—";
  return Number.isInteger(amount) ? `$${amount.toFixed(0)}` : `$${amount.toFixed(2)}`;
};

export const suggestedWording = (
  dealType: DealType,
  productName: string,
  maxRebate: string,
  fixedReward: string,
  quantity: number
): { headline: string; description: string } => {
  const name = productName || "this product";
  const cap = money(maxRebate);
  if (dealType === "free") {
    return {
      headline: `Free ${name} up to ${cap}`,
      description: `Buy one eligible ${name} product and receive the verified purchase price back, up to ${cap}.`,
    };
  }
  if (dealType === "bogo_free") {
    return {
      headline: `Buy 1 ${name}, Get 1 Free`,
      description: `Buy two eligible ${name} products and receive the lower-priced product free, up to ${cap}.`,
    };
  }
  if (dealType === "bogo_half") {
    return {
      headline: `Buy 1 ${name}, Get 1 50% Off`,
      description: `Buy two eligible ${name} products and receive 50% back on the lower-priced product, up to ${cap}.`,
    };
  }
  const reward = money(fixedReward);
  const noun = quantity === 1 ? "product" : "products";
  const receipt = quantity === 1 ? "" : " on the same receipt";
  return {
    headline: `Buy ${quantity} ${name}, Get ${reward} Back`,
    description: `Buy ${WORDS[quantity] ?? quantity} eligible ${name} ${noun}${receipt} and receive ${reward} back.`,
  };
};

/** Locked system rules shown to the brand (not editable). */
export const systemRules = (dealType: DealType, maxRebate: string, fixedReward: string, quantity: number) => {
  const cap = money(maxRebate);
  switch (dealType) {
    case "free":
      return [
        "Requires 1 eligible product on the receipt.",
        `Pays the verified purchase price of one eligible product, up to ${cap}.`,
        "One reward per approved redemption.",
      ];
    case "bogo_free":
      return [
        "Requires 2 eligible products on the same receipt.",
        `Pays the price of the lower-priced eligible product, up to ${cap}.`,
        "One reward per approved redemption.",
      ];
    case "bogo_half":
      return [
        "Requires 2 eligible products on the same receipt.",
        `Pays 50% of the lower-priced eligible product, up to ${cap}.`,
        "One reward per approved redemption.",
      ];
    default:
      return [
        `Requires ${quantity} eligible product${quantity === 1 ? "" : "s"} on the same receipt.`,
        `Pays a fixed ${money(fixedReward)} once the quantity is verified.`,
        "One reward per approved redemption.",
      ];
  }
};

/** Desired ÷ rate, rounded up (10 ÷ 30% = 34). */
export const claimCapacity = (desired: string | number, ratePercent: string | number) => {
  const d = Number(desired);
  const r = Number(ratePercent);
  if (!(d >= 1) || !(r > 0) || r > 100) return null;
  return Math.ceil((d * 100) / r - 1e-9);
};

export const cooldownText = (days: unknown, oneTime: unknown) =>
  oneTime ? "One time per customer" : Number(days) === 0 ? "No cooldown" : `${String(days)} days after a redemption`;

export const dealLabel = (value: unknown) =>
  DEAL_TYPES.find((d) => d.value === value)?.label ?? String(value ?? "—");

/** Receipt eligibility wording shown to shoppers. */
export const receiptWording = (allowedMerchants: string) => {
  const retailers = allowedMerchants
    .split(",")
    .map((r) => r.trim())
    .filter(Boolean);
  return retailers.length
    ? `Purchase required at: ${retailers.join(", ")}. The receipt must clearly show the retailer name.`
    : "Any retailer — submit a receipt from any store where the eligible product and purchase details are clear.";
};
