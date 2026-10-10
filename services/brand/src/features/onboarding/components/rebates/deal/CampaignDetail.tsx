/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";
import { ArrowLeft, Copy, ExternalLink } from "lucide-react";
import { ApiRecord } from "@/lib/api/backendApi";
import { useBrandApiStore } from "@/stores/useBrandApiStore";
import NibblReviewComment from "../NibblReviewComment";
import OfferPreview from "./OfferPreview";
import MetaPixelToggle from "./MetaPixelToggle";
import { geographyText } from "./GeographyPicker";
import { DealType, cooldownText, dealLabel, money, receiptWording } from "./dealRules";

interface CampaignDetailProps {
  campaignId: string;
  onBack: () => void;
  onEdit: (campaign: ApiRecord) => void;
}

const dateText = (value: unknown) =>
  typeof value === "string" && value ? new Date(value).toLocaleDateString() : "—";
const dateTimeText = (value: unknown) =>
  typeof value === "string" && value ? new Date(value).toLocaleString() : "—";

// Master ①: status banner wording.
const BANNERS: Record<string, { title: string; text: string; tone: string }> = {
  draft: { title: "Draft", text: "Not visible to shoppers. Submit it for Nibbl review when it's ready.", tone: "slate" },
  pending_review: {
    title: "Pending Review",
    text: "Your campaign is not live and cannot be claimed until approved and its start date arrives.",
    tone: "amber",
  },
  changes_requested: {
    title: "Changes Requested",
    text: "Nibbl asked for changes. Edit the campaign, then resubmit it for review.",
    tone: "amber",
  },
  rejected: { title: "Rejected", text: "Nibbl rejected this campaign. It can't be resubmitted.", tone: "red" },
  approved: {
    title: "Approved",
    text: "Approved by Nibbl but not live yet — fund your wallet, then activate it.",
    tone: "blue",
  },
  scheduled: { title: "Scheduled", text: "Approved. It goes live on its start date.", tone: "blue" },
  active: { title: "Active", text: "Live — shoppers can claim this offer.", tone: "green" },
  paused: { title: "Paused", text: "Not claimable while paused. Resume it to go live again.", tone: "slate" },
  ended: { title: "Ended", text: "This campaign has ended and can no longer be claimed.", tone: "slate" },
};

const TONES: Record<string, string> = {
  slate: "bg-slate-50 border-slate-200 text-slate-700",
  amber: "bg-amber-50 border-amber-200 text-amber-800",
  red: "bg-red-50 border-red-200 text-red-700",
  blue: "bg-[#F2F3FF] border-[#D9DEFF] text-[#001BD2]",
  green: "bg-emerald-50 border-emerald-200 text-emerald-700",
};

const REVIEW_TEXT: Record<string, string> = {
  pending: "Submitted for review",
  changes_requested: "Changes requested",
  approved: "Approved",
  rejected: "Rejected",
};

const qrImageUrl = (value: string, size = 260) =>
  `https://api.qrserver.com/v1/create-qr-code/?${new URLSearchParams({
    size: `${size}x${size}`,
    margin: "12",
    data: value,
  }).toString()}`;

const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="bg-white border border-[#EAEDFF] rounded-[20px] p-6 flex flex-col gap-4 shadow-sm">
    <h2 className="font-jakarta text-base font-bold text-[#131B2E]">{title}</h2>
    {children}
  </section>
);

const Term = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex flex-col gap-0.5">
    <span className="text-[10px] font-bold text-[#454656]/60 uppercase tracking-wider">{label}</span>
    <span className="text-sm font-semibold text-[#131B2E] break-words">{value}</span>
  </div>
);

