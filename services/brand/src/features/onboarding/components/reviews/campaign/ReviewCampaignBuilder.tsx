/* eslint-disable @next/next/no-img-element */
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { ApiRecord } from "@/lib/api/backendApi";
import { useBrandApiStore } from "@/stores/useBrandApiStore";

interface ReviewCampaignBuilderProps {
  campaign: ApiRecord | null;
  onCancel: () => void;
  onSaved: (campaign: ApiRecord) => void;
}

export const COOLDOWN_OPTIONS = [
  { value: "0", label: "No cooldown" },
  { value: "30", label: "30 days" },
  { value: "60", label: "60 days" },
  { value: "90", label: "90 days — Recommended" },
  { value: "one_time", label: "One time per shopper" },
];

const dateValue = (value: unknown) => (typeof value === "string" && value ? value.slice(0, 10) : "");
const toIso = (date: string) => (date ? new Date(`${date}T00:00:00`).toISOString() : null);

const inputClass =
  "w-full h-11 px-3 rounded-xl border border-[#E0E3F5] bg-white text-sm text-[#131B2E] outline-none focus:border-[#001BD2]";
const labelClass = "flex flex-col gap-1.5 text-xs font-bold text-[#454656] uppercase tracking-wider";

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="bg-white border border-[#EAEDFF] rounded-[20px] p-6 flex flex-col gap-4 shadow-sm">
    <h2 className="font-jakarta text-base font-bold text-[#131B2E]">{title}</h2>
    {children}
  </section>
);

/** Master "Create Review Campaign": basics, eligible products, campaign
 *  controls and the locked Nibbl rules. Brand questions are managed on the
 *  campaign page after saving. */
export default function ReviewCampaignBuilder({ campaign, onCancel, onSaved }: ReviewCampaignBuilderProps) {
  const products = useBrandApiStore((s) => s.products);
  const saveReviewCampaign = useBrandApiStore((s) => s.saveReviewCampaign);

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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? products.filter((p) => `${p.name} ${p.category}`.toLowerCase().includes(q)) : products;
  }, [products, search]);

  const save = async () => {
    setError("");
    if (!name.trim()) return setError("Enter the internal campaign name.");
    if (!selected.length) return setError("Select at least one eligible product.");
    if (!(Number(daily) >= 1)) return setError("Set at least one review opportunity per day.");
    if (endDate && startDate && endDate < startDate) return setError("The end date must be after the start date.");
    setBusy(true);
    try {
      const saved = await saveReviewCampaign(campaign ? String(campaign.id) : null, {
        name: name.trim(),
        product_ids: selected,
        start_at: startDate === dateValue(campaign?.start_at) ? ((campaign?.start_at as string) ?? null) : toIso(startDate),
        end_at: endDate === dateValue(campaign?.end_at) ? ((campaign?.end_at as string) ?? null) : toIso(endDate),
        daily_opportunities: Number(daily),
        product_cooldown_days: cooldown === "one_time" ? 0 : Number(cooldown),
        one_time_only: cooldown === "one_time",
      });
      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the campaign.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full max-w-[880px] mx-auto flex flex-col gap-6 font-manrope text-left animate-slide-up">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-jakarta text-2xl font-extrabold text-[#131B2E]">
            {campaign ? "Edit review campaign" : "Create review campaign"}
          </h1>
          <p className="text-sm text-[#64748B] mt-1">
            Shoppers whose verified rebate receipt includes an eligible product are invited to review it for $1.
          </p>
        </div>
        <button onClick={onCancel} className="text-sm font-bold text-[#454656] hover:text-[#001BD2] cursor-pointer">Cancel</button>
      </div>

      <Section title="Campaign basics">
        <label className={labelClass}>
          Internal campaign name
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
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
      </Section>

      <Section title="Eligible products">
        <div className="relative">
          <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-3.5" />
          <input className={`${inputClass} pl-9`} placeholder="Search your product library" value={search}
            onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="max-h-64 overflow-y-auto flex flex-col divide-y divide-[#F1F2FA] border border-[#F1F2FA] rounded-xl">
          {filtered.map((p) => (
            <label key={p.id} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-[#FAF8FF]">
              <input type="checkbox" checked={selected.includes(p.id)}
                onChange={() => setSelected((cur) => (cur.includes(p.id) ? cur.filter((x) => x !== p.id) : [...cur, p.id]))} />
              <img src={p.imageSrc} alt="" className="w-9 h-9 rounded-lg object-cover bg-[#F2F3FF]" />
              <span className="text-sm font-semibold text-[#131B2E] flex-1">{p.name}</span>
              <span className="text-xs text-[#94A3B8]">{p.category}</span>
            </label>
          ))}
        </div>
        <p className="text-xs text-[#64748B]">Each eligible product found on a verified receipt may create one review opportunity.</p>
      </Section>

      <Section title="Campaign controls">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className={labelClass}>
            Review opportunities per day
            <input type="number" min="1" step="1" className={inputClass} value={daily} onChange={(e) => setDaily(e.target.value)} />
          </label>
          <label className={labelClass}>
            Product cooldown (per shopper)
            <select className={inputClass} value={cooldown} onChange={(e) => setCooldown(e.target.value)}>
              {COOLDOWN_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
        </div>
      </Section>

      <Section title="Locked Nibbl rules">
        <ul className="list-disc pl-5 text-sm text-[#454656] flex flex-col gap-1">
          <li>Shopper reward is always $1, paid as soon as the review is completed.</li>
          <li>Shoppers have 30 days to complete a review.</li>
          <li>Only an already-verified rebate receipt can create a review opportunity (max 5 per receipt).</li>
          <li>Your cost per review is the $1 reward plus your plan&apos;s review fee.</li>
          <li>4–5★ reviews publish immediately; 1–3★ reviews are held 7 days so you can respond or flag them.</li>
          <li>Published reviews include the verified-purchase and rewarded-review disclosure.</li>
        </ul>
      </Section>

      {error && <div className="bg-red-50 border border-red-100 text-red-700 text-sm font-semibold rounded-xl px-4 py-3">{error}</div>}
      <div>
        <button onClick={save} disabled={busy}
          className="h-12 px-6 rounded-full bg-[#001BD2] hover:bg-blue-700 text-white font-bold text-sm disabled:opacity-50 cursor-pointer">
          {busy ? "Saving…" : campaign ? "Save changes" : "Save and add questions"}
        </button>
      </div>
    </div>
  );
}
