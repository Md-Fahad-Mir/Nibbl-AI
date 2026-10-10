import { useState } from "react";
import { Trash2 } from "lucide-react";
import { ApiRecord } from "@/lib/api/backendApi";
import { useBrandApiStore } from "@/stores/useBrandApiStore";
import { COOLDOWN_OPTIONS } from "./ReviewCampaignBuilder";

interface ReviewCampaignDetailProps {
  campaignId: string;
  onBack: () => void;
  onEdit: (campaign: ApiRecord) => void;
  onReviewManagement: () => void;
}

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft", active: "Active", paused: "Paused", scheduled: "Scheduled", ended: "Ended", archived: "Archived",
};

const formatDate = (value: unknown) =>
  typeof value === "string" && value
    ? new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "—";

const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="bg-white border border-[#EAEDFF] rounded-[20px] p-6 flex flex-col gap-4 shadow-sm">
    <h2 className="font-jakarta text-base font-bold text-[#131B2E]">{title}</h2>
    {children}
  </section>
);

/** Review campaign page: status and controls, settings, and the brand
 *  question pool (one is rotated into each review conversation). */
export default function ReviewCampaignDetail({ campaignId, onBack, onEdit, onReviewManagement }: ReviewCampaignDetailProps) {
  const campaign = useBrandApiStore((s) => s.reviewCampaigns.find((c) => String(c.id) === campaignId));
  const reviewCampaignAction = useBrandApiStore((s) => s.reviewCampaignAction);
  const addReviewPrompt = useBrandApiStore((s) => s.addReviewPrompt);
  const deleteReviewPrompt = useBrandApiStore((s) => s.deleteReviewPrompt);
  const suggestReviewPrompts = useBrandApiStore((s) => s.suggestReviewPrompts);

  const [question, setQuestion] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const run = async (key: string, task: () => Promise<unknown>) => {
    setError("");
    setBusy(key);
    try {
      await task();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy("");
    }
  };

  if (!campaign) {
    return (
      <div className="flex flex-col gap-4 font-manrope">
        <p className="text-sm text-[#64748B]">This campaign is no longer available.</p>
        <button onClick={onBack} className="self-start text-sm font-bold text-[#001BD2] cursor-pointer">Back to reviews</button>
      </div>
    );
  }

  const status = String(campaign.display_status ?? campaign.status);
  const prompts = Array.isArray(campaign.prompts) ? (campaign.prompts as ApiRecord[]) : [];
  const products = Array.isArray(campaign.products) ? (campaign.products as ApiRecord[]) : [];
  const cooldown = campaign.one_time_only ? "one_time" : String(campaign.product_cooldown_days);
  const canActivate = ["draft", "paused"].includes(String(campaign.status));
  const canPause = String(campaign.status) === "active";

  const addQuestion = (text: string) =>
    run("add", async () => {
      await addReviewPrompt(campaignId, text.trim());
      setQuestion("");
      setSuggestions((cur) => cur.filter((s) => s !== text));
    });

  return (
    <div className="w-full max-w-[880px] mx-auto flex flex-col gap-6 font-manrope text-left animate-slide-up">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <button onClick={onBack} className="text-xs font-bold text-[#64748B] hover:text-[#001BD2] cursor-pointer">← Reviews</button>
          <div className="flex items-center gap-3 mt-2">
            <h1 className="font-jakarta text-2xl font-extrabold text-[#131B2E]">{String(campaign.name)}</h1>
            <span className="bg-[#E2E7FF] text-[#001BD2] text-[10px] font-bold px-3 py-0.5 rounded-full uppercase tracking-wider">
              {STATUS_LABEL[status] ?? status}
            </span>
            {Boolean(campaign.auto_paused) && (
              <span className="bg-amber-50 text-amber-700 text-[10px] font-bold px-3 py-0.5 rounded-full uppercase">Paused — low funds</span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={onReviewManagement} className="h-10 px-4 rounded-full bg-[#E2E7FF] text-[#001BD2] font-bold text-sm cursor-pointer">
            Review Management
          </button>
          <button onClick={() => onEdit(campaign)} className="h-10 px-4 rounded-full border border-[#E0E3F5] text-[#131B2E] font-bold text-sm cursor-pointer">
            Edit
          </button>
          {canActivate && (
            <button disabled={!!busy} onClick={() => run("activate", () => reviewCampaignAction(campaignId, "activate"))}
              className="h-10 px-4 rounded-full bg-[#001BD2] text-white font-bold text-sm disabled:opacity-50 cursor-pointer">
              {busy === "activate" ? "Activating…" : "Activate"}
            </button>
          )}
          {canPause && (
            <button disabled={!!busy} onClick={() => run("pause", () => reviewCampaignAction(campaignId, "pause"))}
              className="h-10 px-4 rounded-full border border-[#E0E3F5] text-[#131B2E] font-bold text-sm disabled:opacity-50 cursor-pointer">
              Pause
            </button>
          )}
          <button disabled={!!busy}
            onClick={() => window.confirm("Archive this review campaign? It stops creating new review opportunities.") &&
              run("archive", async () => { await reviewCampaignAction(campaignId, "archive"); onBack(); })}
            className="h-10 px-4 rounded-full text-red-600 font-bold text-sm disabled:opacity-50 cursor-pointer">
            Archive
          </button>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-100 text-red-700 text-sm font-semibold rounded-xl px-4 py-3">{error}</div>}

      <Card title="Campaign settings">
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
          {[
            ["Start", formatDate(campaign.start_at)],
            ["End", campaign.end_at ? formatDate(campaign.end_at) : "No end date"],
            ["Opportunities per day", String(campaign.daily_opportunities)],
            ["Created today", String(campaign.opportunities_today ?? 0)],
            ["Product cooldown", COOLDOWN_OPTIONS.find((o) => o.value === cooldown)?.label ?? `${cooldown} days`],
            ["Shopper reward", `$${campaign.reward_amount ?? "1.00"}`],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider">{label}</dt>
              <dd className="font-semibold text-[#131B2E] mt-1">{value}</dd>
            </div>
          ))}
        </dl>
        <div>
          <div className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider">Eligible products</div>
          <div className="flex flex-wrap gap-2 mt-2">
            {products.map((p) => (
              <span key={String(p.id)} className="bg-[#F2F3FF] text-[#131B2E] text-xs font-semibold px-3 py-1 rounded-full">{String(p.name)}</span>
            ))}
          </div>
        </div>
      </Card>

      <Card title="Brand questions">
        <p className="text-sm text-[#64748B]">
          One question from this pool is rotated into each review conversation, alongside the AI&apos;s product questions.
        </p>
        <ul className="flex flex-col divide-y divide-[#F1F2FA] border border-[#F1F2FA] rounded-xl">
          {prompts.length === 0 && <li className="px-4 py-3 text-sm text-[#94A3B8]">No brand questions yet.</li>}
          {prompts.map((p) => (
            <li key={String(p.id)} className="flex items-center gap-3 px-4 py-3">
              <span className="text-sm text-[#131B2E] flex-1">{String(p.text)}</span>
              <span className="text-xs text-[#94A3B8]">Used {String(p.times_used ?? 0)}×</span>
              <button aria-label="Delete question" disabled={!!busy}
                onClick={() => run(`del-${p.id}`, () => deleteReviewPrompt(campaignId, String(p.id)))}
                className="text-[#94A3B8] hover:text-red-600 cursor-pointer disabled:opacity-50">
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <input value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={300}
            placeholder="e.g. Which flavor should we make next?"
            className="flex-1 h-11 px-3 rounded-xl border border-[#E0E3F5] text-sm outline-none focus:border-[#001BD2]" />
          <button disabled={!question.trim() || !!busy} onClick={() => addQuestion(question)}
            className="h-11 px-5 rounded-full bg-[#001BD2] text-white font-bold text-sm disabled:opacity-50 cursor-pointer">
            Add
          </button>
        </div>
        <div className="flex flex-col gap-2">
          <button disabled={!!busy}
            onClick={() => run("suggest", async () => setSuggestions(await suggestReviewPrompts(campaignId, 4)))}
            className="self-start text-sm font-bold text-[#001BD2] disabled:opacity-50 cursor-pointer">
            {busy === "suggest" ? "Suggesting…" : "✨ Suggest questions"}
          </button>
          {suggestions.map((s) => (
            <div key={s} className="flex items-center gap-3 bg-[#FAF8FF] rounded-xl px-4 py-2.5">
              <span className="text-sm text-[#131B2E] flex-1">{s}</span>
              <button disabled={!!busy} onClick={() => addQuestion(s)} className="text-xs font-bold text-[#001BD2] cursor-pointer">Add</button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
