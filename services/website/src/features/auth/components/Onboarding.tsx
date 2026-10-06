"use client";

import Image from "next/image";
import { AuthStage } from "../types/auth.types";

interface OnboardingProps {
  onNavigate: (stage: AuthStage) => void;
}

export default function Onboarding({ onNavigate }: OnboardingProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-[450px] bg-white rounded-2xl shadow-xl p-5 sm:p-8 flex flex-col items-center border border-gray-100 transition-all duration-300 hover:shadow-2xl">
        {/* Logo */}
        <div className="mb-6">
          <Image
            src="/logo/logoTiny.svg"
            alt="nibblAI Logo"
            width={130}
            height={50}
            priority
            className="h-auto w-auto"
          />
        </div>

        {/* Title & Subtitle */}
        <div className="text-center mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Welcome to nibblAI</h2>
          <p className="text-sm text-gray-500 max-w-[320px] mx-auto">
            Discover instant rebates and rewards on amount needed.
          </p>
        </div>

        {/* Features List */}
        <div className="w-full flex flex-col gap-6 mb-8">
          {/* Feature 1 */}
          <div className="flex gap-4 items-start">
            <div className="flex-shrink-0 bg-yellow-50 p-2 rounded-lg">
              <Image
                src="/logo/moneybag.svg"
                alt="Money bag"
                width={36}
                height={36}
                className="w-9 h-9"
              />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Claim Instant Rebates</h3>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                Scan any participating product in-store to see if there&apos;s reward available.
              </p>
            </div>
          </div>

          {/* Feature 2 */}
          <div className="flex gap-4 items-start">
            <div className="flex-shrink-0 bg-blue-50 p-2 rounded-lg">
              <Image
                src="/logo/star.svg"
                alt="Star"
                width={36}
                height={36}
                className="w-9 h-9"
              />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Earn A Bonus Review</h3>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                Upload your receipt line and share feedback to earn extra cash.
              </p>
            </div>
          </div>

          {/* Feature 3 */}
          <div className="flex gap-4 items-start">
            <div className="flex-shrink-0 bg-purple-50 p-2 rounded-lg">
              <Image
                src="/logo/camera.svg"
                alt="Camera"
                width={36}
                height={36}
                className="w-9 h-9"
              />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">No Account? You Can Still Earn</h3>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                We&apos;ll save your rewards - you can link PayPal or Venmo when you&apos;re ready to cash out.
              </p>
            </div>
          </div>
        </div>

        {/* Buttons and Navigation */}
        <div className="w-full flex flex-col gap-3 items-center">
          <button
            onClick={() => onNavigate("signin")}
            className="w-full h-[48px] text-white font-medium text-sm rounded-lg flex items-center justify-center transition-all bg-gradient-to-r from-[#3E3EDF] to-[#3E3EDF] hover:from-[#3232c4] hover:to-[#3232c4] shadow-md active:scale-[0.98]"
          >
            Start Scanning
          </button>

          <button
            onClick={() => onNavigate("signin")}
            className="w-full h-[48px] border border-[#3E3EDF] text-[#3E3EDF] font-medium text-sm rounded-lg flex items-center justify-center transition-all hover:bg-blue-50 active:scale-[0.98]"
          >
            Upload from Photos
          </button>

          <button
            onClick={() => onNavigate("signin")}
            className="text-xs text-[#3E3EDF] font-medium hover:underline mt-2"
          >
            Browse Offers Nearby
          </button>

          <div className="text-xs text-gray-500 mt-6 flex gap-1">
            <span>Already have an account?</span>
            <button
              onClick={() => onNavigate("signin")}
              className="text-[#3E3EDF] font-semibold hover:underline"
            >
              Sign In
            </button>
          </div>

          <div className="text-xs text-gray-500 flex gap-1">
            <span>New user?</span>
            <button
              onClick={() => onNavigate("signup")}
              className="text-[#3E3EDF] font-semibold hover:underline"
            >
              Sign Up
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
