"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useBrandApiStore } from "@/stores/useBrandApiStore";
import { CircleCheck, Clock, Mail } from "lucide-react";
import SignupSteps from "./SignupSteps";

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
      // The secure link signs the brand in: straight on to checkout.
      .then(() => router.replace(useBrandApiStore.getState().accessToken
        ? "/onboarding"
        : `/login?verified=1&email=${encodeURIComponent(initialEmail.trim().toLowerCase())}`))
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

        <SignupSteps current={3} />

        <div className="flex flex-col items-center gap-3 text-center">
          <span className="relative w-24 h-24 rounded-full bg-[#EEF0FF] flex items-center justify-center">
            <Mail className="w-12 h-12 text-[#001BD2]" />
            <CircleCheck className="absolute -right-1 top-1 w-8 h-8 text-white fill-emerald-500" />
          </span>
          <h2 className="text-3xl md:text-4xl font-extrabold text-[#131B2E] tracking-tight">
            {verifyingLink ? "Verifying your email…" : "Check Your Email"}
          </h2>
          <p className="text-base font-medium text-[#454656] leading-relaxed font-manrope">
            {verifyingLink
              ? "One moment while we confirm your work email."
              : linkFailed
                ? "That link is invalid or has expired. Send yourself a new one."
                : "One secure sign-in unlocks your brand workspace."}
          </p>
          {!verifyingLink && !linkFailed && initialEmail && (
            <p className="text-base text-[#454656] font-manrope">
              We sent a secure sign-in link to <b className="text-[#131B2E]">{initialEmail}</b>.
            </p>
          )}
        </div>

        {!verifyingLink && (
          <div className="flex flex-col gap-4">
            {!initialEmail && (
              <label className="flex flex-col gap-1.5 font-manrope text-xs font-bold text-[#454656]">
                Work Email Address
                <input
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  className="w-full h-12 bg-white border border-slate-200 rounded-xl px-4 text-sm focus:outline-none focus:border-[#001BD2] focus:ring-1 focus:ring-[#001BD2] placeholder-[#454656]/40"
                />
              </label>
            )}

            {notice && <p className="text-sm font-semibold text-emerald-700 text-center">{notice}</p>}
            {error && <p className="text-sm font-semibold text-red-600 text-center">{error}</p>}

            <div className="flex items-center justify-center gap-3 text-sm font-bold font-manrope">
              <button type="button" onClick={handleResend} disabled={status === "loading" || !normalizedEmail}
                className="text-[#001BD2] hover:underline disabled:opacity-50 cursor-pointer">
                {status === "loading" ? "Sending…" : "Resend Email"}
              </button>
              <span className="text-[#C5C5D9]">|</span>
              <Link href="/register" className="text-[#001BD2] hover:underline">Change Email</Link>
            </div>

            <div className="flex items-center gap-4 rounded-2xl bg-[#F2F3FF] p-4 font-manrope">
              <span className="w-12 h-12 rounded-full bg-[#E2E7FF] flex items-center justify-center flex-shrink-0">
                <Clock className="w-6 h-6 text-[#001BD2]" />
              </span>
              <span className="text-sm text-[#454656]">
                <b className="block text-[#131B2E]">Your onboarding progress is saved.</b>
                The secure link expires in 15 minutes.
              </span>
            </div>

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

            <p className="text-center text-sm text-[#454656] font-manrope">
              Need help?{" "}
              <a href="mailto:support@joinnibbl.com" className="text-[#001BD2] font-bold hover:underline">Contact support</a>
            </p>
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
