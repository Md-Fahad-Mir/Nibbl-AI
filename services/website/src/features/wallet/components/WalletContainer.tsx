"use client";

import { useCallback, useEffect, useState } from "react";
import Header from "../../homepage/components/Header";
import Footer from "../../homepage/components/Footer";
import WalletCardSection from "./WalletCardSection";
import WalletActivity from "./WalletActivity";
import RewardDetailsModal from "./RewardDetailsModal";
import WithdrawFlow from "./WithdrawFlow";
import BankDetailsModal from "./BankDetailsModal";
import VerifyPhoneModal from "./VerifyPhoneModal";
import { useConsumerApiStore } from "@/stores/useConsumerApiStore";
import { ApiError, ApiRecord, nibblApi } from "@/lib/api/backendApi";

interface WalletContainerProps {
  onTabChange: (tab: "offer" | "wallet" | "scan" | "profile" | "brand" | "notification", extra?: string) => void;
}

export default function WalletContainer({ onTabChange }: WalletContainerProps) {
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [isBankModalOpen, setIsBankModalOpen] = useState(false);
  const [walletMessage, setWalletMessage] = useState<string | null>(null);
  // Master: "Payout account already connected" → Request Review.
  const [duplicateAccount, setDuplicateAccount] = useState<{ provider: string; handle: string } | null>(null);
  const [reviewRequested, setReviewRequested] = useState(false);
  // Withdrawal waiting on the shopper to verify a phone number first.
  const [phoneGateMethodId, setPhoneGateMethodId] = useState<string | null>(null);
  const [activity, setActivity] = useState<ApiRecord | null>(null);
  const [openItem, setOpenItem] = useState<ApiRecord | null>(null);
  const { wallet, payoutMethods, unreadCount, loadWallet, createPayoutMethod } = useConsumerApiStore();

  const loadActivity = useCallback(() => {
    nibblApi.walletActivity().then(setActivity).catch(() => undefined);
  }, []);

  useEffect(() => {
    void loadWallet();
    loadActivity();
  }, [loadWallet, loadActivity]);

  const scrollToActivity = () => document.getElementById("wallet-history-section")?.scrollIntoView({ behavior: "smooth" });

  const available = Number(wallet?.available ?? wallet?.balance ?? 0);
  const canWithdraw = available >= 0.01;

  // Only approved payout accounts can be withdrawn to (methods pending review
  // are held until an admin approves them).
  const approvedMethods = payoutMethods
    .filter((method) => String(method.review_status ?? "approved") === "approved")
    .map((method) => ({
      id: String(method.id),
      provider: String(method.provider ?? ""),
      handle: String(method.handle ?? ""),
    }));
  const summary = (activity?.summary ?? {}) as ApiRecord;
  const activityItems = (Array.isArray(activity?.items) ? activity.items : []) as ApiRecord[];

  return (
    <div className="w-full bg-[#FEFEFE] min-h-screen flex flex-col font-sans select-none">
      <Header activeTab="wallet" onTabChange={onTabChange} unreadCount={unreadCount} />

      <main className="flex-grow flex flex-col items-center py-10 px-4 sm:px-6 max-w-[1440px] mx-auto w-full gap-8">
        <WalletCardSection
          balance={available}
          pending={summary.pending_approval != null ? Number(summary.pending_approval) : undefined}
          withdrawDisabled={!canWithdraw}
          onWithdrawClick={() => {
            if (!canWithdraw) {
              setWalletMessage("You need at least $0.01 available before requesting a withdrawal.");
              return;
            }
            setWalletMessage(null);
            setIsWithdrawModalOpen(true);
          }}
          onHistoryClick={scrollToActivity}
        />
        {walletMessage && (
          <p className="text-sm font-medium text-[#E65353]">
            {walletMessage}
          </p>
        )}
        
        <div id="wallet-history-section" className="w-full flex justify-center mt-2">
          <WalletActivity items={activityItems} onOpen={setOpenItem} />
        </div>
      </main>

      <Footer onTabChange={onTabChange} />

      {isWithdrawModalOpen && (
        <WithdrawFlow
          available={available}
          methods={approvedMethods}
          onClose={() => setIsWithdrawModalOpen(false)}
          onAddMethod={() => {
            setIsWithdrawModalOpen(false);
            setIsBankModalOpen(true);
          }}
          onNeedPhone={(methodId) => {
            setIsWithdrawModalOpen(false);
            setPhoneGateMethodId(methodId);
          }}
          onSubmitted={loadActivity}
          onViewActivity={() => {
            setIsWithdrawModalOpen(false);
            scrollToActivity();
          }}
        />
      )}

      {openItem && <RewardDetailsModal item={openItem} onClose={() => setOpenItem(null)} />}

      {isBankModalOpen && (
        <BankDetailsModal
          onClose={() => setIsBankModalOpen(false)}
          onSubmit={(details) => {
            setIsBankModalOpen(false);
            if (!canWithdraw) {
              setWalletMessage("You need at least $0.01 available before requesting a withdrawal.");
              return;
            }
            void createPayoutMethod(details.provider, details.handle)
              .then(async (method) => {
                // A newly added account beyond the first is held for review and
                // can't be withdrawn to until an admin approves it (Master:
                // "Change request submitted").
                if (String(method.review_status ?? "approved") !== "approved") {
                  setWalletMessage(
                    "Change request submitted. Nibbl will review your request before updating your payout method. Withdrawals to it will resume after the change is approved."
                  );
                  return;
                }
                await loadWallet();
                setIsWithdrawModalOpen(true);
              })
              .catch((error: unknown) => {
                const code = error instanceof ApiError ? (error.data as { code?: string } | null)?.code : undefined;
                if (code === "duplicate_payout_account") {
                  setReviewRequested(false);
                  setDuplicateAccount({ provider: details.provider, handle: details.handle });
                  return;
                }
                setWalletMessage(error instanceof Error ? error.message : "Withdrawal request failed.");
              });
          }}
        />
      )}

      {duplicateAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-[420px] bg-white rounded-[16px] p-6 flex flex-col gap-3 text-center">
            <h3 className="text-[18px] font-semibold text-[#1F1D1D]">
              {reviewRequested ? "Review requested" : "Payout account already connected"}
            </h3>
            <p className="text-[14px] text-[#575757]">
              {reviewRequested
                ? "Nibbl will review your request. No action is needed unless we contact you."
                : "This payout account is already connected to another Nibbl account. You can request a review if you believe this is an error."}
            </p>
            {reviewRequested ? (
              <button onClick={() => setDuplicateAccount(null)}
                className="h-11 rounded-lg bg-[#3E3EDF] text-white text-sm font-semibold cursor-pointer">Done</button>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => setDuplicateAccount(null)}
                  className="flex-1 h-11 rounded-lg border border-gray-200 text-sm font-semibold text-[#575757] cursor-pointer">Cancel</button>
                <button
                  onClick={() =>
                    void nibblApi.requestPayoutReview(duplicateAccount)
                      .then(() => setReviewRequested(true))
                      .catch((err: unknown) => {
                        setDuplicateAccount(null);
                        setWalletMessage(err instanceof Error ? err.message : "Could not request a review.");
                      })
                  }
                  className="flex-1 h-11 rounded-lg bg-[#3E3EDF] text-white text-sm font-semibold cursor-pointer">
                  Request Review
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {phoneGateMethodId && (
        <VerifyPhoneModal
          reason="Withdrawals are protected by an SMS code. Verify your mobile number to continue."
          onClose={() => setPhoneGateMethodId(null)}
          onVerified={() => {
            // Phone verified: resume the withdrawal flow.
            setPhoneGateMethodId(null);
            setIsWithdrawModalOpen(true);
          }}
        />
      )}

    </div>
  );
}
