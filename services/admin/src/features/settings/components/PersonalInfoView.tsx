"use client";

import React, { useState } from "react";
import Image from "next/image";
import { UserProfileData } from "@/types/settings.types";

interface PersonalInfoViewProps {
  onBack: () => void;
  initialProfile?: UserProfileData;
  onSaveProfile?: (updatedProfile: UserProfileData, avatarFile?: File | null) => void | Promise<void>;
}

const countryCodes = [
  { code: "+1242", country: "United States" },
  { code: "+1", country: "United States" },
  { code: "+44", country: "United Kingdom" },
  { code: "+33", country: "France" },
  { code: "+880", country: "Bangladesh" },
  { code: "+49", country: "Germany" },
  { code: "+91", country: "India" },
  { code: "+971", country: "UAE" },
  { code: "+81", country: "Japan" },
  { code: "+61", country: "Australia" },
];

const renderFlagIcon = (code: string) => {
  switch (code) {
    case "+1242":
    case "+1":
      return (
        <svg
          width="26"
          height="17"
          viewBox="0 0 24 16"
          fill="none"
          className="rounded-[2px] shrink-0 shadow-xs"
        >
          <rect width="24" height="16" fill="#B22234" />
          <rect y="2.46" width="24" height="2.46" fill="white" />
          <rect y="7.38" width="24" height="2.46" fill="white" />
          <rect y="12.3" width="24" height="2.46" fill="white" />
          <rect width="9.6" height="8.6" fill="#3C3B6E" />
          <circle cx="2" cy="2" r="0.5" fill="white" />
          <circle cx="5" cy="2" r="0.5" fill="white" />
          <circle cx="8" cy="2" r="0.5" fill="white" />
          <circle cx="3.5" cy="4.3" r="0.5" fill="white" />
          <circle cx="6.5" cy="4.3" r="0.5" fill="white" />
          <circle cx="2" cy="6.6" r="0.5" fill="white" />
          <circle cx="5" cy="6.6" r="0.5" fill="white" />
          <circle cx="8" cy="6.6" r="0.5" fill="white" />
        </svg>
      );
    case "+44":
      return (
        <svg
          width="26"
          height="17"
          viewBox="0 0 24 16"
          fill="none"
          className="rounded-[2px] shrink-0 shadow-xs"
        >
          <rect width="24" height="16" fill="#012169" />
          <path d="M0 0L24 16M24 0L0 16" stroke="white" strokeWidth="2.5" />
          <path d="M0 0L24 16M24 0L0 16" stroke="#C8102E" strokeWidth="1.2" />
          <path d="M12 0V16M0 8H24" stroke="white" strokeWidth="4.5" />
          <path d="M12 0V16M0 8H24" stroke="#C8102E" strokeWidth="2.5" />
        </svg>
      );
    case "+880":
      return (
        <svg
          width="26"
          height="17"
          viewBox="0 0 24 16"
          fill="none"
          className="rounded-[2px] shrink-0 shadow-xs"
        >
          <rect width="24" height="16" fill="#006A4E" />
          <circle cx="10" cy="8" r="4.8" fill="#F42A41" />
        </svg>
      );
    case "+33":
      return (
        <svg
          width="26"
          height="17"
          viewBox="0 0 24 16"
          fill="none"
          className="rounded-[2px] shrink-0 shadow-xs"
        >
          <rect width="8" height="16" fill="#002395" />
          <rect x="8" width="8" height="16" fill="#FFFFFF" />
          <rect x="16" width="8" height="16" fill="#ED2939" />
        </svg>
      );
    case "+49":
      return (
        <svg
          width="26"
          height="17"
          viewBox="0 0 24 16"
          fill="none"
          className="rounded-[2px] shrink-0 shadow-xs"
        >
          <rect width="24" height="5.33" fill="#000000" />
          <rect y="5.33" width="24" height="5.33" fill="#DD0000" />
          <rect y="10.66" width="24" height="5.33" fill="#FFCC00" />
        </svg>
      );
    default:
      return (
        <svg
          width="26"
          height="17"
          viewBox="0 0 24 16"
          fill="none"
          className="rounded-[2px] shrink-0 shadow-xs"
        >
          <rect width="24" height="16" fill="#B22234" />
          <rect y="2.46" width="24" height="2.46" fill="white" />
          <rect y="7.38" width="24" height="2.46" fill="white" />
          <rect y="12.3" width="24" height="2.46" fill="white" />
          <rect width="9.6" height="8.6" fill="#3C3B6E" />
        </svg>
      );
  }
};

