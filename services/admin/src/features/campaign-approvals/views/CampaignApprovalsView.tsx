"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/features/dashboard/components/Sidebar";
import { Header } from "@/features/dashboard/components/Header";
import { SidebarNavItem } from "@/types/dashboard.types";
import { useAdminApiStore } from "@/stores/useAdminApiStore";
import { ApiRecord, nibblApi } from "@/lib/api/backendApi";

type Kind = "new" | "revision";
type Action = "approve" | "request-changes" | "reject";

const money = (value: unknown) =>
  value === null || value === undefined || value === "" ? "—" : `$${Number(value).toFixed(2)}`;
const dateTime = (value: unknown) =>
  typeof value === "string" && value ? new Date(value).toLocaleString() : "—";

const DEAL_LABELS: Record<string, string> = {
  free: "Free",
  bogo_free: "BOGO Free",
  bogo_half: "Buy 1, Get 1 50% Off",
  buy_x_get_y: "Buy X, Get $Y Off",
};

const FIELD_LABELS: Record<string, string> = {
  name: "Campaign name",
  description: "Description",
  deal_type: "Offer type",
  max_rebate: "Maximum rebate",
  fixed_reward: "Fixed reward",
  required_quantity: "Required quantity",
  offer_headline: "Headline",
  offer_description: "Offer description",
  desired_redemptions: "Desired redemptions / 25h",
  estimated_redemption_rate: "Estimated redemption rate (%)",
  cooldown_days: "Cooldown (days)",
  one_time_only: "One time per customer",
  product: "Eligible products",
  allowed_merchants: "Allowed retailers",
  start_at: "Start",
  end_at: "End",
  daily_budget: "Daily budget",
  image: "Campaign image",
  retailers: "Where to buy (retailers)",
  featured_retailers: "Featured retailers",
  retailer_required: "Retailer required for receipts",
  geography: "Discovery geography",
  geography_states: "States",
  geography_areas: "ZIP areas",
};

const display = (key: string, value: unknown): string => {
  if (value === null || value === undefined || value === "") return "—";
  if (key === "deal_type") return DEAL_LABELS[String(value)] ?? String(value);
  if (key === "image") return "New image uploaded";
  if (["max_rebate", "fixed_reward", "daily_budget"].includes(key)) return money(value);
  if (key === "start_at" || key === "end_at") return dateTime(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) {
    // Current values arrive as [{id, name}], proposed ones as id lists.
    const named = value.map((v) => (v && typeof v === "object" ? String((v as ApiRecord).name ?? "") : "")).filter(Boolean);
    if (named.length) return named.join(", ");
    return `${value.length} ${key === "product" ? "product(s)" : "selected"}`;
  }
  return String(value);
};

const cooldownText = (campaign: ApiRecord) =>
  campaign.one_time_only
    ? "One time per customer"
    : Number(campaign.cooldown_days) === 0
      ? "None"
      : `${String(campaign.cooldown_days)} days`;

const Term = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex flex-col gap-0.5">
    <span className="text-xs font-semibold uppercase tracking-wider text-[#9A9AB0]">{label}</span>
    <span className="text-sm text-[#1A1A2E] break-words">{value}</span>
  </div>
);

