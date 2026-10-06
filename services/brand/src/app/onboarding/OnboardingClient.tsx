"use client";

import dynamic from "next/dynamic";

const OnboardingView = dynamic(
  () => import("@/features/onboarding/components/OnboardingView"),
  { ssr: false }
);

export default function OnboardingClient() {
  return <OnboardingView />;
}
