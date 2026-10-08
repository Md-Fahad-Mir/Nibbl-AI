"use client";

import { useState } from "react";
import { useConsumerApiStore } from "@/stores/useConsumerApiStore";

interface VerifyPhoneModalProps {
  /** Why we're asking — shown under the title. */
  reason?: string;
  /** Pre-filled number (e.g. the shopper's existing unverified phone). */
  initialPhone?: string;
  onVerified: () => void;
  onClose: () => void;
}

/** Two steps: enter a US mobile number → enter the 6-digit SMS code. */
export default function VerifyPhoneModal({
  reason = "We'll text you a 6-digit code to confirm it's yours.",
  initialPhone = "",
  onVerified,
  onClose,
}: VerifyPhoneModalProps) {
  const { addPhone, verifyPhone } = useConsumerApiStore();
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState(initialPhone);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const sendCode = () =>
    run(async () => {
      await addPhone(phone);
      setCode("");
      setStep("code");
    });

  const confirmCode = () =>
    run(async () => {
      await verifyPhone(code);
      onVerified();
    });

  const primaryClass =
    "w-full max-w-[279px] h-[39px] bg-[#3E3EDF] hover:opacity-90 active:scale-[0.98] transition-all text-white text-[16px] rounded-[12px] flex items-center justify-center cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in select-none">
      <div className="w-full max-w-[613px] bg-white rounded-[16px] p-6 sm:p-[61px] flex flex-col items-center border border-gray-100 shadow-[1px_8px_25.2px_rgba(0,0,0,0.25)] animate-scale-up">
        <div className="w-full flex flex-col items-center gap-[30px]">
          <div className="w-full flex flex-col justify-center items-center gap-[14px] text-center">
            <h2 className="text-[24px] font-medium leading-[29px] text-[#1F1D1D]">
              {step === "phone" ? "Verify your phone number" : "Enter the code"}
            </h2>
            <span className="text-[14px] font-normal leading-[20px] text-[#555]">
              {step === "phone"
                ? reason
                : `We sent a 6-digit code to ${phone}. It expires in 10 minutes.`}
            </span>
          </div>

          {step === "phone" ? (
            <input
              type="tel"
              autoFocus
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && phone.trim() && void sendCode()}
              placeholder="(555) 123-4567"
              className="w-full max-w-[279px] h-[48px] text-center text-[18px] font-medium text-[#1F1D1D] border border-[#D0D0D0] rounded-[12px] outline-none focus:border-[#3E3EDF]"
            />
          ) : (
            <input
              inputMode="numeric"
              autoFocus
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && code.length >= 4 && void confirmCode()}
              placeholder="••••••"
              className="w-full max-w-[279px] h-[48px] text-center text-[22px] tracking-[0.4em] font-semibold text-[#1F1D1D] border border-[#D0D0D0] rounded-[12px] outline-none focus:border-[#3E3EDF]"
            />
          )}

          {step === "phone" && (
            <p className="text-[12px] text-[#777] text-center -mt-4">US mobile numbers only.</p>
          )}

          {error && (
            <p className="text-[13px] font-medium text-[#E65353] text-center">{error}</p>
          )}

          <div className="w-full flex flex-col items-center gap-[16px]">
            {step === "phone" ? (
              <button onClick={sendCode} disabled={busy || !phone.trim()} className={primaryClass}>
                {busy ? "Sending…" : "Send code"}
              </button>
            ) : (
              <>
                <button onClick={confirmCode} disabled={busy || code.length < 4} className={primaryClass}>
                  {busy ? "Verifying…" : "Verify"}
                </button>
                <div className="flex gap-4">
                  <button
                    onClick={sendCode}
                    disabled={busy}
                    className="text-[13px] font-medium text-[#3E3EDF] hover:underline disabled:opacity-50"
                  >
                    Resend code
                  </button>
                  <button
                    onClick={() => {
                      setError("");
                      setStep("phone");
                    }}
                    disabled={busy}
                    className="text-[13px] font-medium text-[#3E3EDF] hover:underline disabled:opacity-50"
                  >
                    Change number
                  </button>
                </div>
              </>
            )}

            <button
              onClick={onClose}
              className="w-[60px] h-[35px] border border-black rounded-[6px] hover:bg-gray-50 active:scale-[0.98] transition-all text-black text-[12px] font-medium flex items-center justify-center cursor-pointer focus:outline-none"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