export const PersonalInfoView: React.FC<PersonalInfoViewProps> = ({
  onBack,
  initialProfile = {
    name: "Admin",
    email: "",
    countryCode: "+1",
    phoneNumber: "",
    role: "Admin",
  },
  onSaveProfile,
}) => {
  const [profile, setProfile] = useState<UserProfileData>(initialProfile);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [savedSuccessMsg, setSavedSuccessMsg] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const previewUrl = URL.createObjectURL(file);
      setAvatarPreview(previewUrl);
      setAvatarFile(file);
      setProfile((prev) => ({ ...prev, avatarUrl: previewUrl }));
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError("");

    if (!profile.name.trim()) {
      setSaveError("Name is required.");
      return;
    }

    setIsSaving(true);

    try {
      await onSaveProfile?.(
        {
          ...profile,
          name: profile.name.trim(),
          phoneNumber: profile.phoneNumber.trim(),
        },
        avatarFile
      );
      setAvatarFile(null);
      setSavedSuccessMsg(true);

      window.setTimeout(() => {
        setSavedSuccessMsg(false);
      }, 4000);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Profile update failed.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="w-full min-w-0 flex flex-col gap-6 font-inter">
      {/* Hidden File Input for Avatar */}
      <input
        id="personal-info-avatar-input"
        type="file"
        onChange={handleAvatarChange}
        accept="image/*"
        className="hidden"
      />

      {/* Top Header Row */}
      <div className="w-full min-w-0 flex flex-wrap items-center justify-between gap-4">
        <button
          type="button"
          onClick={onBack}
          className="flex min-w-0 items-center gap-3 text-[20px] sm:text-[24px] font-medium text-[#1F1D1D] hover:text-[#3E3EDF] transition-colors cursor-pointer"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          <span className="truncate">Personal Information</span>
        </button>

        <button
          type="submit"
          form="personal-info-form"
          disabled={isSaving}
          className="h-[44px] shrink-0 px-6 bg-[#3E3EDF] hover:bg-[#3232C7] disabled:opacity-60 text-white font-medium rounded-[8px] shadow-md transition-colors cursor-pointer"
        >
          {isSaving ? "Saving..." : "Save Changes"}
        </button>
      </div>

      {/* Success Notification Banner */}
      {savedSuccessMsg && (
        <div className="w-full bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-[8px] font-medium text-[14px] flex items-center justify-between shadow-xs transition-opacity">
          <div className="flex items-center gap-2">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>Profile information updated successfully!</span>
          </div>
          <button
            type="button"
            onClick={() => setSavedSuccessMsg(false)}
            className="text-emerald-600 hover:text-emerald-900 cursor-pointer"
          >
            &times;
          </button>
        </div>
      )}

      {saveError && (
        <div className="w-full rounded-[8px] border border-red-100 bg-red-50 px-4 py-3 text-[14px] font-medium text-red-600">
          {saveError}
        </div>
      )}

      {/* Main 2-Column Content */}
      <form
        id="personal-info-form"
        onSubmit={handleSave}
        className="w-full min-w-0 flex flex-col md:flex-row gap-8 items-start pt-2"
      >
        {/* Left Profile Card */}
        <div className="w-full md:w-[280px] bg-[#FEFEFE] border border-[#3E3EDF] rounded-[16px] p-8 flex flex-col items-center justify-center gap-4 shrink-0 shadow-xs">
          {/* Avatar Container */}
          <label
            htmlFor="personal-info-avatar-input"
            className="relative w-28 h-28 rounded-full border-2 border-[#3E3EDF] overflow-hidden bg-gradient-to-br from-amber-500 to-red-600 flex items-center justify-center text-white text-3xl font-bold cursor-pointer group shadow-inner"
            title="Change profile photo"
          >
            {avatarPreview || profile.avatarUrl ? (
              <Image
                src={avatarPreview || profile.avatarUrl || ""}
                alt="Profile Avatar"
                fill
                className="object-cover"
                unoptimized
              />
            ) : (
              <span className="select-none">
                {profile.name.slice(0, 1).toUpperCase()}
              </span>
            )}

            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#FEFEFE"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </div>
          </label>

          <div className="flex flex-col items-center">
            <span className="text-[#575757] text-[14px]">Profile</span>
            <span className="text-[#1F1D1D] text-[18px] font-semibold">
              {profile.role}
            </span>
          </div>
        </div>

        {/* Right Form Inputs */}
        <div className="flex-1 min-w-0 w-full flex flex-col gap-6">
          {/* Name Field */}
          <div className="flex flex-col gap-2">
            <label className="text-[14px] font-medium text-[#575757]">
              Name
            </label>
            <div className="w-full h-[56px] px-4 bg-[#FEFEFE] border border-[#3E3EDF] rounded-[8px] flex items-center focus-within:border-[#3E3EDF]">
              <input
                type="text"
                value={profile.name}
                onChange={(e) =>
                  setProfile({ ...profile, name: e.target.value })
                }
                className="w-full bg-transparent outline-none text-[16px] text-[#1F1D1D]"
              />
            </div>
          </div>

          {/* Email Field */}
          <div className="flex flex-col gap-2">
            <label className="text-[14px] font-medium text-[#575757]">
              Email
            </label>
            <div className="w-full h-[56px] px-4 bg-[#FEFEFE] border border-[#3E3EDF] rounded-[8px] flex items-center focus-within:border-[#3E3EDF]">
              <input
                type="email"
                disabled
                value={profile.email}
                readOnly
                className="w-full bg-transparent outline-none text-[16px] text-[#1F1D1D] disabled:opacity-70"
              />
            </div>
          </div>

          {/* Phone Number Field */}
          <div className="flex flex-col gap-2">
            <label className="text-[14px] font-medium text-[#575757]">
              Phone Number
            </label>
            <div className="w-full min-w-0 flex flex-col gap-3 sm:flex-row sm:items-center">
              {/* Graphic SVG Flag + Country Code Box */}
              <div className="relative h-[56px] w-full px-3 bg-[#3E3EDF] text-white rounded-[8px] flex items-center justify-between gap-2 shrink-0 font-medium text-[15px] shadow-xs sm:w-[238px]">
                {renderFlagIcon(profile.countryCode)}

                <select
                  value={profile.countryCode}
                  onChange={(e) =>
                    setProfile({ ...profile, countryCode: e.target.value })
                  }
                  className="appearance-none bg-transparent outline-none text-white cursor-pointer font-medium pr-5 w-full z-10"
                >
                  {countryCodes.map((c) => (
                    <option
                      key={c.code}
                      value={c.code}
                      className="text-gray-900 bg-white py-2"
                    >
                      {c.code} ({c.country})
                    </option>
                  ))}
                </select>

                <svg
                  className="w-4 h-4 text-white pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </div>

              {/* Number Input */}
              <div className="flex-1 min-w-0 h-[56px] px-4 bg-[#FEFEFE] border border-[#3E3EDF] rounded-[8px] flex items-center focus-within:border-[#3E3EDF]">
                <input
                  type="text"
                  value={profile.phoneNumber}
                  onChange={(e) =>
                    setProfile({ ...profile, phoneNumber: e.target.value })
                  }
                  className="w-full bg-transparent outline-none text-[16px] text-[#1F1D1D]"
                />
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
