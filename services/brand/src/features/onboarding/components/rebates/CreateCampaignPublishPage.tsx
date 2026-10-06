/* eslint-disable @next/next/no-img-element */
import { useMemo, useRef, useState } from "react";
import {
  Calendar,
  Check,
  Copy,
  DollarSign,
  ExternalLink,
  ImagePlus,
  Package,
  Pencil,
  Plus,
  QrCode,
  Rocket,
  Search,
  X,
} from "lucide-react";
import { ApiRecord } from "@/lib/api/backendApi";

interface ProductItem {
  id: string;
  name: string;
  brand?: string;
  description?: string;
  category: string;
  imageSrc: string;
}

interface RewardTier {
  id: string;
  name: string;
  structure: string;
  reward: string;
  maxPayout: string;
  minPurchase: string;
  allocation: number;
}

interface CampaignDraft {
  name: string;
  description?: string;
  imageSrc?: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  dailyBudget?: number;
  fallback?: {
    rewardAmount: string;
    isEnabled: boolean;
    description?: string;
  };
}

interface CampaignPublishPayload extends CampaignDraft {
  selectedProductIds: string[];
}

interface CreateCampaignPublishPageProps {
  mode: "create" | "edit";
  initialData: CampaignDraft;
  products: ProductItem[];
  initialSelectedIds: string[];
  tiers: RewardTier[];
  accessData?: ApiRecord | null;
  isPublishing?: boolean;
  onCancel: () => void;
  onPublish: (payload: CampaignPublishPayload) => Promise<ApiRecord | void>;
  onAddCustomTierClick: () => void;
  onEditTierClick: (tier: RewardTier) => void;
}

const formatMoney = (value: number | string | undefined, fallback = 0) => {
  const numeric = Number(value ?? fallback);
  return Number.isFinite(numeric) ? numeric.toFixed(2) : fallback.toFixed(2);
};

const qrImageUrl = (value: string, format?: "svg") => {
  const query = new URLSearchParams({
    size: "260x260",
    margin: "12",
    data: value,
  });
  if (format) query.set("format", format);
  return `https://api.qrserver.com/v1/create-qr-code/?${query.toString()}`;
};

const readAccessLink = (accessData?: ApiRecord | null) => {
  const value = accessData?.campaign_url ?? accessData?.qr_data;
  return typeof value === "string" ? value : "";
};

