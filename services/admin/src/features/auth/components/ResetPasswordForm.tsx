"use client";

import React, { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

interface ResetPasswordFormProps {
  onBack: () => void;
  onResetComplete: () => void;
}

export const ResetPasswordForm: React.FC<ResetPasswordFormProps> = ({
  onBack,
  onResetComplete,
}) => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      onResetComplete();
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
          Reset Password
        </h1>
      </div>

      {/* Description */}
      <p className="font-inter text-[16px] font-medium leading-[150%] text-[#575757] text-center max-w-[342px]">
        Your password must be 8-10 character long.
      </p>

      {/* Inputs */}
      <div className="w-full flex flex-col gap-4">
        <Input
          isPassword
          placeholder="Set your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <Input
          isPassword
          placeholder="Re-enter password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />
      </div>

      {/* Submit Button */}
      <Button type="submit" isLoading={isLoading}>
        Reset Password
      </Button>
    </form>
  );
};
