"use client";

import React, { useState } from "react";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { SignInForm } from "./SignInForm";
import { ForgotPasswordForm } from "./ForgotPasswordForm";
import { VerifyEmailForm } from "./VerifyEmailForm";
import { ResetPasswordForm } from "./ResetPasswordForm";
import { useRouter } from "next/navigation";
import { AuthStep } from "@/types/auth.types";

interface AuthContainerProps {
  initialStep?: AuthStep;
}

export const AuthContainer: React.FC<AuthContainerProps> = ({
  initialStep = "sign-in",
}) => {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<AuthStep>(initialStep);

  return (
    <div className="flex items-center justify-center min-h-screen w-full bg-[#5D5D5D]">
      <AuthLayout>
        {currentStep === "sign-in" && (
          <SignInForm
            onForgotPassword={() => setCurrentStep("forgot-password")}
            onSuccess={() => router.push("/dashboard")}
          />
        )}

        {currentStep === "forgot-password" && (
          <ForgotPasswordForm
            onBack={() => setCurrentStep("sign-in")}
            onSendOtp={() => setCurrentStep("verify-email")}
          />
        )}

        {currentStep === "verify-email" && (
          <VerifyEmailForm
            onBack={() => setCurrentStep("forgot-password")}
            onVerify={() => setCurrentStep("reset-password")}
          />
        )}

        {currentStep === "reset-password" && (
          <ResetPasswordForm
            onBack={() => setCurrentStep("verify-email")}
            onResetComplete={() => {
              setCurrentStep("sign-in");
            }}
          />
        )}
      </AuthLayout>
    </div>
  );
};