export default function CreateCampaignPublishPage({
  mode,
  initialData,
  products,
  initialSelectedIds,
  tiers,
  accessData,
  isPublishing = false,
  onCancel,
  onPublish,
  onAddCustomTierClick,
  onEditTierClick,
}: CreateCampaignPublishPageProps) {
  const [name, setName] = useState(initialData.name);
  const [description, setDescription] = useState(initialData.description || "");
  const [startDate, setStartDate] = useState(initialData.startDate || "");
  const [endDate, setEndDate] = useState(initialData.endDate || "");
  const [isActive, setIsActive] = useState(initialData.isActive);
  const [imageSrc, setImageSrc] = useState(initialData.imageSrc || "/Rebate/bannerPreviewImage.svg");
  const [dailyBudget, setDailyBudget] = useState(String(initialData.dailyBudget ?? 150));
  const [fallbackActive, setFallbackActive] = useState(initialData.fallback?.isEnabled ?? true);
  const [fallbackReward, setFallbackReward] = useState(initialData.fallback?.rewardAmount ?? "2.00");
  const [fallbackDescription, setFallbackDescription] = useState(
    initialData.fallback?.description || "Fallback offer for receipts that do not meet a tier."
  );
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelectedIds);
  const [searchQuery, setSearchQuery] = useState("");
  const [imageError, setImageError] = useState("");
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedProducts = products.filter((product) => selectedIds.includes(product.id));
  const activeTiers = tiers.filter((tier) => tier.allocation > 0);
  const totalAllocation = tiers.reduce((sum, tier) => sum + tier.allocation, 0);
  const campaignLink = readAccessLink(accessData);
  const fallbackAmount = formatMoney(fallbackReward, 2);
  const primaryReward = activeTiers[0]?.reward || `$${fallbackAmount} cashback`;
  const firstProduct = selectedProducts[0];

  const filteredProducts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return products;
    return products.filter((product) =>
      [product.name, product.category, product.brand, product.description]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [products, searchQuery]);

  const selectCreativeFile = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setImageError("Select an image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setImageError("Image must be 5MB or smaller.");
      return;
    }
    if (imageSrc.startsWith("blob:")) URL.revokeObjectURL(imageSrc);
    setImageSrc(URL.createObjectURL(file));
    setImageError("");
  };

  const toggleProduct = (id: string) => {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
  };

  const removeProduct = (id: string) => {
    setSelectedIds((current) => current.filter((item) => item !== id));
  };

  const copyCampaignLink = async () => {
    if (!campaignLink) return;
    await navigator.clipboard.writeText(campaignLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handlePublish = async () => {
    if (!name.trim() || selectedIds.length === 0 || isPublishing) return;
    await onPublish({
      name: name.trim(),
      description,
      startDate,
      endDate,
      isActive,
      imageSrc,
      dailyBudget: Number(dailyBudget) > 0 ? Number(dailyBudget) : 1,
      fallback: {
        rewardAmount: Number(fallbackReward) > 0 ? Number(fallbackReward).toFixed(2) : "1.00",
        isEnabled: fallbackActive,
        description: fallbackDescription,
      },
      selectedProductIds: selectedIds,
    });
  };

  if (campaignLink) {
    return (
      <div className="w-full max-w-[1180px] mx-auto grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-10 items-start animate-slide-up font-manrope text-left">
        <div className="min-h-[720px] flex flex-col items-center justify-center gap-9">
          <section className="w-full max-w-[640px] bg-white rounded-[24px] p-8 md:p-10 shadow-[0_24px_48px_rgba(19,27,46,0.04)] flex flex-col items-center gap-7">
            <div className="w-full max-w-[292px] aspect-square rounded-[24px] bg-[#FAF8FF] border border-[#EAEDFF] p-8 flex items-center justify-center">
              <img src={qrImageUrl(campaignLink)} alt="Campaign QR code" className="w-full h-full object-contain" />
            </div>

            <div className="text-center">
              <h3 className="font-jakarta font-bold text-xl text-[#131B2E]">Asset Distribution</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-[380px]">
              <a
                href={qrImageUrl(campaignLink)}
                download="campaign-qr.png"
                className="h-[56px] rounded-2xl bg-[#F2F3FF] text-[#131B2E] hover:bg-blue-100 transition-colors flex items-center justify-center gap-3"
              >
                <span className="w-8 h-8 rounded-xl bg-white text-[#001BD2] flex items-center justify-center">
                  <ExternalLink className="w-4 h-4" strokeWidth={2.4} />
                </span>
                <span className="flex flex-col leading-tight">
                  <span className="text-xs font-extrabold">Download PNG</span>
                  <span className="text-[9px] font-bold text-[#64748B] uppercase">300 DPI High Res</span>
                </span>
              </a>
              <a
                href={qrImageUrl(campaignLink, "svg")}
                download="campaign-qr.svg"
                className="h-[56px] rounded-2xl bg-[#F2F3FF] text-[#131B2E] hover:bg-blue-100 transition-colors flex items-center justify-center gap-3"
              >
                <span className="w-8 h-8 rounded-xl bg-white text-[#001BD2] flex items-center justify-center">
                  <QrCode className="w-4 h-4" strokeWidth={2.4} />
                </span>
                <span className="flex flex-col leading-tight">
                  <span className="text-xs font-extrabold">Download SVG</span>
                  <span className="text-[9px] font-bold text-[#64748B] uppercase">Scalable Vector</span>
                </span>
              </a>
            </div>

            <div className="w-full flex flex-col gap-2">
              <span className="text-[10px] font-bold text-[#454656] uppercase tracking-[1.2px]">Campaign Link</span>
              <div className="min-h-12 rounded-xl bg-[#F2F3FF] px-4 py-2 flex items-center gap-3">
                <span className="text-sm font-medium text-[#131B2E] truncate flex-1">{campaignLink}</span>
                <button
                  type="button"
                  onClick={copyCampaignLink}
                  className="h-8 px-3 rounded-lg bg-[#001BD2] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" strokeWidth={2.4} />
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>

            <p className="text-xs text-[#64748B] text-center leading-5 max-w-[380px]">
              Use this QR code in-store, or share the link via email, SMS, or social media.
            </p>
          </section>

          <button
            type="button"
            onClick={onCancel}
            className="w-[220px] h-[56px] rounded-full bg-[#001BD2] text-white text-base font-extrabold shadow-[0_24px_48px_rgba(0,27,210,0.22)] hover:bg-blue-700 cursor-pointer"
          >
            Go to Rebate
          </button>
        </div>

        <aside className="bg-[#F2F3FF] rounded-[28px] p-6 md:p-8 flex flex-col items-center gap-7 min-h-[720px]">
          <div className="w-full">
            <h3 className="font-jakarta font-bold text-xl text-[#131B2E]">Shopper Claim Preview</h3>
            <p className="text-xs text-[#64748B] font-medium mt-1">Real-time view of the customer experience</p>
          </div>

          <div className="w-[280px] rounded-[42px] bg-[#131B2E] border-[5px] border-[#283044] p-3 shadow-[0_24px_48px_rgba(0,0,0,0.22)]">
            <div className="bg-white rounded-[32px] overflow-hidden">
              <div className="h-16 bg-[#001BD2] text-white flex items-center px-5 gap-3">
                <Package className="w-5 h-5" strokeWidth={2.4} />
                <span className="text-sm font-bold truncate">Nibbl Rewards</span>
              </div>
              <div className="p-5 flex flex-col gap-4">
                <div className="h-36 rounded-2xl bg-[#131B2E] flex items-center justify-center overflow-hidden relative">
                  <img
                    src={firstProduct?.imageSrc || imageSrc}
                    alt={firstProduct?.name || "Campaign product"}
                    className="w-[80%] h-[80%] object-contain"
                  />
                  <span className="absolute right-3 top-3 rounded-full bg-[#22A7A0] text-white text-[8px] font-black px-2 py-1 uppercase">
                    Offer Live
                  </span>
                </div>
                <div>
                  <h4 className="font-jakarta font-extrabold text-base text-[#131B2E] leading-5">
                    {firstProduct?.name || name || "Selected product"}
                  </h4>
                  <p className="text-[10px] text-[#64748B] font-medium mt-1">
                    {selectedProducts.length > 1
                      ? `${selectedProducts.length} eligible products`
                      : firstProduct?.category || "Campaign product"}
                  </p>
                </div>
                <div className="bg-[#F2F3FF] rounded-2xl p-4 flex justify-between items-center">
                  <div>
                    <span className="text-[9px] font-bold text-[#454656] uppercase">Reward</span>
                    <p className="text-lg font-black text-[#001BD2] mt-1">{primaryReward}</p>
                  </div>
                  <Check className="w-6 h-6 text-[#001BD2]" strokeWidth={2.5} />
                </div>
                <button className="w-full h-11 bg-[#001BD2] text-white font-bold text-sm rounded-2xl">Claim Offer</button>
              </div>
            </div>
          </div>

          <div className="w-full bg-white border border-[#DAE2FD] rounded-[20px] p-5 flex gap-3 text-left">
            <span className="w-5 h-5 rounded-full bg-[#E2E7FF] text-[#001BD2] text-xs font-extrabold flex items-center justify-center shrink-0">i</span>
            <div>
              <h4 className="font-jakarta font-bold text-sm text-[#131B2E]">Working Preview</h4>
              <p className="text-xs text-[#454656] leading-5 mt-1">
                See how the claim process works and what details are shared with your customers.
              </p>
            </div>
          </div>
        </aside>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1180px] mx-auto flex flex-col gap-7 animate-slide-up text-left font-manrope">
      <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-5">
        <div>
          <span className="inline-flex items-center gap-2 text-[11px] font-extrabold text-[#001BD2] uppercase tracking-[1.1px]">
            <Rocket className="w-4 h-4" strokeWidth={2.4} />
            {mode === "edit" ? "Edit publish setup" : "Campaign publish setup"}
          </span>
          <h2 className="text-3xl font-extrabold font-jakarta text-[#131B2E] tracking-tight mt-2">
            Publish Rebate Campaign
          </h2>
          <p className="text-sm text-[#64748B] font-medium leading-6 mt-2 max-w-[720px]">
            Build the campaign, choose one or more products, set rewards, then publish from this page.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="h-11 px-5 rounded-xl bg-white border border-slate-200 text-sm font-bold text-[#454656] hover:bg-slate-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handlePublish}
            disabled={!name.trim() || selectedIds.length === 0 || isPublishing}
            className="h-11 px-6 rounded-xl bg-[#001BD2] text-white text-sm font-extrabold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer inline-flex items-center gap-2 shadow-[0_16px_32px_rgba(0,27,210,0.18)]"
          >
            <Rocket className="w-4 h-4" strokeWidth={2.4} />
            {isPublishing ? "Publishing..." : mode === "edit" ? "Save & Refresh Link" : "Publish Campaign"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-7 items-start">
        <div className="flex flex-col gap-7 min-w-0">
          <section className="bg-white border border-slate-100 rounded-[20px] p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-[#131B2E]">Campaign Details</h3>
                <p className="text-xs text-[#64748B] font-medium mt-1">Name, schedule, status, and visual identity.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsActive(!isActive)}
                className={`w-11 h-6 rounded-full p-0.5 transition-colors cursor-pointer ${isActive ? "bg-[#001BD2]" : "bg-slate-200"}`}
                aria-label="Toggle active status"
              >
                <span className={`block w-5 h-5 rounded-full bg-white transition-transform ${isActive ? "translate-x-5" : "translate-x-0"}`} />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_240px] gap-6 mt-6">
              <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-[#454656] uppercase tracking-wider">Campaign Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="e.g. Summer Cashback Rewards"
                    className="w-full h-11 bg-white border border-slate-200 rounded-xl px-4 text-sm focus:outline-none focus:border-[#001BD2] text-slate-800 placeholder-[#757688]"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-[#454656] uppercase tracking-wider">Campaign Description</label>
                  <textarea
                    rows={4}
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Describe the offer shoppers will see..."
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#001BD2] text-slate-800 placeholder-[#757688] resize-none"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-bold text-[#454656] uppercase tracking-wider">Start Date</span>
                    <span className="relative">
                      <Calendar className="w-4 h-4 text-[#757688] absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="date"
                        value={startDate}
                        onChange={(event) => setStartDate(event.target.value)}
                        className="w-full h-11 bg-white border border-slate-200 rounded-xl pl-10 pr-4 text-sm focus:outline-none focus:border-[#001BD2] text-slate-800"
                      />
                    </span>
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-bold text-[#454656] uppercase tracking-wider">End Date</span>
                    <span className="relative">
                      <Calendar className="w-4 h-4 text-[#757688] absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="date"
                        value={endDate}
                        onChange={(event) => setEndDate(event.target.value)}
                        className="w-full h-11 bg-white border border-slate-200 rounded-xl pl-10 pr-4 text-sm focus:outline-none focus:border-[#001BD2] text-slate-800"
                      />
                    </span>
                  </label>
                </div>
              </div>

              <div className="min-w-0">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  className="hidden"
                  onChange={(event) => selectCreativeFile(event.target.files?.[0])}
                />
                <div
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    selectCreativeFile(event.dataTransfer.files?.[0]);
                  }}
                  className="h-full min-h-[230px] rounded-2xl border border-dashed border-[#C5C5D9] bg-[#FAF8FF] p-4 flex flex-col gap-4"
                >
                  <div className="h-[118px] rounded-xl bg-white border border-slate-100 overflow-hidden flex items-center justify-center">
                    <img src={imageSrc} alt="Campaign creative preview" className="w-full h-full object-cover" />
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="h-10 rounded-xl bg-[#E2E7FF] text-[#001BD2] text-xs font-extrabold hover:bg-blue-100 cursor-pointer inline-flex items-center justify-center gap-2"
                  >
                    <ImagePlus className="w-4 h-4" strokeWidth={2.4} />
                    Upload Creative
                  </button>
                  <p className="text-[10px] text-[#64748B] leading-4">PNG, JPG, or WebP. Recommended 1200x400px.</p>
                  {imageError && <p className="text-[10px] font-bold text-[#BA1A1A]">{imageError}</p>}
                </div>
              </div>
            </div>
          </section>

          <section className="bg-white border border-slate-100 rounded-[20px] p-6 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-[#131B2E]">Product Sections</h3>
                <p className="text-xs text-[#64748B] font-medium mt-1">Store selection is treated as product selection for receipt matching.</p>
              </div>
              <div className="relative w-full md:w-[280px]">
                <Search className="w-4 h-4 text-[#757688] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="w-full h-10 bg-white border border-slate-200 rounded-xl pl-10 pr-4 text-xs focus:outline-none focus:border-[#001BD2] text-slate-800"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mt-5 min-h-8">
              {selectedProducts.map((product) => (
                <span key={product.id} className="inline-flex items-center gap-2 rounded-lg bg-[#E2E7FF] px-3 py-2 text-xs font-bold text-[#001BD2]">
                  {product.name}
                  <button type="button" onClick={() => removeProduct(product.id)} aria-label={`Remove ${product.name}`}>
                    <X className="w-3.5 h-3.5" strokeWidth={2.4} />
                  </button>
                </span>
              ))}
              {selectedProducts.length === 0 && (
                <span className="text-xs font-semibold text-slate-400">Select at least one product section.</span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-5">
              {filteredProducts.map((product) => {
                const isSelected = selectedIds.includes(product.id);
                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => toggleProduct(product.id)}
                    className={`text-left rounded-2xl border p-4 h-[172px] transition-all cursor-pointer flex gap-4 ${
                      isSelected ? "border-[#001BD2] bg-[#F2F3FF] ring-2 ring-[#001BD2]/10" : "border-slate-100 bg-white hover:bg-slate-50"
                    }`}
                  >
                    <div className="w-20 h-20 rounded-xl bg-white border border-slate-100 overflow-hidden flex items-center justify-center shrink-0">
                      <img src={product.imageSrc} alt={product.name} className="w-full h-full object-contain" />
                    </div>
                    <div className="min-w-0 flex flex-col gap-1">
                      <span className="flex items-center gap-2 text-sm font-extrabold text-[#131B2E]">
                        <span className="truncate">{product.name}</span>
                        {isSelected && <Check className="w-4 h-4 text-[#001BD2] shrink-0" strokeWidth={2.5} />}
                      </span>
                      <span className="text-[10px] font-bold uppercase text-[#001BD2] truncate">{product.category}</span>
                      <span className="text-[11px] text-[#64748B] leading-4 line-clamp-3">
                        {product.description || product.brand || "Product details will be used for receipt eligibility."}
                      </span>
                    </div>
                  </button>
                );
              })}
              {filteredProducts.length === 0 && (
                <div className="col-span-full rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm font-semibold text-slate-400">
                  No products found in the backend product library.
                </div>
              )}
            </div>
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] gap-7">
            <div className="bg-white border border-slate-100 rounded-[20px] p-6 shadow-sm flex flex-col gap-5">
              <h3 className="text-base font-bold text-[#131B2E]">Budget</h3>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-bold text-[#454656] uppercase tracking-wider">Daily Budget</span>
                <span className="relative">
                  <DollarSign className="w-4 h-4 text-[#757688] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="number"
                    min="1"
                    value={dailyBudget}
                    onChange={(event) => setDailyBudget(event.target.value)}
                    className="w-full h-11 bg-[#F2F3FF] border border-transparent rounded-xl pl-10 pr-4 text-sm font-extrabold text-[#131B2E] focus:outline-none focus:border-[#001BD2]"
                  />
                </span>
              </label>
              <div className="border-t border-slate-100 pt-5 flex flex-col gap-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-xs font-extrabold text-[#131B2E] uppercase">Fallback Offer</h4>
                    <p className="text-[10px] text-[#64748B] mt-1">Used when tier rules are not met.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFallbackActive(!fallbackActive)}
                    className={`w-10 h-5 rounded-full p-0.5 transition-colors cursor-pointer ${fallbackActive ? "bg-[#001BD2]" : "bg-slate-200"}`}
                    aria-label="Toggle fallback offer"
                  >
                    <span className={`block w-4 h-4 rounded-full bg-white transition-transform ${fallbackActive ? "translate-x-5" : "translate-x-0"}`} />
                  </button>
                </div>
                {fallbackActive && (
                  <>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={fallbackReward}
                      onChange={(event) => setFallbackReward(event.target.value)}
                      className="w-full h-10 bg-white border border-slate-200 rounded-xl px-4 text-xs font-bold text-[#131B2E]"
                    />
                    <input
                      type="text"
                      value={fallbackDescription}
                      onChange={(event) => setFallbackDescription(event.target.value)}
                      className="w-full h-10 bg-white border border-slate-200 rounded-xl px-4 text-xs font-bold text-[#131B2E]"
                    />
                  </>
                )}
              </div>
            </div>

            <div className="bg-white border border-slate-100 rounded-[20px] p-6 shadow-sm min-w-0">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-[#131B2E]">Reward Tiers</h3>
                  <p className="text-xs text-[#64748B] font-medium mt-1">Allocations must total 100% before activation.</p>
                </div>
                <button
                  type="button"
                  onClick={onAddCustomTierClick}
                  className="h-9 px-3 rounded-lg bg-[#E2E7FF] text-[#001BD2] text-xs font-extrabold hover:bg-blue-100 cursor-pointer inline-flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" strokeWidth={2.4} />
                  Add Tier
                </button>
              </div>
              <div className="mt-5 overflow-hidden border border-slate-100 rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 h-10 text-[#454656] font-bold">
                      <th className="px-4">Tier</th>
                      <th className="px-3">Reward</th>
                      <th className="px-3">Max Payout</th>
                      <th className="px-3 text-right">Allocation</th>
                      <th className="px-4 text-right">Edit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tiers.map((tier) => (
                      <tr key={tier.id} className="h-12 border-t border-slate-100 font-semibold text-[#131B2E]">
                        <td className="px-4 text-[#001BD2]">{tier.name}</td>
                        <td className="px-3">{tier.reward}</td>
                        <td className="px-3">${tier.maxPayout}</td>
                        <td className="px-3 text-right">{tier.allocation}%</td>
                        <td className="px-4 text-right">
                          <button
                            type="button"
                            onClick={() => onEditTierClick(tier)}
                            className="ml-auto w-8 h-8 rounded-full bg-[#001BD2] hover:bg-blue-700 transition-colors flex items-center justify-center cursor-pointer"
                            aria-label={`Edit ${tier.name}`}
                          >
                            <Pencil className="w-3.5 h-3.5 text-white" strokeWidth={2.4} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold text-[#131B2E] uppercase">Allocation Meter</span>
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-lg ${totalAllocation === 100 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                    {totalAllocation}% allocated
                  </span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 rounded-full flex overflow-hidden mt-3">
                  {tiers.map((tier, index) => {
                    const colors = ["bg-[#001BD2]", "bg-[#22A7A0]", "bg-[#F59E0B]", "bg-[#7C3AED]"];
                    return <span key={tier.id} className={colors[index % colors.length]} style={{ width: `${Math.min(tier.allocation, 100)}%` }} />;
                  })}
                </div>
              </div>
            </div>
          </section>
        </div>

        <aside className="flex flex-col gap-7 min-w-0">
          <section className="bg-[#131B2E] rounded-[20px] p-5 shadow-sm text-white">
            <h3 className="text-base font-bold">Shopper Preview</h3>
            <div className="mt-5 rounded-[32px] bg-white text-[#131B2E] overflow-hidden border-[6px] border-[#283044] shadow-[0_24px_48px_rgba(0,0,0,0.18)]">
              <div className="h-16 bg-[#001BD2] text-white flex items-center px-5 gap-3">
                <Package className="w-5 h-5" strokeWidth={2.4} />
                <span className="text-sm font-bold truncate">Claim Reward</span>
              </div>
              <div className="p-5 flex flex-col gap-4">
                <div className="h-44 rounded-2xl bg-[#F2F3FF] flex items-center justify-center overflow-hidden">
                  <img
                    src={firstProduct?.imageSrc || imageSrc}
                    alt={firstProduct?.name || "Campaign product"}
                    className="w-full h-full object-contain"
                  />
                </div>
                <div>
                  <h4 className="font-jakarta font-extrabold text-lg text-[#131B2E] leading-6">
                    {firstProduct?.name || name || "Selected product"}
                  </h4>
                  <p className="text-xs text-[#64748B] font-medium mt-1">
                    {selectedProducts.length > 1
                      ? `${selectedProducts.length} eligible products`
                      : firstProduct?.category || "Campaign product"}
                  </p>
                </div>
                <div className="bg-[#F2F3FF] rounded-2xl p-4 flex justify-between items-center">
                  <div>
                    <span className="text-[10px] font-bold text-[#454656] uppercase">Reward</span>
                    <p className="text-xl font-black text-[#001BD2] mt-1">{primaryReward}</p>
                  </div>
                  <Check className="w-6 h-6 text-[#001BD2]" strokeWidth={2.5} />
                </div>
                <button className="w-full h-12 bg-[#001BD2] text-white font-bold text-sm rounded-2xl">Submit Receipt</button>
              </div>
            </div>
          </section>

        </aside>
      </div>
    </div>
  );
}
