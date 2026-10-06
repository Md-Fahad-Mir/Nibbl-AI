/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { useBrandApiStore } from "@/stores/useBrandApiStore";

export default function LoginCard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, error, status, accessToken, refreshToken } = useBrandApiStore();
  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const verified = searchParams.get("verified") === "1";

  useEffect(() => {
    if (accessToken || refreshToken) {
      router.replace("/onboarding");
    }
  }, [accessToken, refreshToken, router]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await login(email.trim(), password, rememberMe);
      router.replace("/onboarding");
    } catch {
      // Store keeps the displayable error.
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#FAF8FF] flex items-center justify-center p-4 py-16 md:py-24 font-jakarta">
      {/* Login Card Wrapper */}
      <div className="w-full max-w-[448px] bg-white rounded-3xl shadow-xl p-6 md:p-10 flex flex-col gap-10 border border-slate-100/50 animate-slide-up">
        {/* Logo */}
        <div className="flex justify-center">
          <div className="relative w-[194px] h-[72px]">
            <Image
              src="/Auth/LogoImage.svg"
              alt="NibblAI Logo"
              fill
              className="object-contain"
              priority
            />
            
          </div>
        </div>

        {/* Header Title */}
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl md:text-3xl font-extrabold text-[#131B2E] tracking-tight">
            Welcome back
          </h2>
          <p className="text-sm font-medium text-[#454656] leading-relaxed">
            {verified ? "Email verified. Sign in to continue." : "Access your enterprise dashboard"}
          </p>
        </div>

        {/* Form Container */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          {/* Email Address */}
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

          {/* Password Section */}
          <div className="flex flex-col gap-1.5 font-manrope">
            <div className="flex justify-between items-center text-xs">
              <label className="font-bold text-[#454656]">Password</label>
              <Link href="/reset-password" className="font-bold text-[#001BD2] hover:underline">
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                className="w-full h-14 bg-white border border-slate-200 rounded-2xl px-4 pr-12 text-sm focus:outline-none focus:border-[#001BD2] focus:ring-1 focus:ring-[#001BD2] placeholder-[#454656]/40"
              />
              <button
                type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                title={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((current) => !current)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#757688] transition-colors hover:text-[#001BD2] focus:outline-none focus:text-[#001BD2]"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Remember Me */}
          <div className="flex items-center gap-3 font-manrope">
            <input
              type="checkbox"
              id="remember"
              checked={rememberMe}
              onChange={(event) => setRememberMe(event.target.checked)}
              className="w-5 h-5 rounded-md border-slate-300 text-[#001BD2] focus:ring-[#001BD2] cursor-pointer"
            />
            <label htmlFor="remember" className="text-xs font-semibold text-[#454656] cursor-pointer">
              Remember me for 30 days
            </label>
          </div>

          {/* Sign In Button */}
          {error && (
            <div className="flex flex-col gap-1">
              <p className="text-sm font-semibold text-red-600">{error}</p>
              <p className="text-xs font-medium text-[#454656]">
                If you just signed up, finish email verification first.
                {" "}
                <Link href={`/verify-email?email=${encodeURIComponent(email.trim().toLowerCase())}`} className="font-bold text-[#001BD2] hover:underline">
                  Verify email
                </Link>
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={status === "loading"}
            className="flex items-center justify-center w-full h-[56px] rounded-full text-white font-bold text-lg bg-gradient-to-r from-[#001BD2] to-[#2D3FEA] hover:opacity-95 transition-all shadow-lg shadow-blue-600/20 active:scale-[0.98] disabled:opacity-60"
          >
            {status === "loading" ? "Signing in..." : "Sign In"}
          </button>

          {/* OR Divider */}
          <div className="flex items-center justify-center gap-4 py-1">
            <div className="h-[1px] bg-slate-200 flex-1"></div>
            <span className="text-xs font-extrabold tracking-widest text-[#454656] uppercase">
              Or continue with
            </span>
            <div className="h-[1px] bg-slate-200 flex-1"></div>
          </div>

          {/* Google Sign In Button */}
          <button
            type="button"
            disabled
            className="flex items-center justify-center gap-3 w-full h-14 rounded-full border border-slate-200 bg-slate-50 text-[#757688] font-bold text-sm transition-all duration-200 cursor-not-allowed opacity-70"
          >
            <img
              src="/Auth/3rdPageIcons/googleIcon.svg"
              alt="Google icon"
              className="w-5 h-5 object-contain"
            />
            <span>Google sign-in unavailable</span>
          </button>
        </form>

        {/* Footer Link */}
        <div className="text-center font-manrope text-sm font-medium text-[#454656]">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="text-[#001BD2] font-bold hover:underline">
            Sign Up
          </Link>
        </div>
      </div>
    </div>
  );
}
