"use client";

import React, { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useAdminApiStore } from "@/stores/useAdminApiStore";

interface SignInFormProps {
  onForgotPassword: () => void;
  onSuccess?: () => void;
}

export const SignInForm: React.FC<SignInFormProps> = ({
  onForgotPassword,
  onSuccess,
}) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { login, error } = useAdminApiStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await login(username, password, rememberMe);
      setIsLoading(false);
      if (onSuccess) onSuccess();
    } catch {
      setIsLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full flex flex-col items-center gap-[24px]"
    >
      {/* Title */}
      <h1 className="font-inter text-[24px] font-medium leading-[29px] text-[#1F1D1D] text-center">
        Sign In
      </h1>

      {/* Input Fields */}
      <div className="w-full flex flex-col gap-[24px]">
        <Input
          type="email"
          placeholder="Email"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          isPrimaryBorder
        />
        <Input
          isPassword
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>

      {error && (
        <p className="w-full text-left text-sm font-medium text-red-600">
          {error}
        </p>
      )}

      {/* Checkbox & Forgot Password Link */}
      <div className="w-full flex items-center justify-between font-inter text-[16px] font-normal leading-[19px]">
        <label className="flex items-center gap-[8px] cursor-pointer select-none text-[#1F1D1D]">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="w-[18px] h-[18px] rounded-[4px] border border-[#1F1D1D] text-[#3E3EDF] focus:ring-0 cursor-pointer accent-[#3E3EDF]"
          />
          <span className="font-inter text-[16px] font-normal leading-[19px] text-[#1F1D1D] whitespace-nowrap">
            Remember me
          </span>
        </label>

        <button
          type="button"
          onClick={onForgotPassword}
          className="font-inter text-[16px] font-normal leading-[19px] text-[#1F1D1D] hover:underline cursor-pointer whitespace-nowrap"
        >
          Forgot password?
        </button>
      </div>

      {/* CTA Button */}
      <div className="w-full">
        <Button type="submit" isLoading={isLoading}>
          Sign In
        </Button>
      </div>
    </form>
  );
};
