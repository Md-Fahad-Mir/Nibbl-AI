"use client";

import { useRef, useState } from "react";
import { AuthStage } from "../types/auth.types";

interface VerifyEmailFormProps {
  onNavigate: (stage: AuthStage) => void;
  onSubmit: (otp: string) => void;
  onResend?: () => Promise<void>;
}

export default function VerifyEmailForm({
  onNavigate,
  onSubmit,
  onResend,
}: VerifyEmailFormProps) {
  const [otp, setOtp] = useState<string[]>(new Array(6).fill(""));
  const [resendMessage, setResendMessage] = useState("");
  const [isResending, setIsResending] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleChange = (element: HTMLInputElement, index: number) => {
    const value = element.value;
    if (isNaN(Number(value))) return; // only allow numbers

    const newOtp = [...otp];
    // take only the last character if typed
    newOtp[index] = value.substring(value.length - 1);
    setOtp(newOtp);

    // Focus next input if value entered
    if (value && index < 5 && inputRefs.current[index + 1]) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === "Backspace") {
      if (!otp[index] && index > 0 && inputRefs.current[index - 1]) {
        // focus previous input and clear it
        inputRefs.current[index - 1]?.focus();
        const newOtp = [...otp];
        newOtp[index - 1] = "";
        setOtp(newOtp);
      } else if (otp[index]) {
        // clear current input
        const newOtp = [...otp];
        newOtp[index] = "";
        setOtp(newOtp);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const otpString = otp.join("");
    if (otpString.length === 6) {
      onSubmit(otpString);
    }
  };

  const handleResend = async () => {
    if (!onResend || isResending) return;
    setIsResending(true);
    setResendMessage("");
    try {
      await onResend();
      setResendMessage("A new code has been sent.");
    } catch {
      setResendMessage("Could not resend the code. Please try again.");
    } finally {
      setIsResending(false);
    }
  };

  const isComplete = otp.every((val) => val !== "");

  return (
    <div className="w-full max-w-[420px] bg-white rounded-2xl shadow-xl p-5 sm:p-8 border border-gray-100 flex flex-col relative transition-all duration-300 hover:shadow-2xl">
      {/* Back Button */}
      <button
        onClick={() => onNavigate("forgot-password")}
        className="absolute left-6 top-7 text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
      </button>

      <div className="text-center mb-6 mt-2">
        <h2 className="text-xl font-bold text-gray-900">Verify Email</h2>
        <p className="text-xs text-gray-400 mt-1.5 leading-relaxed max-w-[285px] mx-auto">
          Please enter the otp we have sent you in your email.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {/* OTP Inputs Layout */}
        <div className="flex justify-center gap-1.5 sm:gap-2.5">
          {otp.map((data, index) => (
            <input
              key={index}
              type="text"
              name="otp-field"
              maxLength={1}
              ref={(el) => {
                inputRefs.current[index] = el;
              }}
              value={data}
              onChange={(e) => handleChange(e.target, index)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              className="w-10 h-12 sm:w-[44px] sm:h-[57px] border border-[#575757] rounded-lg text-center text-base sm:text-lg font-medium text-gray-800 focus:outline-none focus:border-[#3E3EDF] focus:ring-1 focus:ring-[#3E3EDF] transition-all bg-transparent"
              style={{ caretColor: "#3E3EDF" }}
            />
          ))}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={!isComplete}
          className={`w-full h-[48px] text-white font-medium text-sm rounded-lg flex items-center justify-center transition-all bg-gradient-to-r from-[#3E3EDF] to-[#3E3EDF] shadow-md ${
            isComplete
              ? "opacity-100 hover:from-[#3232c4] hover:to-[#3232c4] active:scale-[0.98]"
              : "opacity-60 cursor-not-allowed"
          }`}
        >
          Verify Email
        </button>
      </form>

      {/* Resend Link */}
      <div className="text-center mt-6 text-xs text-gray-500">
        Didn&apos;t receive code?{" "}
        <button
          type="button"
          onClick={() => void handleResend()}
          disabled={!onResend || isResending}
          className="text-[#3E3EDF] font-semibold hover:underline disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isResending ? "Sending..." : "Resend OTP"}
        </button>
      </div>
      {resendMessage && (
        <p className="mt-2 text-center text-xs font-medium text-gray-500">
          {resendMessage}
        </p>
      )}
    </div>
  );
}
