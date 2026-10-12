/* eslint-disable @next/next/no-img-element */
import { useMemo, useState } from "react";
import { Clock, DollarSign, GripVertical, Lock, MessageSquare, Plus, Search, ShieldCheck, Sparkles, Star, Upload, X } from "lucide-react";
import { ApiRecord, apiClient, backendApi } from "@/lib/api/backendApi";
import { useBrandApiStore } from "@/stores/useBrandApiStore";
import TestReviewChatModal from "./TestReviewChatModal";

interface ReviewCampaignBuilderProps {
  campaign: ApiRecord | null;
  onCancel: () => void;
  onSaved: (campaign: ApiRecord) => void;
}

export const COOLDOWN_OPTIONS = [
  { value: "0", label: "No cooldown" },
  { value: "30", label: "30 days" },
  { value: "60", label: "60 days" },
  { value: "90", label: "90 days" },
  { value: "one_time", label: "One time" },
];

const dateValue = (value: unknown) => (typeof value === "string" && value ? value.slice(0, 10) : "");
const toIso = (date: string) => (date ? new Date(`${date}T00:00:00`).toISOString() : null);
const input = "w-full h-11 px-3 rounded-xl border border-[#E0E3F5] bg-white text-sm text-[#131B2E] outline-none focus:border-[#001BD2]";
const label = "flex flex-col gap-1.5 text-xs font-bold text-[#454656]";

