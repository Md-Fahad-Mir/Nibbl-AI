"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useBrandApiStore } from "@/stores/useBrandApiStore";

export default function VerifyEmailCard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialEmail = searchParams.get("email") || "";
  const { verifyEmail, resendEmailVerification, error, status } = useBrandApiStore();
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [notice, setNotice] = useState(
    initialEmail ? "Check your email for the 6-digit verification code." : ""
  );

  const normalizedEmail = email.trim().toLowerCase();

  const handleVerify = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await verifyEmail(normalizedEmail, code);
      router.replace(`/login?verified=1&email=${encodeURIComponent(normalizedEmail)}`);
    } catch {
      // Store keeps the displayable error.
    }
  };

  const handleResend = async () => {
    if (!normalizedEmail) return;
    try {
      await resendEmailVerification(normalizedEmail);
      setNotice("A fresh verification code was sent.");
    } catch {
      // Store keeps the displayable error.
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#FAF8FF] flex items-center justify-center p-4 py-16 md:py-24 font-jakarta">
      <div className="w-full max-w-[448px] bg-white rounded-3xl shadow-xl p-6 md:p-10 flex flex-col gap-8 border border-slate-100/50 animate-slide-up">
        <div className="flex justify-center">
          <div className="relative w-[194px] h-[72px]">
            <Image src="/Auth/LogoImage.svg" alt="NibblAI Logo" fill className="object-contain" priority />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <h2 className="text-2xl md:text-3xl font-extrabold text-[#131B2E] tracking-tight">
            Verify your email
          </h2>
          <p className="text-sm font-medium text-[#454656] leading-relaxed">
            Enter the email used for signup and the 6-digit verification code.
          </p>
        </div>

        <form onSubmit={handleVerify} className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5 font-manrope">
            <label className="text-xs font-bold text-[#454656]">Email Address</label>
            <input
              type="email"
              placeholder="name@company.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="w-full h-14 bg-white border border-slate-200 rounded-2xl px-4 text-sm focus:outline-none focus:border-[#001BD2] focus:ring-1 focus:ring-[#001BD2] placeholder-[#454656]/40"
            />
          </div>

          <div className="flex flex-col gap-1.5 font-manrope">
            <label className="text-xs font-bold text-[#454656]">Verification Code</label>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="123456"
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              required
              className="w-full h-14 bg-white border border-slate-200 rounded-2xl px-4 text-sm focus:outline-none focus:border-[#001BD2] focus:ring-1 focus:ring-[#001BD2] placeholder-[#454656]/30"
            />
          </div>

          {notice && <p className="text-sm font-semibold text-emerald-700">{notice}</p>}
          {error && <p className="text-sm font-semibold text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={status === "loading" || !normalizedEmail || code.length !== 6}
            className="flex items-center justify-center w-full h-[56px] rounded-full text-white font-bold text-lg bg-gradient-to-r from-[#001BD2] to-[#2D3FEA] hover:opacity-95 transition-all shadow-lg shadow-blue-600/20 active:scale-[0.98] disabled:opacity-60"
          >
            {status === "loading" ? "Verifying..." : "Verify Email"}
          </button>

          <button
            type="button"
            onClick={handleResend}
            disabled={status === "loading" || !normalizedEmail}
            className="text-sm font-bold text-[#001BD2] hover:underline disabled:opacity-60"
          >
            Resend code
          </button>
        </form>

        <div className="text-center font-manrope text-sm font-medium text-[#454656]">
          Already verified?{" "}
          <Link href="/login" className="text-[#001BD2] font-bold hover:underline">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
