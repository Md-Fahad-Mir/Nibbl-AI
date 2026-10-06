"use client";

import React, { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

interface ForgotPasswordFormProps {
  onBack: () => void;
  onSendOtp: (email: string) => void;
}

export const ForgotPasswordForm: React.FC<ForgotPasswordFormProps> = ({
  onBack,
  onSendOtp,
}) => {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      onSendOtp(email);
    }, 1000);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full flex flex-col items-center gap-[24px]"
    >
      {/* Header with Back Arrow */}
      <div className="relative flex items-center justify-center w-full">
        <button
          type="button"
          onClick={onBack}
          className="absolute left-0 p-1 text-[#1F1D1D] hover:opacity-75 transition-opacity cursor-pointer"
          aria-label="Go back"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
        </button>
        <h1 className="font-inter text-[24px] font-medium leading-[29px] text-[#1F1D1D]">
          Forgot Password
        </h1>
      </div>

      {/* Description */}
      <p className="font-inter text-[16px] font-medium leading-[150%] text-[#575757] text-center max-w-[342px]">
        Please enter your email address to reset your password.
      </p>

      {/* Input */}
      <div className="w-full">
        <Input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>

      {/* Submit Button */}
      <Button type="submit" isLoading={isLoading}>
        Send OTP
      </Button>
    </form>
  );
};