export default function CampaignDetail({ campaignId, onBack, onEdit }: CampaignDetailProps) {
  const campaign = useBrandApiStore((s) => s.campaigns.find((c) => String(c.id) === campaignId));
  const metrics = useBrandApiStore((s) =>
    s.analyticsCampaigns.find((m) => String(m.campaign_id ?? m.id) === campaignId)
  );
  const products = useBrandApiStore((s) => s.products);
  const loadCampaignExtras = useBrandApiStore((s) => s.loadCampaignExtras);
  const campaignAction = useBrandApiStore((s) => s.campaignAction);
  const [reviews, setReviews] = useState<ApiRecord[]>([]);
  const [access, setAccess] = useState<ApiRecord>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadCampaignExtras(campaignId).then((extras) => {
      if (cancelled) return;
      setReviews(extras.reviews);
      setAccess(extras.access);
    });
    return () => {
      cancelled = true;
    };
  }, [campaignId, loadCampaignExtras, campaign?.review_status]);

  if (!campaign) {
    return (
      <div className="w-full max-w-[1240px] mx-auto text-sm text-[#64748B]">
        <button onClick={onBack} className="font-bold text-[#001BD2] cursor-pointer">← Back to campaigns</button>
        <p className="mt-6">Campaign not found.</p>
      </div>
    );
  }

  const display = String(campaign.display_status ?? "draft");
  const banner = BANNERS[display] ?? BANNERS.draft;
  const reviewStatus = String(campaign.review_status ?? "");
  const isApproved = reviewStatus === "approved";
  const isLive = display === "active" || display === "scheduled";
  const link = String(access.campaign_url ?? "");
  const productIds = Array.isArray(campaign.products) ? campaign.products.map(String) : [];
  const campaignProducts = products.filter((p) => productIds.includes(p.id));
  const pendingRevision = campaign.pending_revision as ApiRecord | null;
  const capacity = Number(campaign.claim_capacity ?? 0);
  const cycleClaims = isApproved ? Number(campaign.current_cycle_claims ?? 0) : 0;
  const dealType = String(campaign.deal_type ?? "free") as DealType;
  const names = (value: unknown) =>
    Array.isArray(value) ? value.map((r) => String((r as { name?: unknown }).name ?? "")).filter(Boolean) : [];
  const retailerNames = names(campaign.retailers);
  const featuredNames = names(campaign.featured_retailers);
  // Performance starts when the campaign becomes active (zeros while pending).
  const metric = (key: string) => (isApproved ? Number(metrics?.[key] ?? 0) : 0);
  const rate = isApproved && metrics?.redemption_rate != null ? `${String(metrics.redemption_rate)}%` : "—";

  const canEdit = !["pending_review", "rejected", "ended"].includes(display);
  const canSubmit = reviewStatus === "not_submitted" || reviewStatus === "changes_requested";
  const canActivate = isApproved && (display === "approved" || display === "paused");
  const canPause = display === "active" || display === "scheduled";

  const act = async (action: "submit" | "activate" | "pause") => {
    setBusy(true);
    setError("");
    try {
      await campaignAction(campaignId, action);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="w-full max-w-[1240px] mx-auto flex flex-col gap-6 font-manrope text-left animate-slide-up">
      <button onClick={onBack} className="self-start flex items-center gap-1 text-sm font-bold text-[#454656] hover:text-[#001BD2] cursor-pointer">
        <ArrowLeft className="w-4 h-4" /> Rebate campaigns
      </button>

      {/* ① Submission status */}
      <div className={`border rounded-[20px] px-6 py-5 ${TONES[banner.tone]}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider">{banner.title}</p>
            <h1 className="font-jakarta text-xl font-extrabold text-[#131B2E] mt-1">{String(campaign.name)}</h1>
            <p className="text-sm mt-1">{banner.text}</p>
            {pendingRevision && (
              <p className="text-sm mt-2 font-semibold">
                Changes Pending Review — submitted {dateTimeText(pendingRevision.submitted_at)}. The approved version stays live
                until Nibbl approves them.
              </p>
            )}
          </div>
          {/* ⑦ Actions */}
          <div className="flex flex-wrap gap-2">
            {canEdit && (
              <button onClick={() => onEdit(campaign)} className="h-10 px-5 rounded-full border border-[#001BD2] text-[#001BD2] bg-white text-sm font-bold cursor-pointer">
                Edit campaign
              </button>
            )}
            {canSubmit && (
              <button disabled={busy} onClick={() => act("submit")} className="h-10 px-5 rounded-full bg-[#001BD2] text-white text-sm font-bold disabled:opacity-50 cursor-pointer">
                {reviewStatus === "changes_requested" ? "Resubmit for review" : "Submit for review"}
              </button>
            )}
            {canActivate && (
              <button disabled={busy} onClick={() => act("activate")} className="h-10 px-5 rounded-full bg-[#001BD2] text-white text-sm font-bold disabled:opacity-50 cursor-pointer">
                {display === "paused" ? "Resume" : "Activate"}
              </button>
            )}
            {canPause && (
              <button disabled={busy} onClick={() => act("pause")} className="h-10 px-5 rounded-full border border-slate-300 bg-white text-slate-700 text-sm font-bold disabled:opacity-50 cursor-pointer">
                Pause
              </button>
            )}
          </div>
        </div>
      </div>
      {error && <div className="bg-red-50 border border-red-100 text-red-700 text-sm font-semibold rounded-xl px-4 py-3">{error}</div>}
      <NibblReviewComment
        comment={String(campaign.review_comment ?? "")}
        label={reviewStatus === "rejected" ? "Nibbl rejected this campaign" : "Nibbl's comment"}
      />

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start">
        <div className="flex flex-col gap-6">
          {/* ④ Performance + ⑤ Current cycle */}
          <Card title="Performance">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
              <Term label="Claims" value={metric("reservations")} />
              <Term label="Active claims" value={metric("active_reservations")} />
              <Term label="Pending review" value={metric("pending_review")} />
              <Term label="Redemptions" value={metric("redemptions")} />
              <Term label="Redemption rate" value={rate} />
              <Term label="Reward spend" value={`$${metric("reward_spend").toFixed(2)}`} />
            </div>
            <div className="bg-[#F2F3FF] rounded-xl p-4">
              <div className="flex justify-between text-sm font-bold text-[#131B2E]">
                <span>Current cycle claims</span>
                <span>
                  {cycleClaims} of {capacity || "—"}
                </span>
              </div>
              <div className="w-full h-1.5 bg-white rounded-full overflow-hidden mt-2">
                <div
                  className="h-full bg-[#001BD2] rounded-full"
                  style={{ width: `${capacity ? Math.min((cycleClaims / capacity) * 100, 100) : 0}%` }}
                />
              </div>
              <p className="text-xs text-[#64748B] mt-2">
                {isLive
                  ? `Cycle started ${dateTimeText(campaign.current_cycle_started_at)}. Resets every 25 hours from activation.`
                  : "Counting begins when the campaign becomes active."}
              </p>
            </div>
          </Card>

          <MetaPixelToggle campaign={campaign} />

          {/* ② Summary */}
          <Card title="Campaign summary">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
              <Term label="Offer type" value={dealLabel(campaign.deal_type)} />
              <Term
                label={dealType === "buy_x_get_y" ? "Fixed reward" : "Maximum rebate"}
                value={dealType === "buy_x_get_y" ? money(String(campaign.fixed_reward ?? "")) : money(String(campaign.max_rebate ?? ""))}
              />
              {dealType === "buy_x_get_y" && <Term label="Required quantity" value={String(campaign.required_quantity ?? 1)} />}
              <Term label="Dates" value={`${dateText(campaign.start_at)} → ${campaign.end_at ? dateText(campaign.end_at) : "No end date"}`} />
              <Term label="Eligible products" value={campaignProducts.map((p) => p.name).join(", ") || "—"} />
              <Term label="Cooldown" value={cooldownText(campaign.cooldown_days, campaign.one_time_only)} />
              <Term label="Discovery geography" value={geographyText(campaign.geography, campaign.geography_states, campaign.geography_areas)} />
              <Term label="25-hour goal" value={`${String(campaign.desired_redemptions ?? "—")} redemptions @ ${String(campaign.estimated_redemption_rate ?? "—")}%`} />
              <Term label="Claim capacity" value={`${capacity || "—"} per 25 hours`} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Term label="Where to buy" value={retailerNames.join(", ") || "—"} />
              <Term label="Featured retailers" value={featuredNames.join(", ") || "—"} />
            </div>
            <Term label="Receipt eligibility" value={receiptWording(String(campaign.allowed_merchants ?? ""))} />
          </Card>

          {/* ③ Assets */}
          <Card title="Campaign assets">
            {!isApproved && (
              <p className="text-sm font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                Not live — assets are ready for preparation, but don&apos;t distribute them until the campaign is approved.
              </p>
            )}
            {link ? (
              <div className="flex flex-col sm:flex-row gap-5 items-start">
                <img src={qrImageUrl(link)} alt="Campaign QR code" className="w-40 h-40 rounded-xl border border-[#EAEDFF]" />
                <div className="flex flex-col gap-3 min-w-0 flex-1">
                  <div className="bg-[#F2F3FF] rounded-xl px-4 py-3 text-sm font-semibold text-[#131B2E] truncate">{link}</div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={copy} className="h-9 px-4 rounded-full bg-[#001BD2] text-white text-xs font-bold flex items-center gap-1 cursor-pointer">
                      <Copy className="w-3.5 h-3.5" /> {copied ? "Copied!" : "Copy URL"}
                    </button>
                    <a href={link} target="_blank" rel="noreferrer" className="h-9 px-4 rounded-full border border-[#001BD2] text-[#001BD2] text-xs font-bold flex items-center gap-1">
                      <ExternalLink className="w-3.5 h-3.5" /> Open
                    </a>
                    <a href={qrImageUrl(link, 600)} target="_blank" rel="noreferrer" download className="h-9 px-4 rounded-full border border-[#001BD2] text-[#001BD2] text-xs font-bold flex items-center">
                      Download QR PNG
                    </a>
                    <a href={qrImageUrl(link, 1200)} target="_blank" rel="noreferrer" download className="h-9 px-4 rounded-full border border-[#001BD2] text-[#001BD2] text-xs font-bold flex items-center">
                      High-resolution QR
                    </a>
                  </div>
                  <p className="text-xs text-[#64748B]">The URL and QR code never change, even after edits or re-review.</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-[#64748B]">The campaign URL and QR code are created when you submit for review.</p>
            )}
          </Card>

          {/* ⑥ Review activity */}
          <Card title="Review activity">
            {reviews.length === 0 ? (
              <p className="text-sm text-[#64748B]">Not submitted yet.</p>
            ) : (
              <ol className="flex flex-col gap-3">
                {reviews.map((review) => (
                  <li key={String(review.id)} className="border border-[#EAEDFF] rounded-xl px-4 py-3">
                    <div className="flex flex-wrap justify-between gap-2 text-sm">
                      <span className="font-bold text-[#131B2E]">
                        {review.kind === "revision" ? "Revision" : "Campaign"} — {REVIEW_TEXT[String(review.status)] ?? String(review.status)}
                      </span>
                      <span className="text-xs text-[#64748B]">
                        Submitted {dateTimeText(review.submitted_at)}
                        {review.reviewed_at ? ` · Decided ${dateTimeText(review.reviewed_at)}` : ""}
                      </span>
                    </div>
                    {review.comment ? <p className="text-sm text-[#454656] mt-1.5">Nibbl: {String(review.comment)}</p> : null}
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>

        <div className="xl:sticky xl:top-6">
          <OfferPreview
            imageUrl={String(campaign.image_url ?? "")}
            headline={String(campaign.offer_headline ?? "")}
            description={String(campaign.offer_description ?? "")}
            products={campaignProducts.map((p) => ({ id: p.id, name: p.name, imageSrc: p.imageSrc }))}
            dealType={dealType}
            maxRebate={String(campaign.max_rebate ?? "")}
            fixedReward={String(campaign.fixed_reward ?? "")}
            allowedMerchants={String(campaign.allowed_merchants ?? "")}
            featuredRetailers={featuredNames}
            whereToBuy={retailerNames}
            cooldownDays={Number(campaign.cooldown_days ?? 0)}
            oneTimeOnly={Boolean(campaign.one_time_only)}
          />
        </div>
      </div>
    </div>
  );
}
