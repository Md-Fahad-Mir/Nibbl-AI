/* eslint-disable @next/next/no-img-element */
import { Package } from "lucide-react";
import { DealType, cooldownText, money, receiptWording } from "./dealRules";

interface OfferPreviewProps {
  imageUrl?: string;
  headline: string;
  description: string;
  products: { id: string; name: string; imageSrc?: string }[];
  dealType: DealType;
  maxRebate?: string | null;
  fixedReward?: string | null;
  allowedMerchants: string;
  featuredRetailers?: string[];
  whereToBuy?: string[];
  cooldownDays: number;
  oneTimeOnly: boolean;
}

/** Shopper offer preview — built only from the campaign's saved fields, so
 *  it shows exactly the wording and terms shoppers will see. */
export default function OfferPreview({
  imageUrl,
  headline,
  description,
  products,
  dealType,
  maxRebate,
  fixedReward,
  allowedMerchants,
  featuredRetailers = [],
  whereToBuy = [],
  cooldownDays,
  oneTimeOnly,
}: OfferPreviewProps) {
  const reward = dealType === "buy_x_get_y" ? money(fixedReward) : `Up to ${money(maxRebate)}`;
  return (
    <div className="flex flex-col gap-3">
      <span className="text-[10px] font-bold text-[#454656]/60 uppercase tracking-wider">Shopper preview</span>
      <div className="rounded-[36px] bg-[#131B2E] border-[5px] border-[#283044] p-3 shadow-[0_24px_48px_rgba(0,0,0,0.18)]">
        <div className="bg-white rounded-[28px] overflow-hidden">
          <div className="h-40 bg-[#F2F3FF] flex items-center justify-center overflow-hidden">
            {imageUrl ? (
              <img src={imageUrl} alt="Campaign" className="w-full h-full object-cover" />
            ) : (
              <Package className="w-10 h-10 text-[#94A3B8]" />
            )}
          </div>
          <div className="p-5 flex flex-col gap-3">
            <h4 className="font-jakarta font-extrabold text-base text-[#131B2E] leading-5">
              {headline || "Your offer headline"}
            </h4>
            <p className="text-xs text-[#454656] leading-5">{description || "Your offer description"}</p>
            <div className="bg-[#F2F3FF] rounded-2xl px-4 py-3 flex justify-between items-center">
              <span className="text-[10px] font-bold text-[#454656] uppercase">Reward</span>
              <span className="text-sm font-extrabold text-[#001BD2]">{reward}</span>
            </div>
            {products.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {products.map((p) => (
                  <div key={p.id} className="min-w-[88px] rounded-xl border border-[#EAEDFF] p-2 flex flex-col items-center gap-1">
                    {p.imageSrc ? (
                      <img src={p.imageSrc} alt="" className="w-12 h-12 object-cover rounded-lg" />
                    ) : (
                      <Package className="w-6 h-6 text-[#94A3B8]" />
                    )}
                    <span className="text-[10px] font-semibold text-[#131B2E] text-center line-clamp-2">{p.name}</span>
                  </div>
                ))}
              </div>
            )}
            {featuredRetailers.length > 0 && (
              <p className="text-[11px] font-semibold text-[#131B2E]">Available at {featuredRetailers.join(", ")}</p>
            )}
            <p className="text-[10px] text-[#64748B] leading-4">{receiptWording(allowedMerchants)}</p>
            {whereToBuy.length > 0 && (
              <p className="text-[10px] text-[#64748B] leading-4">Where to buy: {whereToBuy.join(", ")}</p>
            )}
            <p className="text-[10px] text-[#64748B]">Cooldown: {cooldownText(cooldownDays, oneTimeOnly)}</p>
            <button className="h-10 rounded-full bg-[#001BD2] text-white text-sm font-bold" disabled>
              Claim offer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
