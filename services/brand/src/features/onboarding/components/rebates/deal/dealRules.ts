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
  // Before a product is picked the wording stays generic ("eligible product").
  const name = productName || "product";
  const lead = productName ? `${productName} ` : "";
  const cap = money(maxRebate);
  if (dealType === "free") {
    return {
      headline: `Free ${name} up to ${cap}`,
      description: `Buy one eligible ${lead}product and receive the verified purchase price back, up to ${cap}.`,
    };
  }
  if (dealType === "bogo_free") {
    return {
      headline: `Buy 1 ${name}, Get 1 Free`,
      description: `Buy two eligible ${lead}products and receive the lower-priced product free, up to ${cap}.`,
    };
  }
  if (dealType === "bogo_half") {
    return {
      headline: `Buy 1 ${name}, Get 1 50% Off`,
      description: `Buy two eligible ${lead}products and receive 50% back on the lower-priced product, up to ${cap}.`,
    };
  }
  const reward = money(fixedReward);
  const noun = quantity === 1 ? "product" : "products";
  const receipt = quantity === 1 ? "" : " on the same receipt";
  return {
    headline: `Buy ${quantity} ${name}, Get ${reward} Back`,
    description: `Buy ${WORDS[quantity] ?? quantity} eligible ${lead}${noun}${receipt} and receive ${reward} back.`,
  };
};

/** Master "System Rules Summary (Locked)": offer type, required quantity,
 *  reward and maximum reward per approved redemption. */
export const rulesSummary = (
  dealType: DealType,
  maxRebate: string,
  fixedReward: string,
  quantity: number
): [string, string][] => {
  const cap = `${money(maxRebate)} per approved redemption`;
  const label = DEAL_TYPES.find((d) => d.value === dealType)?.label ?? dealType;
  switch (dealType) {
    case "free":
      return [["Offer Type", label], ["Required Quantity", "1 eligible product"],
        ["Reward", `Verified purchase price, up to ${money(maxRebate)}`], ["Maximum Reward", cap]];
    case "bogo_free":
      return [["Offer Type", label], ["Required Quantity", "2 eligible products on the same receipt"],
        ["Reward", "Verified price of the lower-priced eligible product"], ["Maximum Reward", cap]];
    case "bogo_half":
      return [["Offer Type", label], ["Required Quantity", "2 eligible products on the same receipt"],
        ["Reward", "50% of the verified lower-priced eligible product"], ["Maximum Reward", cap]];
    default:
      return [["Offer Type", label],
        ["Required Quantity", `${quantity} eligible product${quantity === 1 ? "" : "s"}${quantity === 1 ? "" : " on the same receipt"}`],
        ["Reward", `Fixed ${money(fixedReward)}`], ["Maximum Reward", `${money(fixedReward)} per approved redemption`]];
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
