"use client";

import { useState, useEffect } from "react";
import { AuthStage, SignInCredentials, SignUpCredentials } from "../types/auth.types";
import SplashScreen from "./SplashScreen";
import Onboarding from "./Onboarding";
import AuthLayout from "./AuthLayout";
import SignInForm from "./SignInForm";
import SignUpForm from "./SignUpForm";
import ForgotPasswordForm from "./ForgotPasswordForm";
import VerifyEmailForm from "./VerifyEmailForm";
import ResetPasswordForm from "./ResetPasswordForm";
import HomepageContainer from "@/features/homepage/components/HomepageContainer";
import ClaimDetails from "@/features/homepage/components/ClaimDetails";
import ViewDetails from "@/features/homepage/components/ViewDetails";
import ProfileContainer from "@/features/profile/components/ProfileContainer";
import MyRewardContainer from "@/features/myreward/components/MyRewardContainer";
import WalletContainer from "@/features/wallet/components/WalletContainer";
import { useConsumerApiStore } from "@/stores/useConsumerApiStore";

type ProfileInitialView =
  | "menu"
  | "notifications"
  | "privacy"
  | "terms"
  | "faq"
  | "help";

const ROUTE_STORAGE_KEY = "nibbl_current_route";
const CAMPAIGN_STORAGE_KEY = "nibbl_selected_campaign_id";
const PROFILE_VIEW_STORAGE_KEY = "nibbl_profile_view";

const authenticatedStages = new Set<AuthStage>([
  "home",
  "claim-details",
  "view-details",
  "profile",
  "my-reward",
  "wallet",
]);

const profileViews = new Set<ProfileInitialView>([
  "menu",
  "notifications",
  "privacy",
  "terms",
  "faq",
  "help",
]);

const storageAvailable = () => typeof window !== "undefined";

const hasStoredAccessToken = () =>
  storageAvailable() && Boolean(window.localStorage.getItem("nibbl_access"));

const readStoredStage = (): AuthStage => {
  if (!hasStoredAccessToken()) return "splash";

  const storedStage = window.localStorage.getItem(ROUTE_STORAGE_KEY) as AuthStage | null;
  if (!storedStage || !authenticatedStages.has(storedStage)) return "home";

  const needsCampaign = storedStage === "claim-details" || storedStage === "view-details";
  if (needsCampaign && !window.localStorage.getItem(CAMPAIGN_STORAGE_KEY)) return "home";

  return storedStage;
};

const readStoredCampaignId = () => {
  if (!storageAvailable()) return "";
  return window.localStorage.getItem(CAMPAIGN_STORAGE_KEY) || "";
};

const readStoredProfileView = (): ProfileInitialView => {
  if (!storageAvailable()) return "menu";

  const storedView = window.localStorage.getItem(PROFILE_VIEW_STORAGE_KEY) as ProfileInitialView | null;
  return storedView && profileViews.has(storedView) ? storedView : "menu";
};

const clearStoredNavigation = () => {
  if (!storageAvailable()) return;
  window.localStorage.removeItem(ROUTE_STORAGE_KEY);
  window.localStorage.removeItem(CAMPAIGN_STORAGE_KEY);
  window.localStorage.removeItem(PROFILE_VIEW_STORAGE_KEY);
};

