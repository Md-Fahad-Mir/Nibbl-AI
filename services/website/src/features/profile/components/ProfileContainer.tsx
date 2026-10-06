"use client";

import { ChangeEvent, FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import UserAvatar from "@/components/UserAvatar";
import Header from "../../homepage/components/Header";
import Footer from "../../homepage/components/Footer";
import { LoadState, useConsumerApiStore } from "@/stores/useConsumerApiStore";
import { ApiError, ApiRecord, nibblApi } from "@/lib/api/backendApi";
import { displayOffer, imageUrl, text } from "@/features/homepage/lib/offerMappers";

type ProfileView = "menu" | "edit" | "saved" | "privacy" | "terms" | "notifications" | "help" | "faq" | "contact-us";

interface ProfileContainerProps {
  initialView?: "menu" | "notifications" | "privacy" | "terms" | "faq" | "help";
  onBack: () => void;
  onSignOut: () => void;
  onClaimOffer?: () => void;
  onSelectOffer?: (campaignId: string) => void;
  onTabChange?: (tab: "offer" | "wallet" | "scan" | "profile" | "brand" | "notification", extra?: string) => void;
}

type LegalContent = {
  title: string;
  content: string;
  updated_at?: string;
};

type PublicFaq = {
  id: string;
  question: string;
  answer: string;
  sort_order?: number;
  is_active?: boolean;
};

const viewFromInitial = (initialView: ProfileContainerProps["initialView"]): ProfileView => {
  if (initialView === "notifications") return "notifications";
  if (initialView === "privacy" || initialView === "terms" || initialView === "faq" || initialView === "help") {
    return initialView;
  }
  return "menu";
};

const contentErrorMessage = (error: unknown) =>
  error instanceof ApiError
    ? error.message
    : error instanceof Error
      ? error.message
      : "Unable to load this content right now.";

const toLegalContent = (record: ApiRecord): LegalContent => ({
  title: text(record.title, ""),
  content: text(record.content, ""),
  updated_at: text(record.updated_at, ""),
});

const toPublicFaq = (record: ApiRecord, index: number): PublicFaq => ({
  id: text(record.id, String(index)),
  question: text(record.question, "Untitled question"),
  answer: text(record.answer, ""),
  sort_order: Number(record.sort_order ?? index),
  is_active: Boolean(record.is_active ?? true),
});

export default function ProfileContainer({
  initialView = "menu",
  onBack,
  onSignOut,
  onClaimOffer,
  onSelectOffer,
  onTabChange,
}: ProfileContainerProps) {
  const [activeView, setActiveView] = useState<ProfileView>(() => viewFromInitial(initialView));
  const [fullName, setFullName] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState("");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showOldPass, setShowOldPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [activeFaqIndex, setActiveFaqIndex] = useState<number | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [privacyPolicy, setPrivacyPolicy] = useState<LegalContent | null>(null);
  const [termsContent, setTermsContent] = useState<LegalContent | null>(null);
  const [faqs, setFaqs] = useState<PublicFaq[]>([]);
  const [contentStatus, setContentStatus] = useState<LoadState>("idle");
  const [contentError, setContentError] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  const {
    user,
    savedOffers,
    notifications,
    notificationPreferences,
    unreadCount,
    status,
    error,
    loadProfile,
    loadSavedOffers,
    loadNotifications,
    updateProfile,
    changePassword,
    updateNotificationPreferences,
  } = useConsumerApiStore();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setActiveView(viewFromInitial(initialView));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [initialView]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (activeView === "saved") void loadSavedOffers();
    if (activeView === "notifications") void loadNotifications();
  }, [activeView, loadNotifications, loadSavedOffers]);

  useEffect(() => {
    let cancelled = false;

    const loadContent = async () => {
      if (activeView !== "privacy" && activeView !== "terms" && activeView !== "faq") {
        return;
      }

      setContentStatus("loading");
      setContentError(null);

      try {
        if (activeView === "privacy") {
          const document = await nibblApi.privacyPolicy();
          if (!cancelled) setPrivacyPolicy(toLegalContent(document));
        }

        if (activeView === "terms") {
          const document = await nibblApi.terms();
          if (!cancelled) setTermsContent(toLegalContent(document));
        }

        if (activeView === "faq") {
          const faqList = await nibblApi.faqs();
          if (!cancelled) {
            setFaqs(faqList.map(toPublicFaq));
            setActiveFaqIndex(null);
          }
        }

        if (!cancelled) setContentStatus("success");
      } catch (contentLoadError) {
        if (!cancelled) {
          setContentStatus("error");
          setContentError(contentErrorMessage(contentLoadError));
        }
      }
    };

    void loadContent();

    return () => {
      cancelled = true;
    };
  }, [activeView]);

  useEffect(() => {
    const nextName = text(user?.full_name ?? user?.name, "");
    if (!nextName) return;
    const timer = window.setTimeout(() => {
      setFullName(nextName);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [user]);

  const displayName = text(user?.full_name ?? user?.name, text(user?.email, "NibblAI user"));
  const email = text(user?.email, "");
  const backendAvatar = text(user?.avatar_url ?? user?.avatar ?? user?.profile_image, "");
  const avatar = avatarPreviewUrl || imageUrl(backendAvatar, "");
  const notificationsEnabled = Boolean(
    notificationPreferences?.push_enabled ??
      notificationPreferences?.email_enabled ??
      notificationPreferences?.enabled ??
      true
  );

  const mappedSavedOffers = useMemo(
    () => savedOffers.map((offer, index) => displayOffer(offer, index)),
    [savedOffers]
  );

  const handleTabClick = (tab: "offer" | "wallet" | "scan" | "profile" | "brand" | "notification") => {
    if (tab === "notification") {
      setActiveView("notifications");
    } else if (tab === "profile") {
      setActiveView("menu");
    } else {
      onTabChange?.(tab);
    }
  };

  const handleSaveChange = async (event: FormEvent) => {
    event.preventDefault();
    setSaveMessage(null);

    try {
      const shouldUpdateName = fullName.trim() && fullName.trim() !== displayName;
      if (shouldUpdateName || avatarFile) {
        if (avatarFile) {
          const form = new FormData();
          if (shouldUpdateName) form.append("full_name", fullName.trim());
          form.append("avatar", avatarFile);
          await updateProfile(form);
        } else {
          await updateProfile({ full_name: fullName.trim() });
        }
        setAvatarFile(null);
        setAvatarPreviewUrl("");
      }
      if (oldPassword && newPassword) {
        await changePassword(oldPassword, newPassword);
        setOldPassword("");
        setNewPassword("");
      }
      setSaveMessage("Profile changes saved to the backend.");
      setActiveView("menu");
    } catch {
      setSaveMessage(null);
    }
  };

  const handleAvatarChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setAvatarPreviewUrl(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleNotificationToggle = async () => {
    await updateNotificationPreferences({
      push_enabled: !notificationsEnabled,
      email_enabled: notificationPreferences?.email_enabled ?? true,
    });
  };

  const handleOfferClaim = (id: string) => {
    if (id) {
      onSelectOffer?.(id);
      return;
    }
    onClaimOffer?.();
  };

  return (
    <div className="w-full bg-[#FEFEFE] min-h-screen flex flex-col font-sans select-none">
      <Header
        activeTab={activeView === "notifications" ? "notification" : "profile"}
        onTabChange={handleTabClick}
        unreadCount={unreadCount}
      />

      <main className="flex-grow flex flex-col items-center py-10 px-4 sm:px-6 max-w-[1440px] mx-auto w-full relative">
        {activeView === "menu" && (
          <div className="w-full max-w-[608px] flex flex-col items-center gap-6 mt-4">
            <div className="flex flex-col items-center gap-2">
              <UserAvatar
                src={avatar}
                alt={displayName}
                className="h-[100px] w-[100px] border border-gray-150"
                iconClassName="h-12 w-12"
                sizes="100px"
                priority
              />

              <div className="flex flex-col items-center">
                <span className="text-[18px] font-medium leading-[22px] text-[#000000] text-center">
                  {displayName}
                </span>
                <span className="text-[12px] font-normal leading-[15px] text-[#575757] text-center mt-0.5">
                  {email || "No email returned by backend"}
                </span>
              </div>
            </div>

            <ProfileGroup title="Account Information">
              <ProfileRow label="Edit Profile" onClick={() => setActiveView("edit")} />
              <ProfileRow label="Saved" onClick={() => setActiveView("saved")} />
            </ProfileGroup>

            <ProfileGroup title="Policy Center">
              <ProfileRow label="Privacy Policy" onClick={() => setActiveView("privacy")} />
              <ProfileRow label="Terms & Condition" onClick={() => setActiveView("terms")} />
            </ProfileGroup>

            <ProfileGroup title="Settings">
              <div className="w-full flex justify-between items-center p-1.5">
                <span className="text-[18px] font-medium leading-[22px] text-[#575757]">
                  Notification
                </span>
                <button
                  onClick={() => void handleNotificationToggle()}
                  className={`w-10 h-5 flex items-center rounded-full p-0.5 transition-all cursor-pointer focus:outline-none ${
                    notificationsEnabled ? "bg-[#3E3EDF] justify-end" : "bg-gray-200 justify-start"
                  }`}
                >
                  <span className="w-4 h-4 bg-white rounded-full shadow-sm" />
                </button>
              </div>
              <ProfileRow label="Help & Support" onClick={() => setActiveView("help")} />
              <ProfileRow label="Log Out" onClick={onSignOut} />
            </ProfileGroup>

            {status === "error" && error && (
              <p className="text-sm font-medium text-[#E65353]">{error}</p>
            )}
            {saveMessage && (
              <p className="text-sm font-medium text-[#00A671]">{saveMessage}</p>
            )}

            <button
              onClick={onBack}
              className="text-[#3E3EDF] hover:underline text-sm font-medium mt-2 focus:outline-none"
            >
              &larr; Back to Offers
            </button>
          </div>
        )}

        {activeView === "edit" && (
          <div className="w-full max-w-[608px] bg-[#FEFEFE] border border-[#E0E0E0] shadow-[0px_4px_4px_rgba(0,0,0,0.08)] rounded-[12px] p-6 flex flex-col gap-6 mt-4">
            <h2 className="text-[24px] font-semibold leading-[29px] text-[#1F1D1D] w-full text-center">
              Edit Profile
            </h2>

            <form onSubmit={handleSaveChange} className="w-full flex flex-col items-center gap-6">
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                className="w-[112px] h-[112px] rounded-full overflow-hidden border border-gray-200 relative cursor-pointer hover:ring-2 hover:ring-[#3E3EDF] focus:outline-none focus:ring-2 focus:ring-[#3E3EDF]"
              >
                <UserAvatar
                  src={avatar}
                  alt={displayName}
                  className="h-full w-full"
                  iconClassName="h-12 w-12"
                  sizes="112px"
                  priority
                />
                <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-[12px] font-semibold text-white opacity-0 transition-all hover:bg-black/35 hover:opacity-100">
                  Change
                </span>
              </button>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />

              <div className="w-full flex flex-col gap-[14px]">
                <TextField label="Full Name" value={fullName} onChange={setFullName} placeholder="Name" />
                <PasswordField
                  label="Old Password"
                  value={oldPassword}
                  shown={showOldPass}
                  onToggle={() => setShowOldPass(!showOldPass)}
                  onChange={setOldPassword}
                />
                <PasswordField
                  label="New Password"
                  value={newPassword}
                  shown={showNewPass}
                  onToggle={() => setShowNewPass(!showNewPass)}
                  onChange={setNewPassword}
                />
              </div>

              {status === "error" && error && (
                <p className="text-center text-sm font-medium text-[#E65353]">{error}</p>
              )}

              <button
                type="submit"
                className="w-full h-[54px] bg-gradient-to-b from-[#3E3EDF] to-[#3E3EDF] hover:opacity-90 active:scale-[0.98] text-[#FEFEFE] text-[18px] font-medium leading-[22px] rounded-lg shadow-[0px_4px_4px_rgba(0,0,0,0.12),inset_0px_4px_4px_rgba(255,255,255,0.12)] flex items-center justify-center cursor-pointer transition-all focus:outline-none"
              >
                Save &amp; Change
              </button>

              <button
                type="button"
                onClick={() => setActiveView("menu")}
                className="text-[#3E3EDF] hover:underline text-sm font-medium focus:outline-none cursor-pointer"
              >
                Cancel &amp; Go Back
              </button>
            </form>
          </div>
        )}

        {activeView === "saved" && (
          <div className="w-full max-w-[772px] bg-[#FEFEFE] shadow-[0px_4px_4px_rgba(0,0,0,0.08)] rounded-[12px] p-6 flex flex-col items-center gap-6 mt-4">
            <h2 className="text-[24px] font-semibold leading-[29px] text-[#1F1D1D] w-full text-center">
              Saved Offers
            </h2>

            <div className="flex flex-col gap-8 w-full items-center">
              {mappedSavedOffers.length ? mappedSavedOffers.map((offer) => (
                <div key={offer.id} className="w-full max-w-[396px] bg-[#FFFFFF] shadow-[0px_2px_4px_rgba(0,0,0,0.12)] rounded-[14px] flex flex-col overflow-hidden relative border border-gray-100">
                  <div className="w-full h-[180px] bg-[#D9D9D9] relative overflow-hidden flex-shrink-0">
                    {offer.image ? (
                      <Image src={offer.image} alt={offer.title} fill sizes="396px" className="object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gray-100 text-xs text-gray-500">
                        No image returned
                      </div>
                    )}
                    <span className="absolute right-4 top-4 min-w-[64px] px-2 h-[30px] bg-[#E65353] shadow-[0px_4px_4px_rgba(0,0,0,0.12)] rounded-lg text-white text-[12px] font-semibold flex items-center justify-center z-10">
                      {offer.rewardLabel}
                    </span>
                  </div>

                  <div className="p-3 flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                      <div className="flex justify-between items-center text-[12px] font-normal leading-[15px] text-[#4D4D4D]">
                        <span>{offer.brand}</span>
                        <span>{offer.expires ? `Expires ${offer.expires}` : "Backend offer"}</span>
                      </div>
                      <h3 className="text-[16px] font-semibold leading-[19px] text-[#2D2D2D] truncate">
                        {offer.title}
                      </h3>
                    </div>

                    <button
                      onClick={() => handleOfferClaim(offer.id)}
                      className="w-full h-[34px] bg-gradient-to-b from-[#3E3EDF] to-[#3E3EDF] hover:opacity-90 active:scale-[0.98] text-[#FEFEFE] text-[16px] font-medium leading-[24px] rounded-lg shadow-[0px_4px_4px_rgba(0,0,0,0.12),inset_0px_4px_4px_rgba(255,255,255,0.12)] flex items-center justify-center cursor-pointer transition-all focus:outline-none"
                    >
                      Claim offer
                    </button>
                  </div>
                </div>
              )) : (
                <div className="w-full rounded-lg border border-gray-100 bg-white p-6 text-center text-sm text-[#575757]">
                  No saved offers returned by the backend.
                </div>
              )}
            </div>

            <button
              onClick={() => setActiveView("menu")}
              className="text-[#3E3EDF] hover:underline text-sm font-medium mt-4 focus:outline-none cursor-pointer"
            >
              &larr; Back to Profile Menu
            </button>
          </div>
        )}

        {(activeView === "privacy" || activeView === "terms") && (
          <ArticleView
            title={
              activeView === "privacy"
                ? privacyPolicy?.title || "Privacy Policy"
                : termsContent?.title || "Terms & Condition"
            }
            body={
              activeView === "privacy"
                ? privacyPolicy?.content || ""
                : termsContent?.content || ""
            }
            loading={contentStatus === "loading"}
            error={contentError}
            onBack={() => setActiveView("menu")}
          />
        )}

        {activeView === "notifications" && (
          <div className="w-full max-w-[772px] flex flex-col gap-6 mt-4">
            <div className="w-full flex items-center justify-center relative border-b border-gray-100 pb-4">
              <BackCircle onClick={() => setActiveView("menu")} />
              <h2 className="text-[24px] font-semibold leading-[29px] text-[#1F1D1D]">
                Notification
              </h2>
            </div>

            <div className="w-full min-h-[350px] flex flex-col text-gray-500">
              {notifications.length ? notifications.map((notification) => (
                <div key={String(notification.id ?? notification.created_at)} className="border-b border-gray-100 py-4">
                  <p className="text-[16px] font-medium text-[#1F1D1D]">
                    {text(notification.title, "Notification")}
                  </p>
                  <p className="mt-1 text-sm text-[#575757]">
                    {text(notification.body ?? notification.message ?? notification.description, "No message returned by backend.")}
                  </p>
                  <p className="mt-1 text-xs text-[#8A8A8A]">
                    {text(notification.created_at, "")}
                  </p>
                </div>
              )) : (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 text-gray-400">
                  <p className="text-sm font-normal">No notifications returned by the backend.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeView === "help" && (
          <div className="w-full max-w-[631px] bg-[#FEFEFE] border border-[#E0E0E0] rounded-[12px] p-6 sm:py-[29px] sm:px-[12px] flex flex-col gap-[21px] mx-auto mt-4 shadow-sm">
            <div className="w-full flex items-center justify-between border-b border-gray-100 pb-4">
              <h2 className="text-[24px] font-semibold leading-[29px] text-[#1F1D1D]">
                Help &amp; Support
              </h2>
              <BackCircle onClick={() => setActiveView("menu")} align="right" />
            </div>
            <div className="flex flex-col gap-4 w-full">
              <ProfileRow label="FAQ" onClick={() => setActiveView("faq")} />
              <ProfileRow label="Contact Us" onClick={() => setActiveView("contact-us")} />
            </div>
          </div>
        )}

        {activeView === "faq" && (
          <div className="w-full max-w-[885px] bg-[#FEFEFE] border border-[#E0E0E0] rounded-[12px] p-6 sm:py-[29px] sm:px-[12px] flex flex-col gap-6 mx-auto mt-4 shadow-sm">
            <div className="w-full flex items-center justify-between border-b border-gray-100 pb-4">
              <h2 className="text-[24px] font-semibold leading-[29px] text-[#1F1D1D]">
                FAQ
              </h2>
              <BackCircle onClick={() => setActiveView("help")} align="right" />
            </div>
            <div className="flex flex-col gap-3.5 w-full">
              {contentStatus === "loading" && (
                <div className="rounded-lg border border-gray-100 bg-white p-6 text-center text-sm text-[#575757]">
                  Loading FAQ...
                </div>
              )}
              {contentStatus === "error" && contentError && (
                <div className="rounded-lg border border-red-100 bg-red-50 p-4 text-sm font-medium text-red-600">
                  {contentError}
                </div>
              )}
              {contentStatus !== "loading" && faqs.length === 0 && !contentError && (
                <div className="rounded-lg border border-gray-100 bg-white p-6 text-center text-sm text-[#575757]">
                  No FAQ records have been published yet.
                </div>
              )}
              {faqs.map((faq, index) => (
                <div key={faq.id} className="w-full bg-[#FEFEFE] shadow-[0px_2px_4px_rgba(0,0,0,0.11)] rounded-[11px] overflow-hidden border border-gray-100 transition-all duration-300">
                  <button
                    onClick={() => setActiveFaqIndex(activeFaqIndex === index ? null : index)}
                    className="w-full p-5 flex items-center justify-between gap-4 text-left hover:bg-gray-50 focus:outline-none cursor-pointer"
                  >
                    <span className="text-[16px] font-medium leading-[19px] text-[#1F1D1D]">
                      {faq.question}
                    </span>
                    <span className={`w-5 h-5 flex shrink-0 items-center justify-center text-sm font-bold text-gray-500 transform transition-transform duration-200 ${
                      activeFaqIndex === index ? "rotate-90 text-[#3E3EDF]" : "-rotate-90"
                    }`}>
                      &rarr;
                    </span>
                  </button>
                  {activeFaqIndex === index && (
                    <div className="px-5 pb-5 pt-1 text-[12px] sm:text-[14px] font-normal leading-[20px] text-[#575757] border-t border-gray-50 bg-gray-50/30 whitespace-pre-line">
                      {faq.answer || "No answer has been published for this question."}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeView === "contact-us" && (
          <div className="w-full max-w-[463px] bg-[#FEFEFE] border border-[#E0E0E0] rounded-[12px] p-6 sm:py-[29px] sm:px-[12px] flex flex-col gap-4 mx-auto mt-4 shadow-sm">
            <div className="w-full flex items-center justify-between border-b border-gray-100 pb-4">
              <h2 className="text-[24px] font-semibold leading-[29px] text-[#1F1D1D]">
                Contact Us
              </h2>
              <BackCircle onClick={() => setActiveView("help")} align="right" />
            </div>
            {[
              ["Website", "https://joinnibbl.com"],
              ["Email", "mailto:support@joinnibbl.com"],
              ["Instagram", "https://instagram.com"],
            ].map(([label, href]) => (
              <a
                key={label}
                href={href}
                target={href.startsWith("http") ? "_blank" : undefined}
                rel={href.startsWith("http") ? "noreferrer" : undefined}
                className="w-full h-[48px] bg-white shadow-[0px_2px_4px_rgba(0,0,0,0.1)] border border-gray-100 rounded-lg px-4 flex items-center gap-3 hover:bg-gray-50 active:scale-[0.99] transition-all cursor-pointer focus:outline-none text-[#1F1D1D]"
              >
                <span className="text-[16px] font-medium leading-[24px]">{label}</span>
              </a>
            ))}
          </div>
        )}
      </main>

      <Footer onTabChange={onTabChange} />
    </div>
  );
}

function ProfileGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="w-full bg-[#FEFEFE] shadow-[0px_2px_4px_rgba(0,0,0,0.1)] rounded-[12px] p-4 flex flex-col gap-5 border border-gray-50">
      <span className="text-[16px] font-medium leading-[24px] text-[#1F1D1D]">
        {title}
      </span>
      <div className="flex flex-col gap-4">{children}</div>
    </div>
  );
}

function ProfileRow({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex justify-between items-center text-left hover:bg-gray-50 p-1.5 rounded-lg transition-colors cursor-pointer focus:outline-none"
    >
      <span className="text-[18px] font-medium leading-[22px] text-[#575757]">
        {label}
      </span>
      <span className="text-[#4D4D4D] w-6 h-6 flex items-center justify-center">&rarr;</span>
    </button>
  );
}

function TextField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2 w-full">
      <label className="text-[16px] font-medium leading-[24px] text-[#1F1D1D]">
        {label}
      </label>
      <div className="w-full h-[50px] border border-[#959595] rounded-lg bg-[#F9F9F9] flex items-center px-4">
        <input
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="bg-transparent border-none text-[#1F1D1D] placeholder-[#737373] text-[14px] leading-[17px] focus:outline-none w-full"
        />
      </div>
    </div>
  );
}

function PasswordField({
  label,
  value,
  shown,
  onToggle,
  onChange,
}: {
  label: string;
  value: string;
  shown: boolean;
  onToggle: () => void;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2 w-full">
      <label className="text-[16px] font-medium leading-[24px] text-[#1F1D1D]">
        {label}
      </label>
      <div className="w-full h-[50px] border border-[#959595] rounded-lg bg-[#F9F9F9] flex items-center px-4 justify-between">
        <input
          type={shown ? "text" : "password"}
          placeholder="********"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="bg-transparent border-none text-[#575757] placeholder-[#575757] text-[14px] leading-[17px] focus:outline-none w-full"
        />
        <button
          type="button"
          onClick={onToggle}
          className="text-gray-400 hover:text-black focus:outline-none cursor-pointer"
        >
          {shown ? "Hide" : "Show"}
        </button>
      </div>
    </div>
  );
}

function ArticleView({
  title,
  body,
  loading,
  error,
  onBack,
}: {
  title: string;
  body: string;
  loading: boolean;
  error: string | null;
  onBack: () => void;
}) {
  const hasHtml = /<\/?[a-z][\s\S]*>/i.test(body);

  return (
    <div className="w-full max-w-[1052px] flex flex-col gap-6 mt-4">
      <div className="w-full flex items-center gap-4 border-b border-gray-150 pb-4">
        <BackCircle onClick={onBack} />
        <h2 className="text-[24px] font-semibold leading-[29px] text-[#1F1D1D]">
          {title}
        </h2>
      </div>
      {loading && (
        <div className="rounded-lg border border-gray-100 bg-white p-6 text-center text-sm text-[#575757]">
          Loading content...
        </div>
      )}
      {!loading && error && (
        <div className="rounded-lg border border-red-100 bg-red-50 p-4 text-sm font-medium text-red-600">
          {error}
        </div>
      )}
      {!loading && !error && !body && (
        <div className="rounded-lg border border-gray-100 bg-white p-6 text-center text-sm text-[#575757]">
          No content has been published yet.
        </div>
      )}
      {!loading && !error && body && hasHtml && (
        <div
          className="text-[14px] font-normal leading-[22px] text-[#575757] tracking-wide [&_a]:text-[#3E3EDF] [&_a]:underline [&_li]:ml-5 [&_ol]:list-decimal [&_p]:mb-4 [&_ul]:list-disc"
          dangerouslySetInnerHTML={{ __html: body }}
        />
      )}
      {!loading && !error && body && !hasHtml && (
        <p className="text-[14px] font-normal leading-[22px] text-[#575757] text-justify whitespace-pre-line tracking-wide">
          {body}
        </p>
      )}
    </div>
  );
}

function BackCircle({ onClick, align = "left" }: { onClick: () => void; align?: "left" | "right" }) {
  return (
    <button
      onClick={onClick}
      className={`${align === "left" ? "absolute left-0" : ""} w-10 h-10 rounded-full border border-gray-100 flex items-center justify-center hover:bg-gray-50 active:scale-[0.95] cursor-pointer focus:outline-none`}
    >
      <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
      </svg>
    </button>
  );
}
