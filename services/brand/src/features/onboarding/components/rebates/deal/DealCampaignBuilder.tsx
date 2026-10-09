/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, Search } from "lucide-react";
import { ApiRecord } from "@/lib/api/backendApi";
import { DealCampaignInput, RetailerOption, useBrandApiStore } from "@/stores/useBrandApiStore";
import NibblReviewComment from "../NibblReviewComment";
import OfferPreview from "./OfferPreview";
import RetailerPicker from "./RetailerPicker";
import GeographyPicker, { GeoArea, Geography } from "./GeographyPicker";
import {
  COOLDOWN_OPTIONS,
  DEAL_TYPES,
  DealType,
  claimCapacity,
  suggestedWording,
  systemRules,
} from "./dealRules";

interface DealCampaignBuilderProps {
  /** Existing campaign to edit; null creates a new one. */
  campaign: ApiRecord | null;
  onCancel: () => void;
  onSaved: (campaign: ApiRecord) => void;
}

const dateValue = (value: unknown) => (typeof value === "string" && value ? value.slice(0, 10) : "");
const toIso = (date: string) => (date ? new Date(`${date}T00:00:00`).toISOString() : null);
const ids = (value: unknown) =>
  Array.isArray(value)
    ? value.map((v) => (v && typeof v === "object" ? String((v as { id?: unknown }).id) : String(v)))
    : [];

const inputClass =
  "w-full h-11 px-3 rounded-xl border border-[#E0E3F5] bg-white text-sm text-[#131B2E] outline-none focus:border-[#001BD2] focus:ring-2 focus:ring-[#001BD2]/15";
const labelClass = "flex flex-col gap-1.5 text-xs font-bold text-[#454656] uppercase tracking-wider";

const Section = ({ n, title, children }: { n: string; title: string; children: React.ReactNode }) => (
  <section className="bg-white border border-[#EAEDFF] rounded-[20px] p-6 flex flex-col gap-4 shadow-sm">
    <h2 className="font-jakarta text-base font-bold text-[#131B2E]">
      <span className="text-[#001BD2] mr-2">{n}</span>
      {title}
    </h2>
    {children}
  </section>
);

