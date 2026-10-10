"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useBrandApiStore } from "@/stores/useBrandApiStore";

/** Master "Plan & Account Setup": the work email is verified through a secure
 *  link. Opening the link verifies automatically; otherwise this page asks the
 *  brand to check its inbox. The code form remains for signups made before
 *  links were introduced. */
export default function VerifyEmailCard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialEmail = searchParams.get("email") || "";
  const token = searchParams.get("token") || "";
  const { verifyEmail, resendEmailVerification, error, status } = useBrandApiStore();
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [notice, setNotice] = useState("");
  const [linkFailed, setLinkFailed] = useState(false);
  const attempted = useRef(false);

  const normalizedEmail = email.trim().toLowerCase();
  const toLogin = () => router.replace(`/login?verified=1&email=${encodeURIComponent(normalizedEmail)}`);

  useEffect(() => {
    if (!token || !initialEmail || attempted.current) return;
    attempted.current = true;
    verifyEmail(initialEmail, "", token)
      .then(() => router.replace(`/login?verified=1&email=${encodeURIComponent(initialEmail.trim().toLowerCase())}`))
      .catch(() => setLinkFailed(true));
  }, [token, initialEmail, verifyEmail, router]);

  const handleVerifyCode = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await verifyEmail(normalizedEmail, code);
      toLogin();
    } catch {
      // Store keeps the displayable error.
    }
  };

  const handleResend = async () => {
    if (!normalizedEmail) return;
    try {
      await resendEmailVerification(normalizedEmail);
      setNotice("A new verification link was sent. Check your inbox.");
      setLinkFailed(false);
    } catch {
      // Store keeps the displayable error.
    }
  };

  const verifyingLink = Boolean(token) && !linkFailed;

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
            {verifyingLink ? "Verifying your email…" : "Check your inbox"}
          </h2>
          <p className="text-sm font-medium text-[#454656] leading-relaxed">
            {verifyingLink
              ? "One moment while we confirm your work email."
              : linkFailed
                ? "That link is invalid or has expired. Send yourself a new one."
                : "We sent a secure verification link to your work email. Open it to continue to checkout. The link expires in 24 hours."}
          </p>
        </div>

        {!verifyingLink && (
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5 font-manrope">
              <label className="text-xs font-bold text-[#454656]">Work Email Address</label>
              <input
                type="email"
                placeholder="name@company.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                className="w-full h-14 bg-white border border-slate-200 rounded-2xl px-4 text-sm focus:outline-none focus:border-[#001BD2] focus:ring-1 focus:ring-[#001BD2] placeholder-[#454656]/40"
              />
            </div>

            {notice && <p className="text-sm font-semibold text-emerald-700">{notice}</p>}
            {error && <p className="text-sm font-semibold text-red-600">{error}</p>}

            <button
              type="button"
              onClick={handleResend}
              disabled={status === "loading" || !normalizedEmail}
              className="flex items-center justify-center w-full h-[56px] rounded-full text-white font-bold text-lg bg-gradient-to-r from-[#001BD2] to-[#2D3FEA] hover:opacity-95 transition-all shadow-lg shadow-blue-600/20 active:scale-[0.98] disabled:opacity-60"
            >
              {status === "loading" ? "Sending..." : "Resend verification link"}
            </button>

            {!showCode ? (
              <button type="button" onClick={() => setShowCode(true)}
                className="text-xs font-bold text-[#454656] hover:underline">
                Have a 6-digit code instead?
              </button>
            ) : (
              <form onSubmit={handleVerifyCode} className="flex gap-2 font-manrope">
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="123456"
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="flex-1 h-12 bg-white border border-slate-200 rounded-2xl px-4 text-sm focus:outline-none focus:border-[#001BD2]"
                />
                <button type="submit" disabled={status === "loading" || !normalizedEmail || code.length !== 6}
                  className="h-12 px-5 rounded-full bg-[#E2E7FF] text-[#001BD2] text-sm font-bold disabled:opacity-60">
                  Verify
                </button>
              </form>
            )}
          </div>
        )}

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
