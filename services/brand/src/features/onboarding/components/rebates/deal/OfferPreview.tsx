/* eslint-disable @next/next/no-img-element */
import { ChevronRight, Clock, FileText, Package, ShoppingCart, Tag } from "lucide-react";
import { DealType, money, receiptWording } from "./dealRules";

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
  const anyRetailer = !allowedMerchants.split(",").some((r) => r.trim());
  const rows: [typeof ShoppingCart, string, string][] = [
    [ShoppingCart, "Where to Buy", (featuredRetailers.length ? featuredRetailers : whereToBuy).join(", ") || "Retailers you select"],
    [FileText, "Receipt Eligibility", anyRetailer ? "Any retailer" : `Required: ${allowedMerchants}`],
    [Tag, dealType === "buy_x_get_y" ? "Reward" : "Maximum Rebate", reward],
    [Clock, "Offer Eligibility", oneTimeOnly ? "One time per customer" : cooldownDays ? `Once every ${cooldownDays} days` : "No cooldown"],
  ];
  return (
    <div className="flex flex-col gap-3">
      <span className="font-jakarta text-lg font-bold text-[#131B2E]">Live Shopper Preview (Mobile)</span>
      <div className="rounded-[40px] bg-[#131B2E] border-[5px] border-[#283044] p-3 shadow-[0_24px_48px_rgba(0,0,0,0.18)]">
        <div className="bg-white rounded-[30px] overflow-hidden">
          <div className="h-8 flex items-center justify-center">
            <span className="w-20 h-4 rounded-full bg-[#131B2E]" />
          </div>
          <div className="text-center font-jakarta font-extrabold text-lg text-[#131B2E] pb-1">
            nibbl<span className="text-[#D63D9C]">AI</span>
          </div>
          <div className="h-36 mx-3 rounded-2xl bg-[#F2F3FF] flex items-center justify-center overflow-hidden">
            {imageUrl ? (
              <img src={imageUrl} alt="Campaign" className="w-full h-full object-cover" />
            ) : (
              <Package className="w-10 h-10 text-[#94A3B8]" />
            )}
          </div>
          <div className="p-4 flex flex-col gap-3">
            <h4 className="font-jakarta font-extrabold text-base text-[#001BD2] leading-5">
              {headline || "Your offer headline"}
            </h4>
            <p className="text-xs text-[#454656] leading-5">{description || "Your offer description"}</p>
            {products.length > 0 && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-[#001BD2]">Eligible Products</span>
                  <span className="text-[11px] font-semibold text-[#001BD2]">See all ({products.length})</span>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {products.map((p) => (
                    <div key={p.id} className="min-w-[78px] flex flex-col items-center gap-1">
                      {p.imageSrc ? (
                        <img src={p.imageSrc} alt="" className="w-14 h-14 object-cover rounded-lg" />
                      ) : (
                        <Package className="w-6 h-6 text-[#94A3B8]" />
                      )}
                      <span className="text-[10px] font-semibold text-[#131B2E] text-center line-clamp-2">{p.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex flex-col divide-y divide-[#EAEDFF] border-y border-[#EAEDFF]">
              {rows.map(([Icon, label, value]) => (
                <div key={label} className="flex items-center gap-3 py-2">
                  <Icon className="w-5 h-5 text-[#001BD2] flex-shrink-0" />
                  <span className="flex-1 min-w-0">
                    <span className="block text-xs font-bold text-[#131B2E]">{label}</span>
                    <span className="block text-[11px] text-[#64748B] truncate">{value}</span>
                  </span>
                  <ChevronRight className="w-4 h-4 text-[#94A3B8]" />
                </div>
              ))}
            </div>
            <p className="text-[10px] text-[#64748B] leading-4">{receiptWording(allowedMerchants)}</p>
            <button className="h-11 rounded-xl bg-[#001BD2] text-white text-sm font-bold" disabled>
              Claim This Offer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
