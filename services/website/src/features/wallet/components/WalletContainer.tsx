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
import { ApiError } from "@/lib/api/backendApi";

interface WalletContainerProps {
  onTabChange: (tab: "offer" | "wallet" | "scan" | "profile" | "brand" | "notification", extra?: string) => void;
}

export default function WalletContainer({ onTabChange }: WalletContainerProps) {
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [isBankModalOpen, setIsBankModalOpen] = useState(false);
  const [walletMessage, setWalletMessage] = useState<string | null>(null);
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
                setWalletMessage(error instanceof Error ? error.message : "Withdrawal request failed.");
              });
          }}
        />
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
