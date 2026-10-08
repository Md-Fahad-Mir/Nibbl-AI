"use client";

import { useState } from "react";

interface VerifyWithdrawalModalProps {
  phone: string; // masked, e.g. "•••• ••0123"
  amount: number;
  submitting?: boolean;
  error?: string;
  onVerify: (code: string) => void;
  onResend: () => void;
  onClose: () => void;
}

export default function VerifyWithdrawalModal({
  phone,
  amount,
  submitting = false,
  error,
  onVerify,
  onResend,
  onClose,
}: VerifyWithdrawalModalProps) {
  const [code, setCode] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in select-none">
      <div className="w-full max-w-[613px] bg-white rounded-[16px] p-6 sm:p-[61px] flex flex-col items-center border border-gray-100 shadow-[1px_8px_25.2px_rgba(0,0,0,0.25)] animate-scale-up">
        <div className="w-full flex flex-col items-center gap-[36px]">
          <div className="w-full flex flex-col justify-center items-center gap-[14px] text-center">
            <h2 className="text-[24px] font-medium leading-[29px] text-[#1F1D1D]">
              Verify this withdrawal
            </h2>
            <span className="text-[14px] font-normal leading-[20px] text-[#555]">
              We sent a 6-digit code to {phone}. Enter it to withdraw ${amount.toFixed(2)}.
            </span>
          </div>

          <input
            inputMode="numeric"
            autoFocus
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder="••••••"
            className="w-full max-w-[279px] h-[48px] text-center text-[22px] tracking-[0.4em] font-semibold text-[#1F1D1D] border border-[#D0D0D0] rounded-[12px] outline-none focus:border-[#3E3EDF]"
          />

          {error && (
            <p className="text-[13px] font-medium text-[#E65353] text-center">{error}</p>
          )}

          <div className="w-full flex flex-col items-center gap-[16px]">
            <button
              onClick={() => onVerify(code)}
              disabled={submitting || code.length < 4}
              className="w-full max-w-[279px] h-[39px] bg-[#3E3EDF] hover:opacity-90 active:scale-[0.98] transition-all text-white text-[16px] rounded-[12px] flex items-center justify-center cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none"
            >
              {submitting ? "Verifying…" : "Verify & Continue"}
            </button>

            <button
              onClick={onResend}
              disabled={submitting}
              className="text-[13px] font-medium text-[#3E3EDF] hover:underline disabled:opacity-50"
            >
              Resend code
            </button>

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