const ReviewCard = ({
  review,
  onDecided,
}: {
  review: ApiRecord;
  onDecided: (message: string) => void;
}) => {
  const campaign = (review.campaign ?? {}) as ApiRecord;
  const changes = (review.changes ?? {}) as ApiRecord;
  const products = (review.product_names ?? []) as string[];
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState<Action | null>(null);
  const [error, setError] = useState("");

  const decide = async (action: Action) => {
    setError("");
    if (action !== "approve" && !comment.trim()) {
      setError("Add a comment for the brand first.");
      return;
    }
    setBusy(action);
    try {
      const result = await nibblApi.decideCampaignApproval(String(review.id), action, comment.trim());
      const verb =
        action === "approve" ? "approved" : action === "reject" ? "rejected" : "sent back for changes";
      onDecided(`${String(campaign.name)} ${verb}. ${String(result.detail ?? "")}`.trim());
    } catch (err) {
      setError((err as Error).message || "Could not save the decision.");
    } finally {
      setBusy(null);
    }
  };

  const maxReward = campaign.deal_type === "buy_x_get_y" ? campaign.fixed_reward : campaign.max_rebate;

  return (
    <div className="bg-white border border-[#ECECF5] rounded-2xl p-6 shadow-sm flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-[#3E3EDF] uppercase tracking-wider">
            {String(review.brand_name ?? "")}
          </p>
          <h2 className="text-lg font-bold text-[#1A1A2E]">{String(campaign.name ?? "")}</h2>
          <p className="text-sm text-[#6B6B80]">{String(campaign.offer_headline ?? "")}</p>
        </div>
        <div className="text-right text-xs text-[#6B6B80]">
          <p>Submitted {dateTime(review.submitted_at)}</p>
          {review.submitted_by_email ? <p>by {String(review.submitted_by_email)}</p> : null}
          {review.kind === "revision" && (
            <p className="mt-1 inline-block bg-emerald-50 text-emerald-700 font-semibold px-2 py-0.5 rounded-full">
              Live — current version stays live
            </p>
          )}
        </div>
      </div>

      {review.kind === "revision" && (
        <div className="border border-amber-100 bg-amber-50/60 rounded-xl p-4">
          <h3 className="text-sm font-bold text-[#1A1A2E] mb-2">Proposed changes</h3>
          <table className="w-full text-sm">
            <thead className="text-xs text-[#6B6B80] text-left">
              <tr>
                <th className="py-1 pr-4 font-semibold">Field</th>
                <th className="py-1 pr-4 font-semibold">Current</th>
                <th className="py-1 font-semibold">Proposed</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(changes).map(([key, value]) => (
                <tr key={key} className="border-t border-amber-100">
                  <td className="py-1.5 pr-4 font-medium text-[#454656]">{FIELD_LABELS[key] ?? key}</td>
                  <td className="py-1.5 pr-4 text-[#6B6B80]">
                    {key === "image"
                      ? campaign.image_url
                        ? "Current image"
                        : "—"
                      : display(key, key === "product" ? campaign.products : campaign[key])}
                  </td>
                  <td className="py-1.5 font-semibold text-[#1A1A2E]">
                    {key === "image" && review.proposed_image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={String(review.proposed_image_url)}
                        alt="Proposed campaign image"
                        className="w-24 h-24 object-cover rounded-lg border border-amber-100"
                      />
                    ) : (
                      display(key, value)
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Term label="Offer type" value={display("deal_type", campaign.deal_type)} />
        <Term
          label={campaign.deal_type === "buy_x_get_y" ? "Fixed reward" : "Max rebate"}
          value={money(maxReward)}
        />
        {campaign.deal_type === "buy_x_get_y" && (
          <Term label="Required quantity" value={String(campaign.required_quantity ?? "—")} />
        )}
        <Term label="Products" value={products.length ? products.join(", ") : "—"} />
        <Term
          label="Where to buy"
          value={
            Array.isArray(campaign.retailers) && campaign.retailers.length
              ? (campaign.retailers as ApiRecord[]).map((r) => String(r.name)).join(", ")
              : "—"
          }
        />
        <Term label="Receipts accepted from" value={String(campaign.allowed_merchants || "Any retailer")} />
        <Term
          label="Geography"
          value={
            campaign.geography === "states"
              ? `States: ${((campaign.geography_states as string[]) || []).join(", ")}`
              : campaign.geography === "zip_radius"
                ? ((campaign.geography_areas as ApiRecord[]) || [])
                    .map((a) => `${String(a.radius_miles)} mi of ${String(a.zip)}`)
                    .join("; ")
                : "Nationwide"
          }
        />
        <Term label="Cooldown" value={cooldownText(campaign)} />
        <Term
          label="25-hour goal"
          value={`${String(campaign.desired_redemptions ?? "—")} redemptions @ ${String(
            campaign.estimated_redemption_rate ?? "—",
          )}%`}
        />
        <Term label="Claim capacity" value={`${String(campaign.claim_capacity ?? "—")} / 25h`} />
        <Term label="Wallet available" value={money(review.wallet_available)} />
        <Term label="Dates" value={`${dateTime(campaign.start_at)} → ${dateTime(campaign.end_at)}`} />
      </div>
      {campaign.offer_description ? (
        <p className="text-sm text-[#454656] bg-[#F6F6FB] rounded-lg p-3">
          {String(campaign.offer_description)}
        </p>
      ) : null}

      {error && (
        <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-lg px-3 py-2">
          {error}
        </div>
      )}
      <textarea
        className="w-full min-h-20 px-3 py-2 rounded-lg border border-[#E0E0F0] text-sm text-[#1A1A2E] outline-none focus:border-[#3E3EDF] focus:ring-2 focus:ring-[#3E3EDF]/15"
        placeholder="Comment for the brand (required to request changes or reject)"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => decide("approve")}
          disabled={busy !== null}
          className="h-10 px-5 bg-[#3E3EDF] hover:bg-[#3333c4] text-white font-semibold text-sm rounded-full disabled:opacity-50 cursor-pointer"
        >
          {busy === "approve" ? "Approving…" : "Approve"}
        </button>
        <button
          onClick={() => decide("request-changes")}
          disabled={busy !== null}
          className="h-10 px-5 border border-[#3E3EDF] text-[#3E3EDF] font-semibold text-sm rounded-full disabled:opacity-50 cursor-pointer"
        >
          {busy === "request-changes" ? "Sending…" : "Request changes"}
        </button>
        <button
          onClick={() => decide("reject")}
          disabled={busy !== null}
          className="h-10 px-5 border border-red-200 text-red-600 font-semibold text-sm rounded-full disabled:opacity-50 cursor-pointer"
        >
          {busy === "reject" ? "Rejecting…" : "Reject"}
        </button>
      </div>
    </div>
  );
};

export const CampaignApprovalsView = () => {
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { profile, loadProfile, logout } = useAdminApiStore();
  const [kind, setKind] = useState<Kind>("new");
  const {
    campaignApprovals: reviews,
    campaignApprovalsLoaded: loaded,
    loadCampaignApprovals,
  } = useAdminApiStore();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(
    () =>
      loadCampaignApprovals().catch((err: Error) =>
        setError(err.message || "Could not load the approval queue."),
      ),
    [loadCampaignApprovals],
  );

  useEffect(() => {
    void loadProfile();
    void load();
  }, [loadProfile, load]);

  const counts: Record<Kind, number> = {
    new: reviews.filter((r) => r.kind === "new").length,
    revision: reviews.filter((r) => r.kind === "revision").length,
  };

  const handleNavSelect = (item: SidebarNavItem) => {
    if (item === "logout") {
      logout();
      router.push("/");
      return;
    }
    router.push(`/${item}`);
  };

  const visible = reviews.filter((r) => r.kind === kind);

  return (
    <div className="flex min-h-screen w-full bg-[#FEFEFE]">
      <Sidebar
        activeNav="campaign-approvals"
        onNavSelect={handleNavSelect}
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      <main className="flex-1 w-full min-h-screen p-4 sm:p-6 md:p-8 flex flex-col gap-6 items-stretch bg-[#FEFEFE] overflow-x-hidden font-inter">
        <Header
          adminName={String(profile?.full_name || profile?.email || "Admin")}
          adminRole={String(profile?.role || "Admin")}
          unreadCount={0}
          onToggleMobileMenu={() => setIsMobileMenuOpen(true)}
          onProfileClick={() => router.push("/settings")}
        />

        <div>
          <h1 className="text-2xl font-bold text-[#1A1A2E]">Campaign Approvals</h1>
          <p className="text-sm text-[#6B6B80] mt-1">
            New campaigns can&apos;t go live until approved. Revisions to live campaigns wait here
            while the currently approved version stays live.
          </p>
        </div>

        <div className="flex gap-2">
          {(["new", "revision"] as Kind[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setKind(tab)}
              className={`h-10 px-5 rounded-full text-sm font-semibold cursor-pointer ${
                kind === tab ? "bg-[#3E3EDF] text-white" : "bg-[#F6F6FB] text-[#454656]"
              }`}
            >
              {tab === "new" ? "New campaigns" : "Revisions"} ({counts[tab]})
            </button>
          ))}
        </div>

        {success && (
          <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 text-sm rounded-lg px-3 py-2">
            {success}
          </div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        {!loaded && !error ? (
          <p className="text-sm text-[#9A9AB0]">Loading…</p>
        ) : visible.length === 0 ? (
          <div className="bg-white border border-[#ECECF5] rounded-2xl p-10 text-center text-[#9A9AB0]">
            Nothing waiting for review.
          </div>
        ) : (
          visible.map((review) => (
            <ReviewCard
              key={String(review.id)}
              review={review}
              onDecided={(message) => {
                setSuccess(message);
                void load();
              }}
            />
          ))
        )}
      </main>
    </div>
  );
};
