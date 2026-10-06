"use client";

import { useState } from "react";
import { AuthStage } from "../types/auth.types";

interface ForgotPasswordFormProps {
  onNavigate: (stage: AuthStage) => void;
  onSubmit: (email: string) => void;
}

export default function ForgotPasswordForm({
  onNavigate,
  onSubmit,
}: ForgotPasswordFormProps) {
  const [email, setEmail] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(email);
  };

  return (
    <div className="w-full max-w-[420px] bg-white rounded-2xl shadow-xl p-5 sm:p-8 border border-gray-100 flex flex-col relative transition-all duration-300 hover:shadow-2xl">
      {/* Back Button */}
      <button
        onClick={() => onNavigate("signin")}
        className="absolute left-6 top-7 text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1 text-xs font-medium"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
      </button>

      <div className="text-center mb-6 mt-2">
        <h2 className="text-xl font-bold text-gray-900">Forgot Password</h2>
        <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
          Please enter your email address to reset your password
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Email Input */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-gray-700">E-mail</label>
          <div className="relative flex items-center">
            <span className="absolute left-3.5 text-gray-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </span>
            <input
              type="email"
              required
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-10 pr-4 h-[44px] border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#3E3EDF] transition-colors placeholder:text-gray-400 text-gray-800"
            />
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          className="w-full h-[48px] text-white font-medium text-sm rounded-lg flex items-center justify-center transition-all bg-gradient-to-r from-[#3E3EDF] to-[#3E3EDF] hover:from-[#3232c4] hover:to-[#3232c4] shadow-md active:scale-[0.98] mt-2"
        >
          Send OTP
        </button>
      </form>

      {/* Switch to SignIn */}
      <div className="text-center mt-6 text-xs text-gray-500">
        Remembered your password?{" "}
        <button
          type="button"
          onClick={() => onNavigate("signin")}
          className="text-[#3E3EDF] font-semibold hover:underline"
        >
          Sign In
        </button>
      </div>
    </div>
  );
}
