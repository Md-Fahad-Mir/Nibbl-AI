"use client";

import { useEffect, useState } from "react";
import Header from "../../homepage/components/Header";
import Footer from "../../homepage/components/Footer";
import WalletCardSection from "./WalletCardSection";
import RecentRewardsCard from "./RecentRewardsCard";
import WithdrawFundsModal from "./WithdrawFundsModal";
import BankDetailsModal from "./BankDetailsModal";
import VerifyWithdrawalModal from "./VerifyWithdrawalModal";
import VerifyPhoneModal from "./VerifyPhoneModal";
import { useConsumerApiStore } from "@/stores/useConsumerApiStore";
import { ApiError, nibblApi } from "@/lib/api/backendApi";

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
  const [verify, setVerify] = useState<{ phone: string; methodId: string } | null>(null);
  const [verifySubmitting, setVerifySubmitting] = useState(false);
  const [verifyError, setVerifyError] = useState("");
  // Withdrawal waiting on the shopper to verify a phone number first.
  const [phoneGateMethodId, setPhoneGateMethodId] = useState<string | null>(null);
  const { wallet, redemptions, payoutMethods, unreadCount, loadWallet, createPayoutMethod, sendWithdrawalCode, requestWithdrawal } =
    useConsumerApiStore();

  useEffect(() => {
    void loadWallet();
  }, [loadWallet]);

  const available = Number(wallet?.available ?? wallet?.balance ?? 0);
  const canWithdraw = available >= 0.01;

  // Only approved payout accounts can be withdrawn to (methods pending review
  // are held until an admin approves them).
  const approvedMethods = payoutMethods
    .filter((method) => String(method.review_status ?? "approved") === "approved")
    .map((method) => ({
      id: String(method.id),
      label: `${String(method.provider ?? "").toUpperCase()} · ${String(method.handle ?? "")}`,
    }));

  const finalizeWithdrawal = (methodId: string, code?: string) =>
    requestWithdrawal(methodId, available.toFixed(2), code).then(() => {
      setVerify(null);
      setWalletMessage("Withdrawal request submitted.");
    });

  // Start a withdrawal on an approved method: request an SMS code, or (when
  // SMS verification isn't enabled) submit the withdrawal directly.
  const startWithdrawal = async (methodId: string) => {
    try {
      const { phone } = await sendWithdrawalCode(methodId, available.toFixed(2));
      setVerifyError("");
      setVerify({ phone, methodId });
    } catch (err) {
      if (err instanceof ApiError && err.status === 503) {
        await finalizeWithdrawal(methodId);
      } else if (
        err instanceof ApiError &&
        (err.data as { code?: string } | null)?.code === "phone_verification_required"
      ) {
        // No verified phone yet: verify inline, then resume this withdrawal.
        setPhoneGateMethodId(methodId);
      } else {
        throw err;
      }
    }
  };

  return (
    <div className="w-full bg-[#FEFEFE] min-h-screen flex flex-col font-sans select-none">
      <Header activeTab="wallet" onTabChange={onTabChange} unreadCount={unreadCount} />

      <main className="flex-grow flex flex-col items-center py-10 px-4 sm:px-6 max-w-[1440px] mx-auto w-full gap-8">
        <WalletCardSection
          balance={available}
          withdrawDisabled={!canWithdraw}
          onWithdrawClick={() => {
            if (!canWithdraw) {
              setWalletMessage("You need at least $0.01 available before requesting a withdrawal.");
              return;
            }
            setWalletMessage(null);
            setIsWithdrawModalOpen(true);
          }}
          onHistoryClick={() => {
            const el = document.getElementById("wallet-history-section");
            el?.scrollIntoView({ behavior: "smooth" });
          }}
        />
        {walletMessage && (
          <p className="text-sm font-medium text-[#E65353]">
            {walletMessage}
          </p>
        )}
        
        <div id="wallet-history-section" className="w-full flex justify-center mt-2">
          <RecentRewardsCard redemptions={redemptions} />
        </div>
      </main>

      <Footer onTabChange={onTabChange} />

      {isWithdrawModalOpen && (
        <WithdrawFundsModal
          amount={available}
          methods={approvedMethods}
          onClose={() => setIsWithdrawModalOpen(false)}
          onConfirm={(methodId) => {
            setIsWithdrawModalOpen(false);
            setWalletMessage(null);
            void startWithdrawal(methodId).catch((error: unknown) => {
              setWalletMessage(error instanceof Error ? error.message : "Withdrawal request failed.");
            });
          }}
          onAddNew={() => {
            setIsWithdrawModalOpen(false);
            setIsBankModalOpen(true);
          }}
        />
      )}

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
                // can't be withdrawn to until an admin approves it.
                if (String(method.review_status ?? "approved") !== "approved") {
                  setWalletMessage(
                    "Your payout account was added and is pending review. You can withdraw once it's approved."
                  );
                  return;
                }
                await startWithdrawal(String(method.id));
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
            const methodId = phoneGateMethodId;
            setPhoneGateMethodId(null);
            void startWithdrawal(methodId).catch((error: unknown) => {
              setWalletMessage(error instanceof Error ? error.message : "Withdrawal request failed.");
            });
          }}
        />
      )}

      {verify && (
        <VerifyWithdrawalModal
          phone={verify.phone}
          amount={available}
          submitting={verifySubmitting}
          error={verifyError}
          onVerify={(code) => {
            setVerifySubmitting(true);
            setVerifyError("");
            finalizeWithdrawal(verify.methodId, code)
              .catch((error: unknown) =>
                setVerifyError(error instanceof Error ? error.message : "Verification failed.")
              )
              .finally(() => setVerifySubmitting(false));
          }}
          onResend={() => {
            setVerifyError("");
            void sendWithdrawalCode(verify.methodId, available.toFixed(2)).catch(() =>
              setVerifyError("Could not resend the code.")
            );
          }}
          onClose={() => setVerify(null)}
        />
      )}
    </div>
  );
}
