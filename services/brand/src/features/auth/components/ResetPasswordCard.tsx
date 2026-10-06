"use client";

import Image from "next/image";
import Link from "next/link";

export default function ResetPasswordCard() {
  return (
    <div className="min-h-screen w-full bg-[#FAF8FF] flex flex-col justify-between items-center py-12 px-4 font-jakarta">
      {/* Spacer for center-alignment top */}
      <div className="hidden md:block"></div>

      {/* Main Section */}
      <div className="w-full max-w-[448px] flex flex-col gap-8 items-center animate-slide-up">
        {/* Center Card */}
        <div className="w-full bg-white border border-[#C5C5D9]/15 shadow-[0px_24px_48px_rgba(19,27,46,0.06)] rounded-2xl p-8 md:p-12 flex flex-col items-center gap-8">
          {/* Logo */}
          <div className="relative w-[194px] h-[72px]">
            <Image
              src="/Auth/LogoImage.svg"
              alt="NibblAI Logo"
              fill
              className="object-contain"
              priority
            />
          </div>

          {/* Title & Description */}
          <div className="flex flex-col gap-2.5 text-center w-full">
            <h1 className="text-3xl font-bold font-jakarta text-[#131B2E] tracking-tight">
              Reset Password
            </h1>
            <p className="text-sm font-manrope text-[#454656] leading-relaxed">
              Enter your email address and we&apos;ll send you a link to reset your password.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={(e) => e.preventDefault()} className="w-full flex flex-col gap-6">
            <div className="flex flex-col gap-1.5 font-manrope">
              <label className="text-sm font-normal text-[#131B2E]">
                Email address
              </label>
              <input
                type="email"
                placeholder="name@company.com"
                className="w-full h-[52px] bg-white border border-slate-200 rounded-2xl px-4 text-sm focus:outline-none focus:border-[#001BD2] focus:ring-1 focus:ring-[#001BD2] text-slate-800 placeholder-[#757688] shadow-inner"
              />
            </div>

            {/* Submit Button */}
            <Link
              href="/login"
              className="flex items-center justify-center gap-2 w-full h-[52px] rounded-full text-white font-bold text-sm bg-gradient-to-r from-[#001BD2] to-[#2D3FEA] hover:opacity-95 transition-all duration-200 active:scale-[0.98]"
            >
              <span>Send Reset Link</span>
              <span>→</span>
            </Link>
          </form>

          {/* Back to Login Link */}
          <Link
            href="/login"
            className="flex items-center justify-center gap-1.5 font-manrope font-semibold text-sm text-[#001BD2] hover:underline"
          >
            <span>←</span>
            <span>Back to login</span>
          </Link>
        </div>

        {/* Secure Link Policy Box */}
        <div className="w-full bg-[#F2F3FF]/50 border border-[#F2F3FF] rounded-2xl p-4 flex gap-3 items-start font-manrope">
          {/* Info Icon */}
          <div className="w-4 h-4 rounded-full bg-[#E2E7FF] text-[#001BD2] text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
            i
          </div>
          <p className="text-xs text-[#454656] leading-[1.62] font-medium">
            <span className="font-bold text-[#131B2E]">Secure Link Policy:</span> Password reset links expire after 30 minutes for your security. Check your spam folder if you don&apos;t receive an email within 2 minutes.
          </p>
        </div>
      </div>

      {/* Shared Footer */}
      <footer className="w-full max-w-[1200px] flex flex-col md:flex-row justify-between items-center gap-4 pt-12 border-t border-slate-100 font-manrope text-sm text-[#454656] opacity-80 mt-12">
        <div className="flex gap-6">
          <Link href="/brand-landing" className="hover:underline tracking-wide">
            Privacy Policy
          </Link>
          <Link href="/brand-landing" className="hover:underline tracking-wide">
            Terms of Service
          </Link>
          <Link href="/brand-landing" className="hover:underline tracking-wide">
            Help Center
          </Link>
        </div>
        <div className="tracking-wide">
          &copy; 2026 Nibbl. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