const Section = ({ n, title, badge, actions, children }: {
  n: number; title: string; badge?: string; actions?: React.ReactNode; children: React.ReactNode;
}) => (
  <section className="bg-white border border-[#EAEDFF] rounded-[20px] p-6 flex flex-col gap-4 shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="font-jakarta text-base font-bold text-[#131B2E] flex items-center gap-2">
        <span className="w-6 h-6 rounded-full bg-[#001BD2] text-white text-xs flex items-center justify-center">{n}</span>
        {title}
        {badge && <span className="text-[10px] font-bold bg-[#E2E7FF] text-[#001BD2] px-2 py-0.5 rounded-full">{badge}</span>}
      </h2>
      {actions}
    </div>
    {children}
  </section>
);

/** Master "Create Review Campaign": basics, eligible products, optional
 *  brand question pool (add / suggest / test chat), controls, the locked
 *  Nibbl rules and cost, a live shopper preview, and Save Draft / Submit
 *  for Nibbl Review (published after approval). */
export default function ReviewCampaignBuilder({ campaign, onCancel, onSaved }: ReviewCampaignBuilderProps) {
  const products = useBrandApiStore((s) => s.products);
  const brand = useBrandApiStore((s) => s.brand);
  const saveReviewCampaign = useBrandApiStore((s) => s.saveReviewCampaign);
  const refreshReviewCampaigns = useBrandApiStore((s) => s.refreshReviewCampaigns);
  const reviewCampaignAction = useBrandApiStore((s) => s.reviewCampaignAction);
  const addReviewPrompt = useBrandApiStore((s) => s.addReviewPrompt);
  const deleteReviewPrompt = useBrandApiStore((s) => s.deleteReviewPrompt);
  const suggestReviewPrompts = useBrandApiStore((s) => s.suggestReviewPrompts);
  const brandId = useBrandApiStore((s) => s.selectedBrandId);

  const [campaignId, setCampaignId] = useState(campaign ? String(campaign.id) : "");
  const [name, setName] = useState(String(campaign?.name ?? ""));
  const [startDate, setStartDate] = useState(dateValue(campaign?.start_at));
  const [endDate, setEndDate] = useState(dateValue(campaign?.end_at));
  const [selected, setSelected] = useState<string[]>(
    Array.isArray(campaign?.products) ? (campaign.products as ApiRecord[]).map((p) => String(p.id)) : []
  );
  const [search, setSearch] = useState("");
  const [daily, setDaily] = useState(String(campaign?.daily_opportunities ?? "25"));
  const [cooldown, setCooldown] = useState(
    campaign?.one_time_only ? "one_time" : String(campaign?.product_cooldown_days ?? "90")
  );
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState(String(campaign?.image_url ?? ""));
  const [questions, setQuestions] = useState<{ id?: string; text: string }[]>(
    Array.isArray(campaign?.prompts) ? (campaign.prompts as ApiRecord[]).map((p) => ({ id: String(p.id), text: String(p.text) })) : []
  );
  const [newQuestion, setNewQuestion] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [testing, setTesting] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const plan = (brand?.plan && typeof brand.plan === "object" ? brand.plan : {}) as ApiRecord;
  const reviewFee = Number(plan.review_fee ?? 0);
  const chosen = products.filter((p) => selected.includes(p.id));
  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return products.filter((p) => !selected.includes(p.id) &&
      `${p.name} ${p.flavor} ${p.code ?? ""}`.toLowerCase().includes(q)).slice(0, 8);
  }, [products, search, selected]);

  const validate = (forSubmit: boolean) => {
    if (!name.trim()) return "Enter the internal campaign name.";
    if (!selected.length) return "Select at least one eligible product.";
    if (!(Number(daily) >= 1)) return "Set at least one review opportunity per day.";
    if (endDate && startDate && endDate < startDate) return "The end date must be after the start date.";
    if (forSubmit && !startDate) return "Set a start date before submitting.";
    if (forSubmit && !imagePreview) return "Add a campaign image — it appears on the shopper's review card.";
    return "";
  };

  /** Saves the campaign (creating it on first save) and syncs the question pool. */
  const persist = async (): Promise<ApiRecord> => {
    const saved = await saveReviewCampaign(campaignId || null, {
      name: name.trim(),
      product_ids: selected,
      start_at: startDate === dateValue(campaign?.start_at) ? ((campaign?.start_at as string) ?? null) : toIso(startDate),
      end_at: endDate === dateValue(campaign?.end_at) ? ((campaign?.end_at as string) ?? null) : toIso(endDate),
      daily_opportunities: Number(daily),
      product_cooldown_days: cooldown === "one_time" ? 0 : Number(cooldown),
      one_time_only: cooldown === "one_time",
    });
    const id = String(saved.id);
    setCampaignId(id);
    const kept = new Set(questions.filter((q) => q.id).map((q) => q.id));
    const existing = Array.isArray(saved.prompts) ? (saved.prompts as ApiRecord[]) : [];
    for (const p of existing.filter((p) => !kept.has(String(p.id)))) await deleteReviewPrompt(id, String(p.id));
    for (const q of questions.filter((q) => !q.id)) await addReviewPrompt(id, q.text);
    if (imageFile && brandId) {
      const form = new FormData();
      form.append("image", imageFile);
      await apiClient.request(backendApi.brand.reviewCampaignImage(brandId, id), { body: form });
      setImageFile(null);
    }
    await refreshReviewCampaigns();
    const fresh = useBrandApiStore.getState().reviewCampaigns.find((c) => String(c.id) === id) ?? saved;
    setQuestions(((fresh.prompts ?? []) as ApiRecord[]).map((p) => ({ id: String(p.id), text: String(p.text) })));
    return fresh;
  };

  const run = async (key: string, forSubmit: boolean, task: (saved: ApiRecord) => Promise<void>) => {
    const problem = validate(forSubmit);
    if (problem) return setError(problem);
    setError("");
    setBusy(key);
    try {
      await task(await persist());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the campaign.");
    } finally {
      setBusy("");
    }
  };

  const addQuestion = (text: string) => {
    const clean = text.trim();
    if (!clean || questions.some((q) => q.text === clean)) return;
    setQuestions((qs) => [...qs, { text: clean }]);
    setNewQuestion("");
    setSuggestions((s) => s.filter((x) => x !== text));
  };

  const pickImage = (file?: File) => {
    if (!file || !file.type.startsWith("image/")) return;
    if (file.size > 5 * 1024 * 1024) return setError("Image must be 5MB or smaller.");
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  return (
    <div className="w-full flex flex-col gap-6 font-manrope text-left animate-slide-up">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <button onClick={onCancel} className="text-xs font-bold text-[#64748B] hover:text-[#001BD2] cursor-pointer">← Back</button>
          <h1 className="font-jakarta text-2xl font-extrabold text-[#131B2E] mt-1">{campaign ? "Edit Review Campaign" : "Create Review Campaign"}</h1>
          <p className="text-sm text-[#64748B]">Create a new review campaign to collect authentic product reviews and build shopper trust.</p>
        </div>
        <div className="flex gap-2">
          <button disabled={!!busy} onClick={() => void run("draft", false, async (saved) => onSaved(saved))}
            className="h-11 px-5 rounded-xl bg-[#E2E7FF] text-[#001BD2] font-bold text-sm disabled:opacity-50 cursor-pointer">
            {busy === "draft" ? "Saving…" : campaign && String(campaign.status) !== "draft" ? "Save Changes" : "Save Draft"}
          </button>
          {(!campaign || ["draft", "changes_requested", "rejected"].includes(String(campaign.status))) && (
            <button disabled={!!busy}
              onClick={() => void run("submit", true, async (saved) => {
                await reviewCampaignAction(String(saved.id), "submit");
                onSaved(saved);
              })}
              className="h-11 px-5 rounded-xl bg-[#001BD2] text-white font-bold text-sm disabled:opacity-50 cursor-pointer">
              {busy === "submit" ? "Submitting…" : "Submit for Nibbl Review"}
            </button>
          )}
        </div>
      </div>
      {error && <div className="bg-red-50 border border-red-100 text-red-700 text-sm font-semibold rounded-xl px-4 py-3">{error}</div>}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start">
        <div className="flex flex-col gap-6 min-w-0">
          <Section n={1} title="Campaign Basics">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className={`${label} sm:col-span-3`}>Internal Campaign Name *
                  <input value={name} onChange={(e) => setName(e.target.value)} className={input} placeholder="e.g. Acme Verified Review Rewards" /></label>
                <label className={label}>Start Date *
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={input} /></label>
                <label className={label}>End Date <span className="font-normal text-[#94A3B8]">(Optional)</span>
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={input} /></label>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-bold text-[#454656]">Campaign Image *</span>
                <label className="h-28 rounded-xl border-2 border-dashed border-[#C5C5D9]/60 bg-slate-50 overflow-hidden flex items-center justify-center cursor-pointer">
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => pickImage(e.target.files?.[0])} />
                  {imagePreview ? <img src={imagePreview} alt="" className="w-full h-full object-cover" /> : (
                    <span className="flex items-center gap-1 text-xs font-bold text-[#454656]"><Upload className="w-4 h-4" /> Upload Image</span>
                  )}
                </label>
                <span className="text-[10px] text-[#94A3B8]">Appears on the shopper&apos;s review opportunity card — one or more products, brand imagery or campaign creative.</span>
              </div>
            </div>
          </Section>

          <Section n={2} title="Eligible Products">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3.5 text-[#94A3B8]" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products by name or product ID…"
                className={`${input} pl-9`} />
              {matches.length > 0 && (
                <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-[#EAEDFF] rounded-xl shadow-lg max-h-64 overflow-y-auto">
                  {matches.map((p) => (
                    <button key={p.id} onClick={() => { setSelected((s) => [...s, p.id]); setSearch(""); }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-[#FAF8FF] cursor-pointer">
                      <b>{p.name}</b> <span className="text-[#64748B]">{[p.flavor, p.sizeLabel, p.code].filter(Boolean).join(" · ")}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {chosen.map((p) => (
                <div key={p.id} className="relative border border-[#EAEDFF] rounded-xl p-3 flex gap-3">
                  <img src={p.imageSrc} alt="" className="w-16 h-16 rounded-lg object-contain bg-slate-50" />
                  <div className="text-xs flex flex-col gap-0.5 min-w-0">
                    <b className="text-sm text-[#131B2E] truncate">{p.name}</b>
                    <span className="text-[#454656] truncate">{[p.flavor, p.sizeLabel].filter(Boolean).join(" · ")}</span>
                    <span className="text-[#64748B]">Category: {p.category || "—"} · {p.code || "—"}</span>
                    <span className="flex items-center gap-1 text-[#64748B]"><Star className="w-3 h-3 fill-[#001BD2] text-[#001BD2]" />
                      {p.reviewCount ? `${p.avgRating ?? "—"} · ${p.reviewCount} reviews` : "No reviews yet"}</span>
                  </div>
                  <button onClick={() => setSelected((s) => s.filter((id) => id !== p.id))} aria-label="Remove product"
                    className="absolute top-2 right-2 text-slate-400 hover:text-slate-700 cursor-pointer"><X className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
            {!chosen.length && <p className="text-xs text-[#94A3B8]">Search above to add products from your Product Library.</p>}
            <p className="text-xs text-[#454656] bg-[#F2F3FF] rounded-lg px-3 py-2">ⓘ Each verified receipt match may create one opportunity per eligible product.</p>
          </Section>

          <Section n={3} title="Optional Brand Question Pool" badge="Optional" actions={
            <div className="flex flex-wrap gap-2">
              <button disabled={!!busy}
                onClick={() => void run("suggest", false, async (saved) => setSuggestions(await suggestReviewPrompts(String(saved.id), 4)))}
                className="h-9 px-3 rounded-lg border border-[#001BD2]/40 text-[#001BD2] text-xs font-bold flex items-center gap-1 disabled:opacity-50 cursor-pointer">
                <Sparkles className="w-3.5 h-3.5" /> {busy === "suggest" ? "Suggesting…" : "Suggest Questions"}
              </button>
              <button disabled={!!busy} onClick={() => void run("test", false, async () => setTesting(true))}
                className="h-9 px-3 rounded-lg border border-[#001BD2]/40 text-[#001BD2] text-xs font-bold flex items-center gap-1 disabled:opacity-50 cursor-pointer">
                <MessageSquare className="w-3.5 h-3.5" /> Test Review Chat
              </button>
            </div>
          }>
            <p className="text-xs text-[#64748B] -mt-2">
              Nibbl rotates one brand question into each five-question chat. Remaining questions are generated from the
              confirmed product&apos;s Product Library description and attributes.
            </p>
            <ul className="flex flex-col gap-2">
              {questions.map((q, i) => (
                <li key={q.id ?? `new-${i}`} className="flex items-center gap-2 border border-[#EAEDFF] rounded-xl px-3 py-2 text-sm">
                  <GripVertical className="w-4 h-4 text-[#C5C5D9]" />
                  <span className="flex-1">{q.text}</span>
                  <button onClick={() => setQuestions((qs) => qs.filter((_, j) => j !== i))} aria-label="Remove question"
                    className="text-slate-400 hover:text-red-600 cursor-pointer"><X className="w-4 h-4" /></button>
                </li>
              ))}
            </ul>
            <form onSubmit={(e) => { e.preventDefault(); addQuestion(newQuestion); }} className="flex gap-2">
              <input value={newQuestion} onChange={(e) => setNewQuestion(e.target.value)} placeholder="e.g. What's your favorite flavor and why?" className={input} />
              <button type="submit" className="h-11 px-4 rounded-xl bg-[#E2E7FF] text-[#001BD2] text-sm font-bold flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer">
                <Plus className="w-4 h-4" /> Add Question
              </button>
            </form>
            {suggestions.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {suggestions.map((s) => (
                  <button key={s} onClick={() => addQuestion(s)}
                    className="text-xs border border-dashed border-[#001BD2]/50 text-[#001BD2] rounded-full px-3 py-1.5 cursor-pointer">+ {s}</button>
                ))}
              </div>
            )}
          </Section>

          <Section n={4} title="Campaign Controls">
            <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-4">
              <label className={label}>Desired opportunities per day *
                <input value={daily} onChange={(e) => setDaily(e.target.value)} inputMode="numeric" className={input} /></label>
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-bold text-[#454656]">Customer cooldown *</span>
                <div className="flex flex-wrap gap-2">
                  {COOLDOWN_OPTIONS.map((o) => (
                    <label key={o.value} className={`h-11 px-4 rounded-xl border flex items-center gap-2 text-sm cursor-pointer ${
                      cooldown === o.value ? "border-[#001BD2] bg-[#F2F3FF]" : "border-[#E0E3F5]"}`}>
                      <input type="radio" name="cooldown" checked={cooldown === o.value} onChange={() => setCooldown(o.value)} />
                      {o.label}
                      {o.value === "90" && <span className="text-[10px] font-bold bg-[#E2E7FF] text-[#001BD2] px-2 py-0.5 rounded-full">Recommended</span>}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <p className="text-xs text-[#454656] bg-[#F2F3FF] rounded-lg px-3 py-2">ⓘ Cooldown is enforced separately per eligible product and checked before an opportunity is created.</p>
          </Section>

          <section className="bg-white border border-[#EAEDFF] rounded-[20px] p-6 flex flex-col gap-4 shadow-sm">
            <h2 className="font-jakarta text-base font-bold text-[#131B2E] flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-[#001BD2] text-white text-xs flex items-center justify-center">5</span>
              Locked Nibbl Rules &amp; Cost Summary
              <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full flex items-center gap-1"><Lock className="w-3 h-3" /> Managed by Nibbl</span>
            </h2>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
              {[
                [DollarSign, "Shopper reward", "$1 locked", "Paid immediately after completed review."],
                [Clock, "Completion window", "30 days locked", "Shopper has 30 days to complete the review."],
                [ShieldCheck, "Purchase source", "Already-verified rebate receipt", "Only verified purchases can create opportunities."],
                [DollarSign, "Plan", `${String(plan.name ?? "Your plan")} — plan fee applies`, `Total cost per completed review: $1 shopper reward + your plan's review fee${reviewFee ? ` ($${reviewFee.toFixed(2)})` : ""}.`],
                [Sparkles, "Publishing", "After Nibbl review", "We typically review and publish campaigns within 1–3 business days."],
                [ShieldCheck, "Disclosure", "Verified Purchase", "A disclosure badge appears on all reviews from this campaign."],
              ].map(([Icon, title, value, note]) => {
                const I = Icon as typeof Clock;
                return (
                  <div key={String(title)} className="border border-[#EAEDFF] rounded-xl p-3 flex flex-col gap-1">
                    <I className="w-4 h-4 text-[#001BD2]" />
                    <span className="text-[#64748B]">{String(title)}</span>
                    <b className="text-[#131B2E]">{String(value)}</b>
                    <span className="text-[#94A3B8]">{String(note)}</span>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <aside className="xl:sticky xl:top-6 flex flex-col gap-3 items-center">
          <h3 className="self-start font-jakarta font-bold text-[#131B2E]">Live Shopper Preview (Mobile)</h3>
          <div className="w-[300px] rounded-[40px] border-[10px] border-[#131B2E] bg-white overflow-hidden shadow-xl">
            <div className="h-6 flex justify-center"><span className="w-24 h-4 bg-[#131B2E] rounded-b-2xl" /></div>
            <div className="px-4 pb-5 flex flex-col gap-3">
              <div className="h-36 rounded-xl bg-slate-100 overflow-hidden flex items-center justify-center">
                {imagePreview ? <img src={imagePreview} alt="" className="w-full h-full object-cover" /> : <span className="text-xs text-[#94A3B8]">Campaign image</span>}
              </div>
              <div className="text-center">
                <p className="font-jakarta text-lg font-extrabold text-[#131B2E]">Share your voice</p>
                <p className="text-xs text-[#454656]">
                  Review this {chosen.length === 1 ? chosen[0].name : `${String(brand?.name ?? "brand")} product`} and earn a $1 reward.
                </p>
              </div>
              <div className="flex justify-around text-xs font-bold text-[#131B2E]">
                <span className="flex items-center gap-1"><DollarSign className="w-4 h-4 text-[#001BD2]" /> $1 reward</span>
                <span className="flex items-center gap-1"><Clock className="w-4 h-4 text-[#001BD2]" /> 30 days left</span>
              </div>
              <div className="text-xs font-bold text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">✓ Purchase verified</div>
              <div className="h-10 rounded-xl bg-[#001BD2] text-white text-sm font-bold flex items-center justify-center">Claim $1</div>
              <p className="text-[10px] text-center text-[#64748B]">Verified Purchase · Rewarded for an honest review.</p>
            </div>
          </div>
        </aside>
      </div>

      {testing && campaignId && (
        <TestReviewChatModal campaignId={campaignId}
          products={((useBrandApiStore.getState().reviewCampaigns.find((c) => String(c.id) === campaignId)?.products ?? []) as ApiRecord[])}
          onClose={() => setTesting(false)} />
      )}
    </div>
  );
}
