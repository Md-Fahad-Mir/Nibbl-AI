"use client";

import { useState } from "react";
import Image from "next/image";
import { AuthStage, SignInCredentials } from "../types/auth.types";

interface SignInFormProps {
  onNavigate: (stage: AuthStage) => void;
  onSubmit: (data: SignInCredentials) => void;
}

export default function SignInForm({ onNavigate, onSubmit }: SignInFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ email, password, rememberMe });
  };

  return (
    <div className="w-full max-w-[420px] bg-white rounded-2xl shadow-xl p-5 sm:p-8 border border-gray-100 flex flex-col transition-all duration-300 hover:shadow-2xl">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Welcome Back</h2>
        <p className="text-xs text-gray-400 mt-1">Login to your account</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Email Input */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-gray-700">
            Enter your E-mail or number
          </label>
          <div className="relative flex items-center">
            <span className="absolute left-3.5 text-gray-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </span>
            <input
              type="text"
              required
              placeholder="E-mail address or phone number"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-10 pr-4 h-[44px] border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#3E3EDF] transition-colors placeholder:text-gray-400 text-gray-800"
            />
          </div>
        </div>

        {/* Password Input */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-gray-700">Password</label>
          <div className="relative flex items-center">
            <span className="absolute left-3.5 text-gray-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </span>
            <input
              type={showPassword ? "text" : "password"}
              required
              placeholder="••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-10 pr-10 h-[44px] border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#3E3EDF] transition-colors placeholder:text-gray-400 text-gray-800"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 text-gray-400 hover:text-gray-600 focus:outline-none"
            >
              {showPassword ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Remember Me and Forgot Password */}
        <div className="flex items-center justify-between text-xs mt-1">
          <label className="flex items-center gap-1.5 text-gray-500 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="rounded border-gray-300 text-[#3E3EDF] focus:ring-[#3E3EDF]"
            />
            Remember me
          </label>
          <button
            type="button"
            onClick={() => onNavigate("forgot-password")}
            className="text-[#3E3EDF] font-medium hover:underline"
          >
            Forgot password?
          </button>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          className="w-full h-[48px] text-white font-medium text-sm rounded-lg flex items-center justify-center transition-all bg-gradient-to-r from-[#3E3EDF] to-[#3E3EDF] hover:from-[#3232c4] hover:to-[#3232c4] shadow-md active:scale-[0.98] mt-2"
        >
          Login
        </button>
      </form>

      {/* Divider */}
      <div className="relative my-6 flex items-center justify-center">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200" />
        </div>
        <span className="relative bg-white px-3 text-xs text-gray-400">Or Continue With</span>
      </div>

      {/* Social Logins */}
      <div className="flex gap-4 justify-center">
        <button className="flex items-center justify-center w-12 h-12 rounded-full border border-gray-200 hover:bg-gray-50 transition-colors">
          <Image
            src="/logo/google (2).svg"
            alt="Google"
            width={20}
            height={20}
            className="w-5 h-5"
          />
        </button>
        <button className="flex items-center justify-center w-12 h-12 rounded-full border border-gray-200 hover:bg-gray-50 transition-colors">
          <Image
            src="/logo/apple (2).svg"
            alt="Apple"
            width={20}
            height={20}
            className="w-5 h-5"
          />
        </button>
      </div>

      {/* Switch to SignUp */}
      <div className="text-center mt-6 text-xs text-gray-500">
        Don&apos;t have an account?{" "}
        <button
          type="button"
          onClick={() => onNavigate("signup")}
          className="text-[#3E3EDF] font-semibold hover:underline"
        >
          Sign Up
        </button>
      </div>
    </div>
  );
}
