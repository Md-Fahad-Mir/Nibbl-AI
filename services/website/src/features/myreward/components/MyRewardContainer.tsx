"use client";

import { useState, useEffect } from "react";
import Header from "../../homepage/components/Header";
import Footer from "../../homepage/components/Footer";
import PendingRebatesCard from "./PendingRebatesCard";
import EarnMoreCard from "./EarnMoreCard";
import ReceiptHistoryCard from "./ReceiptHistoryCard";
import ActivityHistoryCard from "./ActivityHistoryCard";
import InviteFriendsCard from "./InviteFriendsCard";
import UploadReceiptCard from "./UploadReceiptCard";
import ReviewChatModal, { ReviewSubmission } from "./ReviewChatModal";
import InviteFriendsModal from "./InviteFriendsModal";
import { useConsumerApiStore } from "@/stores/useConsumerApiStore";

interface MyRewardContainerProps {
  onTabChange: (tab: "offer" | "wallet" | "scan" | "profile" | "brand" | "notification", extra?: string) => void;
  autoOpenReviewItem?: string | null;
  autoUploadReservationId?: string | null;
  autoSelectReservationId?: string | null;
  onClearAutoOpenReview?: () => void;
  onClearAutoUploadReservation?: () => void;
  onClearAutoSelectReservation?: () => void;
}

interface Receipt {
  title: string;
  date: string;
  status: "Verified" | "Pending" | "Rejected";
}

interface Activity {
  id: string;
  type: "verified" | "pending" | "rejected" | "referral";
  title: string;
  subtitle: string;
  statusText: string;
  statusColor: string;
  iconBg: string;
  iconSrc: string;
}

const valueText = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value;
    if (typeof value === "number") return String(value);
  }
  return "";
};

