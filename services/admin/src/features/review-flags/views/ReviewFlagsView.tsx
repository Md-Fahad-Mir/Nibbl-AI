"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/features/dashboard/components/Sidebar";
import { Header } from "@/features/dashboard/components/Header";
import { SidebarNavItem } from "@/types/dashboard.types";
import { useAdminApiStore } from "@/stores/useAdminApiStore";
import { ApiRecord, nibblApi } from "@/lib/api/backendApi";

const dateTime = (value: unknown) =>
  typeof value === "string" && value ? new Date(value).toLocaleString() : "—";

const Term = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex flex-col gap-0.5">
    <span className="text-xs font-semibold uppercase tracking-wider text-[#9A9AB0]">{label}</span>
    <span className="text-sm text-[#1A1A2E] break-words">{value}</span>
  </div>
);

const FlagCard = ({ review, onDecided }: { review: ApiRecord; onDecided: (message: string) => void }) => {
  const qa = (Array.isArray(review.questions_and_answers) ? review.questions_and_answers : []) as ApiRecord[];
  const receipt = (review.receipt ?? null) as ApiRecord | null;
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"remove" | "keep" | null>(null);
  const [error, setError] = useState("");

  const decide = async (action: "remove" | "keep") => {
    setError("");
    setBusy(action);
    try {
      await nibblApi.decideFlaggedReview(String(review.id), action, note.trim());
      onDecided(action === "remove" ? "Review removed." : "Flag declined; the review is published.");
    } catch (err) {
      setError((err as Error).message || "Could not save the decision.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="bg-white border border-[#ECECF5] rounded-2xl p-6 shadow-sm flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-[#3E3EDF] uppercase tracking-wider">{String(review.brand_name ?? "")}</p>
          <h2 className="text-lg font-bold text-[#1A1A2E]">{String(review.product_name ?? "")}</h2>
          <p className="text-sm text-[#F59E0B]">{"★".repeat(Number(review.rating ?? 0))}</p>
        </div>
        <div className="text-right text-xs text-[#6B6B80]">
          <p>Flagged {dateTime(review.flagged_at)}</p>
        </div>
      </div>

      <div className="border border-red-100 bg-red-50/60 rounded-xl p-4 flex flex-col gap-1">
        <span className="text-sm font-bold text-red-700">Brand&apos;s reason: {String(review.flag_reason ?? "")}</span>
        {review.flag_note ? <span className="text-sm text-[#454656]">{String(review.flag_note)}</span> : null}
      </div>

      <div className="flex flex-col gap-1">
        {review.title ? <p className="text-sm font-bold text-[#1A1A2E]">{String(review.title)}</p> : null}
        <p className="text-sm text-[#454656] bg-[#F6F6FB] rounded-lg p-3">{String(review.content ?? "")}</p>
        {review.brand_response ? (
          <p className="text-sm text-[#454656] border-l-2 border-[#3E3EDF] pl-3 mt-2">
            <b>Brand response:</b> {String(review.brand_response)}
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Term label="Shopper" value={`${String(review.shopper_name ?? "")} · ${String(review.customer_email ?? "")}`} />
        <Term label="Campaign" value={String(review.campaign_name ?? "—")} />
        <Term
          label="Receipt"
          value={
            receipt ? (
              <>
                {String(receipt.merchant ?? "")} {receipt.purchased_at ? `· ${String(receipt.purchased_at)}` : ""}
                {receipt.image_url ? (
                  <>
                    {" · "}
                    <a href={String(receipt.image_url)} target="_blank" rel="noreferrer" className="text-[#3E3EDF] font-semibold">
                      View
                    </a>
                  </>
                ) : null}
              </>
            ) : (
              "—"
            )
          }
        />
      </div>

      {qa.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer font-semibold text-[#3E3EDF]">Conversation ({qa.length} answers)</summary>
          <ul className="mt-2 flex flex-col gap-2">
            {qa.map((pair, index) => (
              <li key={index}>
                <p className="text-[#6B6B80]">{String(pair.question ?? "")}</p>
                <p className="text-[#1A1A2E]">{String(pair.answer ?? "")}</p>
              </li>
            ))}
          </ul>
        </details>
      )}

      {error && <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>}
      <input
        className="w-full h-10 px-3 rounded-lg border border-[#E0E0F0] text-sm text-[#1A1A2E] outline-none focus:border-[#3E3EDF]"
        placeholder="Internal note (optional)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => decide("remove")}
          disabled={busy !== null}
          className="h-10 px-5 bg-red-600 hover:bg-red-700 text-white font-semibold text-sm rounded-full disabled:opacity-50 cursor-pointer"
        >
          {busy === "remove" ? "Removing…" : "Remove review"}
        </button>
        <button
          onClick={() => decide("keep")}
          disabled={busy !== null}
          className="h-10 px-5 border border-[#3E3EDF] text-[#3E3EDF] font-semibold text-sm rounded-full disabled:opacity-50 cursor-pointer"
        >
          {busy === "keep" ? "Publishing…" : "Keep & publish"}
        </button>
      </div>
    </div>
  );
};

/** Master #26: reviews a brand flagged during the 1–3★ hold wait here for
 *  Nibbl to remove them or keep (publish) them. */
export const ReviewFlagsView = () => {
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { profile, loadProfile, logout } = useAdminApiStore();
  const [reviews, setReviews] = useState<ApiRecord[] | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(
    () =>
      nibblApi
        .adminFlaggedReviews()
        .then(setReviews)
        .catch((err: Error) => setError(err.message || "Could not load flagged reviews.")),
    [],
  );

  useEffect(() => {
    void loadProfile();
    void load();
  }, [loadProfile, load]);

  const handleNavSelect = (item: SidebarNavItem) => {
    if (item === "logout") {
      logout();
      router.push("/");
      return;
    }
    router.push(`/${item}`);
  };

  return (
    <div className="flex min-h-screen w-full bg-[#FEFEFE]">
      <Sidebar
        activeNav="review-flags"
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
          <h1 className="text-2xl font-bold text-[#1A1A2E]">Flagged Reviews</h1>
          <p className="text-sm text-[#6B6B80] mt-1">
            Brands can flag a review for removal. It stays unpublished until you remove it or keep it.
          </p>
        </div>
        {success && (
          <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 text-sm rounded-lg px-3 py-2">{success}</div>
        )}
        {error && <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>}
        {reviews === null && !error ? (
          <p className="text-sm text-[#9A9AB0]">Loading…</p>
        ) : !reviews?.length ? (
          <div className="bg-white border border-[#ECECF5] rounded-2xl p-10 text-center text-[#9A9AB0]">
            No flagged reviews waiting.
          </div>
        ) : (
          reviews.map((review) => (
            <FlagCard
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
