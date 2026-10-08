"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Sidebar } from "@/features/dashboard/components/Sidebar";
import { Header } from "@/features/dashboard/components/Header";
import { SettingsSubTab, UserProfileData } from "@/types/settings.types";
import { SettingsMenuList } from "../components/SettingsMenuList";
import { PersonalInfoView } from "../components/PersonalInfoView";
import { SettingsPasswordFlow } from "../components/SettingsPasswordFlow";
import { FaqView } from "../components/FaqView";
import { PrivacyPolicyView } from "../components/PrivacyPolicyView";
import { TermsConditionView } from "../components/TermsConditionView";
import { PlatformSettingsView } from "../components/PlatformSettingsView";
import { SidebarNavItem } from "@/types/dashboard.types";
import { useRouter } from "next/navigation";
import { useAdminApiStore } from "@/stores/useAdminApiStore";
import { resolveBackendAssetUrl } from "@/lib/api/backendApi";

const splitPhone = (value: unknown) => {
  const phone = typeof value === "string" ? value : "";
  const knownCodes = ["+1242", "+880", "+971", "+44", "+33", "+49", "+91", "+81", "+61", "+1"];
  const code = knownCodes.find((item) => phone.startsWith(item)) || "+1";
  return {
    countryCode: code,
    phoneNumber: phone.startsWith(code) ? phone.slice(code.length) : phone,
  };
};

const buildPhone = (countryCode: string, phoneNumber: string) => {
  const number = phoneNumber.trim();
  if (!number) return "";
  if (number.startsWith("+")) return number;
  return `${countryCode}${number.replace(/^0+/, "")}`;
};

export const SettingsView = () => {
  const router = useRouter();
  const [activeSubTab, setActiveSubTab] = useState<SettingsSubTab>("menu");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const {
    profile,
    clearError,
    loadProfile,
    updateProfile,
    changePassword,
    forgotPassword,
    resetPassword,
    logout,
  } = useAdminApiStore();

  useEffect(() => {
    clearError();
    void loadProfile();
  }, [clearError, loadProfile]);

  const userProfile = useMemo<UserProfileData>(() => {
    const phone = splitPhone(profile?.phone);
    return {
      name: String(profile?.full_name || profile?.name || profile?.email || "Admin"),
      email: String(profile?.email || ""),
      countryCode: phone.countryCode,
      phoneNumber: phone.phoneNumber,
      role: String(profile?.role || "Admin"),
      avatarUrl: resolveBackendAssetUrl(profile?.avatar_url || profile?.avatar),
    };
  }, [profile]);

  const handleNavSelect = (item: SidebarNavItem) => {
    switch (item) {
      case "dashboard":
        router.push("/dashboard");
        break;
      case "earnings":
        router.push("/earnings");
        break;
      case "users":
        router.push("/users");
        break;
      case "brand":
        router.push("/brand");
        break;
      case "promo-codes":
        router.push("/promo-codes");
        break;
      case "payout-reviews":
        router.push("/payout-reviews");
        break;
      case "withdraw-request":
        router.push("/withdraw-request");
        break;
      case "settings":
        router.push("/settings");
        break;
      case "logout":
        logout();
        router.push("/");
        break;
      default:
        break;
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-[#FEFEFE]">
      {/* Responsive Sidebar */}
      <Sidebar
        activeNav="settings"
        onNavSelect={handleNavSelect}
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 w-full min-h-screen p-4 sm:p-6 md:p-8 flex flex-col gap-6 items-stretch bg-[#FEFEFE] overflow-x-hidden">
        {/* Header */}
        <Header
          adminName={userProfile.name}
          adminRole={userProfile.role}
          adminAvatarUrl={userProfile.avatarUrl}
          unreadCount={0}
          onToggleMobileMenu={() => setIsMobileMenuOpen(true)}
          onProfileClick={() => setActiveSubTab("personal-info")}
        />

        {/* Dynamic Sub-Tab Views */}
        {activeSubTab === "menu" && (
          <SettingsMenuList onSelectTab={(tab) => setActiveSubTab(tab)} />
        )}

        {activeSubTab === "personal-info" && (
          <PersonalInfoView
            key={`${userProfile.email}-${userProfile.name}-${userProfile.phoneNumber}-${userProfile.avatarUrl}`}
            initialProfile={userProfile}
            onBack={() => setActiveSubTab("menu")}
            onSaveProfile={async (updated, avatarFile) => {
              const phone = buildPhone(updated.countryCode, updated.phoneNumber);
              if (avatarFile) {
                const form = new FormData();
                form.append("full_name", updated.name.trim());
                if (phone) form.append("phone", phone);
                form.append("avatar", avatarFile);
                await updateProfile(form);
              } else {
                const payload: Record<string, string | null> = {
                  full_name: updated.name.trim(),
                };
                payload.phone = phone || null;
                await updateProfile(payload);
              }
            }}
          />
        )}

        {activeSubTab === "change-password" && (
          <SettingsPasswordFlow
            defaultEmail={userProfile.email}
            onBackToMenu={() => setActiveSubTab("menu")}
            onChangePassword={changePassword}
            onForgotPassword={forgotPassword}
            onResetPassword={resetPassword}
          />
        )}

        {activeSubTab === "platform-settings" && (
          <PlatformSettingsView onBack={() => setActiveSubTab("menu")} />
        )}

        {activeSubTab === "faq" && (
          <FaqView onBack={() => setActiveSubTab("menu")} />
        )}

        {activeSubTab === "privacy-policy" && (
          <PrivacyPolicyView onBack={() => setActiveSubTab("menu")} />
        )}

        {activeSubTab === "terms-conditions" && (
          <TermsConditionView onBack={() => setActiveSubTab("menu")} />
        )}

      </main>
    </div>
  );
};