export default function MyRewardContainer({
  onTabChange,
  autoOpenReviewItem,
  autoUploadReservationId,
  autoSelectReservationId,
  onClearAutoOpenReview,
  onClearAutoUploadReservation,
  onClearAutoSelectReservation,
}: MyRewardContainerProps) {
  const [activeReviewOpportunity, setActiveReviewOpportunity] =
    useState<Record<string, unknown> | null>(null);
  const [selectedReservationId, setSelectedReservationId] = useState<string | null>(null);
  const [focusedReservationId, setFocusedReservationId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const {
    receipts: apiReceipts,
    activities: apiActivities,
    reservations,
    reviewOpportunities,
    unreadCount,
    status,
    loadRewardsHub,
    uploadReceipt,
    submitReview,
    inviteFriend,
  } = useConsumerApiStore();
  const latestError = useConsumerApiStore((state) => state.error);

  useEffect(() => {
    void loadRewardsHub();
  }, [loadRewardsHub]);

  useEffect(() => {
    if (autoOpenReviewItem) {
      const reviewId = autoOpenReviewItem.startsWith("review:")
        ? autoOpenReviewItem.replace("review:", "")
        : autoOpenReviewItem;
      const opportunity = reviewOpportunities.find(
        (item) =>
          String(item.id || "") === reviewId ||
          String(item.product_id || "") === reviewId ||
          String(item.product || "") === reviewId ||
          String(item.product_name || "") === reviewId
      );

      if (!opportunity && autoOpenReviewItem.startsWith("review:")) return;

      const timer = setTimeout(() => {
        setActiveReviewOpportunity(
          opportunity || { id: reviewId, product_name: reviewId }
        );
        onClearAutoOpenReview?.();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [autoOpenReviewItem, onClearAutoOpenReview, reviewOpportunities]);

  useEffect(() => {
    if (!autoUploadReservationId) return;

    const timer = setTimeout(() => {
      setSelectedReservationId(autoUploadReservationId);
      setFocusedReservationId(autoUploadReservationId);
      setUploadError(null);
      setUploadMessage(null);
      document.getElementById("upload-receipt-section")?.scrollIntoView({ behavior: "smooth" });
      onClearAutoUploadReservation?.();
    }, 0);

    return () => clearTimeout(timer);
  }, [autoUploadReservationId, onClearAutoUploadReservation]);

  useEffect(() => {
    if (!autoSelectReservationId) return;

    const timer = setTimeout(() => {
      setSelectedReservationId(autoSelectReservationId);
      setFocusedReservationId(autoSelectReservationId);
      setUploadError(null);
      setUploadMessage("Offer claimed. Upload your receipt to complete the reward.");
      onClearAutoSelectReservation?.();
    }, 0);

    return () => clearTimeout(timer);
  }, [autoSelectReservationId, onClearAutoSelectReservation]);

  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  
  const [localReceipts] = useState<Receipt[]>([]);
  const [localActivities, setLocalActivities] = useState<Activity[]>([]);
  const focusedReservation = focusedReservationId
    ? reservations.find((reservation) => valueText(reservation.id) === focusedReservationId)
    : null;
  const focusedCampaignId = valueText(focusedReservation?.campaign);
  const focusedCampaignName = valueText(focusedReservation?.campaign_name);
  const filteredReservations = focusedReservationId
    ? reservations.filter((reservation) => valueText(reservation.id) === focusedReservationId)
    : reservations;
  const filteredApiReceipts = focusedReservationId
    ? apiReceipts.filter((receipt) => {
        const matchesReservation = valueText(receipt.reservation) === focusedReservationId;
        const matchesCampaign =
          focusedCampaignId && valueText(receipt.campaign) === focusedCampaignId;
        const matchesName =
          focusedCampaignName &&
          valueText(receipt.campaign_name).toLowerCase() === focusedCampaignName.toLowerCase();

        return matchesReservation || matchesCampaign || matchesName;
      })
    : apiReceipts;
  const focusedReceiptIds = new Set(
    filteredApiReceipts.map((receipt) => valueText(receipt.id)).filter(Boolean)
  );
  const filteredApiActivities = focusedReservationId
    ? apiActivities.filter((activity) => {
        const referenceId = valueText(activity.reference_id);
        const title = valueText(activity.title, activity.description).toLowerCase();
        return (
          referenceId === focusedReservationId ||
          focusedReceiptIds.has(referenceId) ||
          Boolean(focusedCampaignName && title.includes(focusedCampaignName.toLowerCase()))
        );
      })
    : apiActivities;
  const filteredReviewOpportunities = focusedReservationId
    ? reviewOpportunities.filter((opportunity) => {
        const receiptId = valueText(opportunity.receipt_id);
        const campaignName = valueText(opportunity.campaign_name).toLowerCase();
        return (
          Boolean(receiptId && focusedReceiptIds.has(receiptId)) ||
          Boolean(focusedCampaignName && campaignName === focusedCampaignName.toLowerCase())
        );
      })
    : reviewOpportunities;

  const receipts: Receipt[] = filteredApiReceipts.length
    ? filteredApiReceipts.map((receipt) => ({
        title: String(receipt.campaign_name || receipt.merchant || "Receipt"),
        date: String(receipt.created_at || "").slice(0, 10),
        status:
          receipt.status === "verified"
            ? "Verified"
            : receipt.status === "rejected"
              ? "Rejected"
              : "Pending",
      }))
    : localReceipts;

  const activities: Activity[] = filteredApiActivities.length
    ? filteredApiActivities.map((activity) => ({
        id: String(activity.id || activity.created_at || activity.title || "activity"),
        type: activity.entry_type === "credit" ? "verified" as const : "pending" as const,
        title: String(activity.title || activity.description || "Activity"),
        subtitle: String(activity.created_at || "").slice(0, 10),
        statusText: String(activity.category || activity.entry_type || "Activity"),
        statusColor: activity.entry_type === "credit" ? "text-[#00A671]" : "text-[#D7930A]",
        iconBg: activity.entry_type === "credit" ? "#00D855" : "#FF9400",
        iconSrc: activity.entry_type === "credit" ? "/myreward/tick-02.svg" : "/myreward/watch-01.svg",
      }))
    : localActivities;

  const handleUploadSuccess = async (file: File) => {
    const reservationId = selectedReservationId || String(reservations[0]?.id || "");
    if (!reservationId) {
      setUploadError("Select a pending reward before uploading a receipt.");
      setUploadMessage(null);
      return;
    }

    try {
      setUploadError(null);
      setUploadMessage(null);
      const receipt = await uploadReceipt(reservationId, file);
      const responseMessage = String(receipt.detail || receipt.message || "");
      setUploadMessage(responseMessage || "Receipt uploaded. Verification is in progress.");
      setSelectedReservationId(null);
    } catch (error) {
      const backendMessage = useConsumerApiStore.getState().error;
      setUploadError(backendMessage || (error instanceof Error ? error.message : "Receipt upload failed."));
      setUploadMessage(null);
    }
  };

  const handleReviewSubmit = async (submission: ReviewSubmission) => {
    if (!activeReviewOpportunity) {
      throw new Error("No review invitation is selected.");
    }

    const itemName = String(
      activeReviewOpportunity.product_name ||
        activeReviewOpportunity.campaign_name ||
        "Review"
    );

    await submitReview(
      activeReviewOpportunity,
      submission.rating,
      submission.answers
    );
    setActiveReviewOpportunity(null);
    
    // Append review rebate success
    const newActivity: Activity = {
      id: `act-${Date.now()}`,
      type: "verified",
      title: `Review Approved- $1.00 added to wallet`,
      subtitle: `Feedback submitted for ${itemName}.`,
      statusText: "Verified",
      statusColor: "text-[#00A671]",
      iconBg: "#00D855",
      iconSrc: "/myreward/tick-02.svg",
    };
    setLocalActivities((prev) => [newActivity, ...prev]);
  };

  return (
    <div className="w-full bg-[#FEFEFE] min-h-screen flex flex-col font-sans select-none">
      <Header activeTab="scan" onTabChange={onTabChange} unreadCount={unreadCount} />

      <main className="flex-grow flex flex-col items-center py-10 px-4 sm:px-6 max-w-[1440px] mx-auto w-full relative">
        <h1 className="text-[32px] font-medium leading-[39px] text-[#1F1D1D] text-center mb-10 mt-4">
          {focusedReservationId ? "Rewards" : "My Rewards"}
        </h1>
        <p className="max-w-[669px] -mt-8 mb-4 text-center text-[18px] leading-[26px] text-[#8A8A8A]">
          Track your rewards, upload receipts, and earn more with every purchase.
        </p>

        {/* Content Layout stack (Frame 2147229211) */}
        <div className="w-full max-w-[669px] flex flex-col items-center gap-[26px] pb-10">
          <PendingRebatesCard onUploadReceiptClick={(reservationId) => {
            setSelectedReservationId(reservationId);
            setFocusedReservationId(reservationId);
            setUploadError(null);
            setUploadMessage(null);
            const el = document.getElementById("upload-receipt-section");
            el?.scrollIntoView({ behavior: "smooth" });
          }}
          reservations={filteredReservations}
          receipts={filteredApiReceipts}
          selectedReservationId={selectedReservationId}
          selectedMessage={uploadError || uploadMessage}
          selectedMessageTone={uploadError ? "error" : "success"}
          />
          
          <ReceiptHistoryCard receipts={receipts} />

          {filteredReviewOpportunities.length > 0 && (
            <EarnMoreCard
              opportunities={filteredReviewOpportunities}
              onStartReviewClick={(item) => setActiveReviewOpportunity(item)}
            />
          )}
          
          <ActivityHistoryCard
            activities={activities}
          />
          
          <InviteFriendsCard onInviteClick={() => setIsInviteModalOpen(true)} />
          
          <div id="upload-receipt-section" className="w-full max-w-[667px]">
            <UploadReceiptCard
              onUploadStart={() => {
                setUploadError(null);
                setUploadMessage(null);
              }}
              onUploadSuccess={handleUploadSuccess}
            />
            {(uploadError || uploadMessage || (status === "error" && latestError && latestError !== uploadError)) && (
              <p className={`mt-3 text-center text-sm font-medium ${uploadError || status === "error" ? "text-red-500" : "text-[#00A671]"}`}>
                {uploadError || uploadMessage || latestError}
              </p>
            )}
          </div>
        </div>
      </main>

      <Footer onTabChange={onTabChange} />

      {activeReviewOpportunity && (
        <ReviewChatModal
          itemName={String(
            activeReviewOpportunity.product_name ||
              activeReviewOpportunity.campaign_name ||
              "Review opportunity"
          )}
          onClose={() => setActiveReviewOpportunity(null)}
          onSubmit={handleReviewSubmit}
        />
      )}

      {isInviteModalOpen && (
        <InviteFriendsModal
          onClose={() => setIsInviteModalOpen(false)}
          onSend={(name, contact) => {
            setIsInviteModalOpen(false);
            void inviteFriend(name, contact);
            const newActivity: Activity = {
              id: `act-${Date.now()}`,
              type: "referral",
              title: `Referral Invited: ${name}`,
              subtitle: `Invitation link sent to ${contact}`,
              statusText: "Pending",
              statusColor: "text-[#D7930A]",
              iconBg: "#4E31E3",
              iconSrc: "/myreward/user-circle-02.svg",
            };
            setLocalActivities((prev) => [newActivity, ...prev]);
          }}
        />
      )}
    </div>
  );
}