export default function DealCampaignBuilder({ campaign, onCancel, onSaved }: DealCampaignBuilderProps) {
  const products = useBrandApiStore((state) => state.products);
  const saveDealCampaign = useBrandApiStore((state) => state.saveDealCampaign);
  const loadRetailers = useBrandApiStore((state) => state.loadRetailers);
  const addRetailer = useBrandApiStore((state) => state.addRetailer);

  const pending = (campaign?.pending_revision as ApiRecord | null)?.changes as ApiRecord | undefined;
  // Show the brand's pending (unapproved) edits when reopening a revision.
  const initial = (key: string) => (pending && key in pending ? pending[key] : campaign?.[key]);

  const [name, setName] = useState(String(initial("name") ?? ""));
  const [startDate, setStartDate] = useState(dateValue(initial("start_at")));
  const [endDate, setEndDate] = useState(dateValue(initial("end_at")));
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState(String(campaign?.image_url ?? ""));
  const [selectedIds, setSelectedIds] = useState<string[]>(ids(initial("product") ?? campaign?.products));
  const [search, setSearch] = useState("");
  const [dealType, setDealType] = useState<DealType>((initial("deal_type") as DealType) || "free");
  const [maxRebate, setMaxRebate] = useState(String(initial("max_rebate") ?? ""));
  const [fixedReward, setFixedReward] = useState(String(initial("fixed_reward") ?? ""));
  const [quantity, setQuantity] = useState(Number(initial("required_quantity") ?? 1) || 1);
  const [headline, setHeadline] = useState(String(initial("offer_headline") ?? ""));
  const [description, setDescription] = useState(String(initial("offer_description") ?? ""));
  // Wording follows Nibbl's suggestion until the brand edits it.
  const [wordingEdited, setWordingEdited] = useState(Boolean(campaign));
  const [retailerRequired, setRetailerRequired] = useState(
    initial("retailer_required") != null ? Boolean(initial("retailer_required")) : Boolean(String(initial("allowed_merchants") ?? ""))
  );
  const [retailerIds, setRetailerIds] = useState<string[]>(ids(initial("retailers")));
  const [featuredIds, setFeaturedIds] = useState<string[]>(ids(initial("featured_retailers")));
  // Directory starts with the campaign's own retailers so names show before loading.
  const [directory, setDirectory] = useState<RetailerOption[]>(() =>
    ((campaign?.retailers as { id: string; name: string }[] | undefined) ?? []).map((r) => ({ ...r, is_verified: true }))
  );
  const [desired, setDesired] = useState(String(initial("desired_redemptions") ?? ""));
  const [rate, setRate] = useState(String(initial("estimated_redemption_rate") ?? "30"));
  const [cooldown, setCooldown] = useState(
    initial("one_time_only") ? "one_time" : String(initial("cooldown_days") ?? "30")
  );
  const [geography, setGeography] = useState<Geography>((initial("geography") as Geography) || "nationwide");
  const [geoStates, setGeoStates] = useState<string[]>(
    Array.isArray(initial("geography_states")) ? (initial("geography_states") as string[]) : []
  );
  const [geoAreas, setGeoAreas] = useState<GeoArea[]>(
    Array.isArray(initial("geography_areas")) ? (initial("geography_areas") as GeoArea[]) : []
  );
  const [busy, setBusy] = useState<"draft" | "submit" | null>(null);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const reviewStatus = String(campaign?.review_status ?? "not_submitted");
  const isApproved = reviewStatus === "approved";
  const selectedProducts = products.filter((p) => selectedIds.includes(p.id));
  const firstName = selectedProducts[0]?.name ?? "";
  const categories = new Set(selectedProducts.map((p) => p.category.trim().toLowerCase()).filter(Boolean));
  const capacity = claimCapacity(desired, rate);
  const suggestion = suggestedWording(dealType, firstName, maxRebate, fixedReward, quantity);
  const shownHeadline = wordingEdited ? headline : suggestion.headline;
  const shownDescription = wordingEdited ? description : suggestion.description;
  const nameOf = (id: string) => directory.find((r) => r.id === id)?.name ?? "";
  const retailerNames = retailerIds.map(nameOf).filter(Boolean);
  const merchants = retailerRequired ? retailerNames.join(", ") : "";

  useEffect(() => {
    let cancelled = false;
    loadRetailers()
      .then((list) => {
        if (!cancelled) setDirectory((cur) => [...list, ...cur.filter((c) => !list.some((r) => r.id === c.id))]);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [loadRetailers]);

  const handleAddRetailer = async (retailerName: string) => {
    const retailer = await addRetailer(retailerName);
    setDirectory((cur) => (cur.some((r) => r.id === retailer.id) ? cur : [...cur, retailer]));
    return retailer;
  };

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? products.filter((p) => `${p.name} ${p.category}`.toLowerCase().includes(q)) : products;
  }, [products, search]);

  const problems = (): string[] => {
    const out: string[] = [];
    if (!name.trim()) out.push("Enter the internal campaign name.");
    if (!startDate) out.push("Choose a start date.");
    if (endDate && startDate && endDate < startDate) out.push("The end date must be after the start date.");
    if (!selectedIds.length) out.push("Select at least one eligible product.");
    if (categories.size > 1) out.push("All eligible products must belong to the same category.");
    if (dealType === "buy_x_get_y") {
      if (!(Number(fixedReward) > 0)) out.push("Enter the fixed reward.");
    } else if (!(Number(maxRebate) > 0)) out.push("Enter the maximum rebate.");
    if (!shownHeadline.trim() || !shownDescription.trim()) out.push("Enter the shopper headline and description.");
    if (retailerRequired && !retailerIds.length) out.push("Select the retailers where receipts are accepted, or choose Any Retailer.");
    if (!capacity) out.push("Enter desired redemptions and an estimated redemption rate (1–100%).");
    if (geography === "states" && !geoStates.length) out.push("Select at least one state.");
    if (geography === "zip_radius" && !geoAreas.some((a) => /^\d{5}$/.test(a.zip)))
      out.push("Enter at least one 5-digit ZIP code.");
    return out;
  };

  const pickImage = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError("Select an image file.");
    if (file.size > 5 * 1024 * 1024) return setError("Image must be 5MB or smaller.");
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setError("");
  };

  const save = async (submit: boolean) => {
    setError("");
    if (submit) {
      const issues = problems();
      if (issues.length) return setError(issues.join(" "));
    } else if (!name.trim() || !selectedIds.length) {
      return setError("A draft needs a name and at least one product.");
    }
    const body: DealCampaignInput = {
      name: name.trim(),
      // Unchanged dates go back exactly as stored (no timezone drift).
      start_at: startDate === dateValue(initial("start_at")) ? (initial("start_at") as string | null) ?? null : toIso(startDate),
      end_at: endDate === dateValue(initial("end_at")) ? (initial("end_at") as string | null) ?? null : toIso(endDate),
      product: selectedIds,
      deal_type: dealType,
      max_rebate: dealType === "buy_x_get_y" ? null : maxRebate || null,
      fixed_reward: dealType === "buy_x_get_y" ? fixedReward || null : null,
      required_quantity: dealType === "buy_x_get_y" ? quantity : 1,
      offer_headline: shownHeadline.trim(),
      offer_description: shownDescription.trim(),
      desired_redemptions: Number(desired) || 1,
      estimated_redemption_rate: rate || "100",
      cooldown_days: cooldown === "one_time" ? 0 : Number(cooldown),
      one_time_only: cooldown === "one_time",
      retailers: retailerIds,
      featured_retailers: featuredIds,
      retailer_required: retailerRequired,
      geography,
      geography_states: geography === "states" ? geoStates : [],
      geography_areas: geography === "zip_radius" ? geoAreas.filter((a) => a.zip) : [],
    };
    setBusy(submit ? "submit" : "draft");
    try {
      const saved = await saveDealCampaign(campaign ? String(campaign.id) : null, body, {
        image: imageFile,
        submit,
      });
      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the campaign.");
    } finally {
      setBusy(null);
    }
  };

  const primaryLabel = isApproved
    ? "Submit changes for review"
    : reviewStatus === "changes_requested"
      ? "Resubmit for review"
      : "Submit for review";

  return (
    <div className="w-full max-w-[1240px] mx-auto flex flex-col gap-6 font-manrope text-left animate-slide-up">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-jakarta text-2xl font-extrabold text-[#131B2E]">
            {campaign ? "Edit rebate campaign" : "Create rebate campaign"}
          </h1>
          <p className="text-sm text-[#64748B] mt-1">
            {isApproved
              ? "Changes go to Nibbl for review. The approved version stays live until they're approved."
              : "Save a draft anytime. Submitting sends it to Nibbl for review."}
          </p>
        </div>
        <button onClick={onCancel} className="text-sm font-bold text-[#454656] hover:text-[#001BD2] cursor-pointer">
          Cancel
        </button>
      </div>

      {campaign && (
        <NibblReviewComment
          comment={String(campaign.review_comment ?? "")}
          label="Nibbl's comment — make these changes, then resubmit"
        />
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start">
        <div className="flex flex-col gap-5">
          <Section n="①" title="Campaign basics">
            <label className={labelClass}>
              Internal campaign name
              <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
              <span className="normal-case font-medium tracking-normal text-[#94A3B8]">
                Visible only to your team and Nibbl.
              </span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className={labelClass}>
                Start date
                <input type="date" className={inputClass} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </label>
              <label className={labelClass}>
                End date (optional)
                <input type="date" className={inputClass} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </label>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-24 h-24 rounded-2xl bg-[#F2F3FF] overflow-hidden flex items-center justify-center">
                {imagePreview ? (
                  <img src={imagePreview} alt="Campaign" className="w-full h-full object-cover" />
                ) : (
                  <ImagePlus className="w-6 h-6 text-[#94A3B8]" />
                )}
              </div>
              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="h-10 px-4 rounded-full bg-[#F2F3FF] text-[#001BD2] text-sm font-bold cursor-pointer"
                >
                  {imagePreview ? "Change campaign image" : "Upload campaign image"}
                </button>
                <span className="text-xs text-[#94A3B8]">Shown at the top of the shopper offer. PNG or JPG, up to 5MB.</span>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => pickImage(e.target.files?.[0])}
              />
            </div>
          </Section>

          <Section n="②" title="Eligible products">
            <div className="relative">
              <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-3.5" />
              <input
                className={`${inputClass} pl-9`}
                placeholder="Search your product library"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="max-h-64 overflow-y-auto flex flex-col divide-y divide-[#F1F2FA] border border-[#F1F2FA] rounded-xl">
              {filteredProducts.map((product) => (
                <label key={product.id} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-[#FAF8FF]">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(product.id)}
                    onChange={() =>
                      setSelectedIds((cur) =>
                        cur.includes(product.id) ? cur.filter((id) => id !== product.id) : [...cur, product.id]
                      )
                    }
                  />
                  <img src={product.imageSrc} alt="" className="w-9 h-9 rounded-lg object-cover bg-[#F2F3FF]" />
                  <span className="text-sm font-semibold text-[#131B2E] flex-1">{product.name}</span>
                  <span className="text-xs text-[#94A3B8]">{product.category || "No category"}</span>
                </label>
              ))}
              {filteredProducts.length === 0 && (
                <p className="px-3 py-6 text-center text-sm text-[#94A3B8]">No products found.</p>
              )}
            </div>
            {categories.size > 1 && (
              <p className="text-sm font-semibold text-[#BA1A1A]">All eligible products must belong to the same category.</p>
            )}
          </Section>

          <Section n="③" title="Offer setup">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {DEAL_TYPES.map((deal) => (
                <button
                  key={deal.value}
                  type="button"
                  onClick={() => setDealType(deal.value)}
                  className={`text-left rounded-2xl border p-4 cursor-pointer transition-colors ${
                    dealType === deal.value ? "border-[#001BD2] bg-[#F2F3FF]" : "border-[#EAEDFF] hover:bg-[#FAF8FF]"
                  }`}
                >
                  <span className="block text-sm font-bold text-[#131B2E]">{deal.label}</span>
                  <span className="block text-xs text-[#64748B] mt-1">{deal.hint}</span>
                </button>
              ))}
            </div>
          </Section>

          <Section n="④" title="Offer details & shopper wording">
            {dealType === "buy_x_get_y" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className={labelClass}>
                  Required quantity
                  <select className={inputClass} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))}>
                    {[1, 2, 3].map((q) => (
                      <option key={q} value={q}>
                        {q}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={labelClass}>
                  Fixed reward ($)
                  <input type="number" min="0.01" step="0.01" className={inputClass} value={fixedReward} onChange={(e) => setFixedReward(e.target.value)} />
                </label>
              </div>
            ) : (
              <label className={labelClass}>
                Maximum rebate ($)
                <input type="number" min="0.01" step="0.01" className={inputClass} value={maxRebate} onChange={(e) => setMaxRebate(e.target.value)} />
                <span className="normal-case font-medium tracking-normal text-[#94A3B8]">
                  The most Nibbl will reimburse for one approved redemption. The actual reward may be lower based on the verified purchase price.
                </span>
              </label>
            )}
            <label className={labelClass}>
              Shopper offer headline
              <input
                className={inputClass}
                value={shownHeadline}
                onChange={(e) => {
                  if (!wordingEdited) setDescription(shownDescription);
                  setWordingEdited(true);
                  setHeadline(e.target.value);
                }}
              />
            </label>
            <label className={labelClass}>
              Shopper offer description
              <textarea
                className={`${inputClass} h-24 py-2`}
                value={shownDescription}
                onChange={(e) => {
                  if (!wordingEdited) setHeadline(shownHeadline);
                  setWordingEdited(true);
                  setDescription(e.target.value);
                }}
              />
            </label>
            <button
              type="button"
              onClick={() => setWordingEdited(false)}
              className="self-start text-xs font-bold text-[#001BD2] cursor-pointer"
            >
              Use Nibbl&apos;s suggested wording
            </button>
            <div className="bg-[#FAF8FF] rounded-xl p-4">
              <span className="text-[10px] font-bold text-[#454656]/60 uppercase tracking-wider">
                System rules (locked)
              </span>
              <ul className="mt-2 list-disc pl-5 text-sm text-[#454656] flex flex-col gap-1">
                {systemRules(dealType, maxRebate, fixedReward, quantity).map((rule) => (
                  <li key={rule}>{rule}</li>
                ))}
              </ul>
            </div>
          </Section>

          <Section n="⑤" title="Retailer availability">
            <RetailerPicker
              directory={directory}
              selected={retailerIds}
              featured={featuredIds}
              onChange={(selected, featured) => {
                setRetailerIds(selected);
                setFeaturedIds(featured);
              }}
              onAdd={handleAddRetailer}
            />
          </Section>

          <Section n="⑥" title="Receipt eligibility">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { value: false, title: "Any Retailer", text: "Receipts from any retailer qualify when the eligible product and purchase details are identifiable." },
                { value: true, title: "Retailer Required", text: "Shoppers must buy from one of the retailers selected above. The receipt must clearly show the retailer name." },
              ].map((opt) => (
                <button
                  key={opt.title}
                  type="button"
                  onClick={() => setRetailerRequired(opt.value)}
                  className={`text-left rounded-2xl border p-4 cursor-pointer ${
                    retailerRequired === opt.value ? "border-[#001BD2] bg-[#F2F3FF]" : "border-[#EAEDFF] hover:bg-[#FAF8FF]"
                  }`}
                >
                  <span className="block text-sm font-bold text-[#131B2E]">{opt.title}</span>
                  <span className="block text-xs text-[#64748B] mt-1">{opt.text}</span>
                </button>
              ))}
            </div>
            {retailerRequired && (
              <p className="text-xs text-[#454656]">
                Eligible receipt retailers: <b>{retailerNames.join(", ") || "select retailers above"}</b>
              </p>
            )}
          </Section>

          <Section n="⑦" title="25-hour claim capacity">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className={labelClass}>
                Desired redemptions per 25 hours
                <input type="number" min="1" step="1" className={inputClass} value={desired} onChange={(e) => setDesired(e.target.value)} />
              </label>
              <label className={labelClass}>
                Estimated redemption rate (%)
                <input type="number" min="1" max="100" step="1" className={inputClass} value={rate} onChange={(e) => setRate(e.target.value)} />
              </label>
            </div>
            <div className="bg-[#F2F3FF] rounded-xl p-4 text-sm text-[#131B2E]">
              <span className="font-bold">25-Hour Claim Capacity: {capacity ?? "—"} claims</span>
              <span className="block text-xs text-[#64748B] mt-1">
                Desired redemptions ÷ estimated redemption rate, rounded up. Once reached, the campaign pauses until the next
                25-hour cycle. Expired or abandoned claims don&apos;t return to the cycle.
              </span>
            </div>
          </Section>

          <Section n="⑧" title="Campaign controls">
            <span className="text-xs font-bold text-[#454656] uppercase tracking-wider">Customer cooldown</span>
            <select className={inputClass} value={cooldown} onChange={(e) => setCooldown(e.target.value)}>
              {COOLDOWN_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-[#64748B]">
              Cooldown begins after an approved redemption. An active claim always prevents another claim for this campaign.
            </p>
            <span className="text-xs font-bold text-[#454656] uppercase tracking-wider mt-2">Discovery geography</span>
            <GeographyPicker
              geography={geography}
              states={geoStates}
              areas={geoAreas}
              onChange={(g, st, ar) => {
                setGeography(g);
                setGeoStates(st);
                setGeoAreas(ar);
              }}
            />
          </Section>

          {error && (
            <div className="bg-red-50 border border-red-100 text-red-700 text-sm font-semibold rounded-xl px-4 py-3">{error}</div>
          )}
          <div className="flex flex-wrap gap-3">
            {!isApproved && (
              <button
                onClick={() => save(false)}
                disabled={busy !== null}
                className="h-12 px-6 rounded-full border border-[#001BD2] text-[#001BD2] font-bold text-sm disabled:opacity-50 cursor-pointer"
              >
                {busy === "draft" ? "Saving…" : "Save draft"}
              </button>
            )}
            <button
              onClick={() => save(true)}
              disabled={busy !== null}
              className="h-12 px-6 rounded-full bg-[#001BD2] hover:bg-blue-700 text-white font-bold text-sm disabled:opacity-50 cursor-pointer"
            >
              {busy === "submit" ? "Submitting…" : primaryLabel}
            </button>
          </div>
        </div>

        <div className="xl:sticky xl:top-6">
          <OfferPreview
            imageUrl={imagePreview}
            headline={shownHeadline}
            description={shownDescription}
            products={selectedProducts.map((p) => ({ id: p.id, name: p.name, imageSrc: p.imageSrc }))}
            dealType={dealType}
            maxRebate={maxRebate}
            fixedReward={fixedReward}
            allowedMerchants={merchants}
            featuredRetailers={featuredIds.map(nameOf).filter(Boolean)}
            whereToBuy={retailerNames}
            cooldownDays={cooldown === "one_time" ? 0 : Number(cooldown)}
            oneTimeOnly={cooldown === "one_time"}
          />
        </div>
      </div>
    </div>
  );
}