export default function AuthContainer() {
  const [stage, setStage] = useState<AuthStage>("splash");
  const [profileInitialView, setProfileInitialView] = useState<ProfileInitialView>("menu");
  const [hasRestoredNavigation, setHasRestoredNavigation] = useState(false);

  const [autoOpenReviewItem, setAutoOpenReviewItem] = useState<string | null>(null);
  const [autoUploadReservationId, setAutoUploadReservationId] = useState<string | null>(null);
  const [autoSelectReservationId, setAutoSelectReservationId] = useState<string | null>(null);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("");
  const [authFlow, setAuthFlow] = useState<"signup" | "password-reset" | null>(null);
  const [passwordResetCode, setPasswordResetCode] = useState("");
  const {
    accessToken,
    login,
    register,
    forgotPassword,
    resetPassword,
    verifyEmail,
    resendEmailVerification,
    logout,
    validateSession,
    loadOfferDetails,
    pendingEmail,
    error,
  } = useConsumerApiStore();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab");

      if (tab === "offer" || tab === "brand") {
        setStage("home");
      } else if (tab === "wallet") {
        setStage("wallet");
      } else if (tab === "scan") {
        setStage("my-reward");
      } else if (tab === "profile") {
        setProfileInitialView("menu");
        setStage("profile");
      } else if (tab === "notification") {
        setProfileInitialView("notifications");
        setStage("profile");
      } else if (tab === "privacy" || tab === "terms" || tab === "faq") {
        setProfileInitialView(tab);
        setStage("profile");
      } else {
        setSelectedCampaignId(readStoredCampaignId());
        setProfileInitialView(readStoredProfileView());
        setStage(readStoredStage());
      }

      setHasRestoredNavigation(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!hasRestoredNavigation || !accessToken) return;

    let cancelled = false;
    void validateSession().then((isValid) => {
      if (cancelled || isValid) return;
      clearStoredNavigation();
      setStage("signin");
    });

    return () => {
      cancelled = true;
    };
  }, [accessToken, hasRestoredNavigation, validateSession]);

  useEffect(() => {
    if (!hasRestoredNavigation || accessToken || !authenticatedStages.has(stage)) return;
    clearStoredNavigation();

    const timer = window.setTimeout(() => {
      setStage("signin");
    }, 0);

    return () => window.clearTimeout(timer);
  }, [accessToken, hasRestoredNavigation, stage]);

  useEffect(() => {
    if (!accessToken || !authenticatedStages.has(stage) || !storageAvailable()) return;
    window.localStorage.setItem(ROUTE_STORAGE_KEY, stage);
  }, [accessToken, stage]);

  useEffect(() => {
    if (!storageAvailable()) return;

    if (selectedCampaignId) {
      window.localStorage.setItem(CAMPAIGN_STORAGE_KEY, selectedCampaignId);
    } else {
      window.localStorage.removeItem(CAMPAIGN_STORAGE_KEY);
    }
  }, [selectedCampaignId]);

  useEffect(() => {
    if (!accessToken || !storageAvailable()) return;
    window.localStorage.setItem(PROFILE_VIEW_STORAGE_KEY, profileInitialView);
  }, [accessToken, profileInitialView]);

  const handleTabChange = (
    tab: "offer" | "wallet" | "scan" | "profile" | "brand" | "notification",
    extra?: string
  ) => {
    if (tab === "scan" && extra?.startsWith("reservation:")) {
      setAutoUploadReservationId(extra.replace("reservation:", ""));
      setAutoSelectReservationId(null);
      setAutoOpenReviewItem(null);
    } else if (tab === "scan" && extra?.startsWith("claim:")) {
      setAutoSelectReservationId(extra.replace("claim:", ""));
      setAutoUploadReservationId(null);
      setAutoOpenReviewItem(null);
    } else if (extra) {
      setAutoOpenReviewItem(extra);
      setAutoUploadReservationId(null);
      setAutoSelectReservationId(null);
    } else {
      setAutoOpenReviewItem(null);
      setAutoUploadReservationId(null);
      setAutoSelectReservationId(null);
    }

    if (tab === "offer" || tab === "brand") {
      setStage("home");
    } else if (tab === "wallet") {
      setStage("wallet");
    } else if (tab === "scan") {
      setStage("my-reward");
    } else if (tab === "profile") {
      if (extra === "privacy" || extra === "terms" || extra === "faq" || extra === "help") {
        setProfileInitialView(extra);
      } else {
        setProfileInitialView("menu");
      }
      setStage("profile");
    } else if (tab === "notification") {
      setProfileInitialView("notifications");
      setStage("profile");
    }
  };

  const handleSplashComplete = () => {
    setStage(accessToken ? "home" : "onboarding");
  };

  const handleSignInSubmit = async (data: SignInCredentials) => {
    if (!data.password) return;
    try {
      await login(data.email, data.password, data.rememberMe);
      if (storageAvailable()) window.localStorage.setItem(ROUTE_STORAGE_KEY, "home");
      setStage("home");
    } catch {
      // Store keeps the displayable error.
    }
  };

  const handleSignUpSubmit = async (data: SignUpCredentials) => {
    if (!data.password) return;
    try {
      await register(data.fullName, data.email, data.password);
      setAuthFlow("signup");
      setStage("verify-email");
    } catch {
      // Store keeps the displayable error.
    }
  };

  const handleForgotPasswordSubmit = async (email: string) => {
    try {
      await forgotPassword(email);
      setAuthFlow("password-reset");
      setStage("verify-email");
    } catch {
      // Store keeps the displayable error.
    }
  };

  const handleVerifyEmailSubmit = async (otp: string) => {
    if (authFlow === "password-reset") {
      setPasswordResetCode(otp);
      setStage("reset-password");
      return;
    }

    try {
      await verifyEmail(otp);
      setStage("signin");
    } catch {
      // Store keeps the displayable error.
    }
  };

  const handleResendCode = async () => {
    if (authFlow === "password-reset") {
      if (!pendingEmail) throw new Error("No email is waiting for password reset.");
      await forgotPassword(pendingEmail);
      return;
    }

    await resendEmailVerification();
  };

  const handleResetPasswordSubmit = async (password: string) => {
    try {
      await resetPassword(passwordResetCode, password);
      setAuthFlow(null);
      setPasswordResetCode("");
      setStage("signin");
    } catch {
      // Store keeps the displayable error.
    }
  };

  if (!hasRestoredNavigation) {
    return <div className="min-h-screen bg-white" />;
  }

  // Render Splash Screen directly
  if (stage === "splash") {
    return <SplashScreen onComplete={handleSplashComplete} />;
  }

  // Render Onboarding Screen directly
  if (stage === "onboarding") {
    return (
      <div className="animate-fade-in">
        <Onboarding onNavigate={setStage} />
      </div>
    );
  }

  // Render Homepage directly
  if (stage === "home") {
    return (
      <div className="animate-fade-in">
        <HomepageContainer
          onClaimOffer={(campaignId) => {
            setSelectedCampaignId(campaignId || "");
            if (campaignId) void loadOfferDetails(campaignId);
            setStage("claim-details");
          }}
          onViewOffer={(campaignId) => {
            setSelectedCampaignId(campaignId || "");
            if (campaignId) void loadOfferDetails(campaignId);
            setStage("view-details");
          }}
          onTabChange={handleTabChange}
        />
      </div>
    );
  }

  // Render Claim Details Page directly
  if (stage === "claim-details") {
    return (
      <div className="animate-fade-in">
        <ClaimDetails
          campaignId={selectedCampaignId}
          onBack={() => setStage("home")}
          onNavigate={setStage}
          onTabChange={handleTabChange}
        />
      </div>
    );
  }

  // Render View Details Page directly
  if (stage === "view-details") {
    return (
      <div className="animate-fade-in">
        <ViewDetails
          campaignId={selectedCampaignId}
          onBack={() => setStage("home")}
          onTabChange={handleTabChange}
        />
      </div>
    );
  }

  // Render Profile Container Page directly
  if (stage === "profile") {
    return (
      <div className="animate-fade-in">
        <ProfileContainer
          initialView={profileInitialView}
          onBack={() => setStage("home")}
          onSignOut={() => {
            clearStoredNavigation();
            void logout();
            setStage("onboarding");
          }}
          onClaimOffer={() => setStage("claim-details")}
          onSelectOffer={(campaignId) => {
            setSelectedCampaignId(campaignId);
            void loadOfferDetails(campaignId);
            setStage("claim-details");
          }}
          onTabChange={handleTabChange}
        />
      </div>
    );
  }

  // Render My Reward Page directly
  if (stage === "my-reward") {
    return (
      <div className="animate-fade-in">
        <MyRewardContainer
          onTabChange={handleTabChange}
          autoOpenReviewItem={autoOpenReviewItem}
          autoUploadReservationId={autoUploadReservationId}
          autoSelectReservationId={autoSelectReservationId}
          onClearAutoOpenReview={() => setAutoOpenReviewItem(null)}
          onClearAutoUploadReservation={() => setAutoUploadReservationId(null)}
          onClearAutoSelectReservation={() => setAutoSelectReservationId(null)}
        />
      </div>
    );
  }

  // Render Wallet Page directly
  if (stage === "wallet") {
    return (
      <div className="animate-fade-in">
        <WalletContainer
          onTabChange={handleTabChange}
        />
      </div>
    );
  }

  // Render all other forms inside the AuthLayout wrapper
  return (
    <AuthLayout>
      <div className="animate-fade-in w-full flex justify-center">
        {error && (
          <div className="fixed top-4 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm text-red-600 shadow-lg">
            {error}
          </div>
        )}
        {stage === "signin" && (
          <SignInForm
            onNavigate={setStage}
            onSubmit={handleSignInSubmit}
          />
        )}
        {stage === "signup" && (
          <SignUpForm
            onNavigate={setStage}
            onSubmit={handleSignUpSubmit}
          />
        )}
        {stage === "forgot-password" && (
          <ForgotPasswordForm
            onNavigate={setStage}
            onSubmit={handleForgotPasswordSubmit}
          />
        )}
        {stage === "verify-email" && (
          <VerifyEmailForm
            onNavigate={setStage}
            onSubmit={handleVerifyEmailSubmit}
            onResend={handleResendCode}
          />
        )}
        {stage === "reset-password" && (
          <ResetPasswordForm
            onNavigate={setStage}
            onSubmit={handleResetPasswordSubmit}
          />
        )}
      </div>
    </AuthLayout>
  );
}
