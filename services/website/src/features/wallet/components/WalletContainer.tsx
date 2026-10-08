"use client";

import { useEffect, useState } from "react";
import Header from "../../homepage/components/Header";
import Footer from "../../homepage/components/Footer";
import WalletCardSection from "./WalletCardSection";
import RecentRewardsCard from "./RecentRewardsCard";
import WithdrawFundsModal from "./WithdrawFundsModal";
import BankDetailsModal from "./BankDetailsModal";
import VerifyWithdrawalModal from "./VerifyWithdrawalModal";
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
  const { wallet, redemptions, unreadCount, loadWallet, createPayoutMethod, sendWithdrawalCode, requestWithdrawal } =
    useConsumerApiStore();

  useEffect(() => {
    void loadWallet();
  }, [loadWallet]);

  const available = Number(wallet?.available ?? wallet?.balance ?? 0);
  const canWithdraw = available >= 0.01;

  const finalizeWithdrawal = (methodId: string, code?: string) =>
    requestWithdrawal(methodId, available.toFixed(2), code).then(() => {
      setVerify(null);
      setWalletMessage("Withdrawal request submitted.");
    });

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
          onClose={() => setIsWithdrawModalOpen(false)}
          onConfirm={() => {
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
                const methodId = String(method.id);
                try {
                  const { phone } = await sendWithdrawalCode(methodId, available.toFixed(2));
                  setVerifyError("");
                  setVerify({ phone, methodId }); // open the SMS verify step
                } catch (err) {
                  // Twilio not enabled yet → skip verification and proceed.
                  if (err instanceof ApiError && err.status === 503) {
                    await finalizeWithdrawal(methodId);
                  } else {
                    throw err; // e.g. 400 "verify your mobile number first"
                  }
                }
              })
              .catch((error: unknown) => {
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
