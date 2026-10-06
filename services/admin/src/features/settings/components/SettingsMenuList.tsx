"use client";

import React from "react";
import { SettingsSubTab } from "@/types/settings.types";

interface SettingsMenuListProps {
  onSelectTab: (tab: SettingsSubTab) => void;
}

export const SettingsMenuList: React.FC<SettingsMenuListProps> = ({
  onSelectTab,
}) => {
  const accountItems: { id: SettingsSubTab; label: string }[] = [
    { id: "personal-info", label: "Personal Information" },
    { id: "change-password", label: "Change Password" },
  ];

  const legalItems: { id: SettingsSubTab; label: string }[] = [
    { id: "faq", label: "FAQ" },
    { id: "privacy-policy", label: "Privacy Policy" },
    { id: "terms-conditions", label: "Terms & Conditions" },
  ];

  return (
    <div className="flex w-full flex-col gap-6 font-inter">
      <SettingsGroup title="Account">
        {accountItems.map((item) => (
          <SettingsMenuButton
            key={item.id}
            item={item}
            onSelectTab={onSelectTab}
          />
        ))}
      </SettingsGroup>

      <SettingsGroup title="Legal Content">
        {legalItems.map((item) => (
          <SettingsMenuButton
            key={item.id}
            item={item}
            onSelectTab={onSelectTab}
          />
        ))}
      </SettingsGroup>
    </div>
  );
};

function SettingsGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="w-full rounded-[12px] border border-gray-100 bg-[#FEFEFE] p-6 shadow-[0px_2px_8px_rgba(0,0,0,0.1)]">
      <h2 className="px-2 pb-3 text-[15px] font-semibold uppercase tracking-wide text-[#575757]">
        {title}
      </h2>
      <div className="flex flex-col divide-y divide-gray-100">{children}</div>
    </section>
  );
}

function SettingsMenuButton({
  item,
  onSelectTab,
}: {
  item: { id: SettingsSubTab; label: string };
  onSelectTab: (tab: SettingsSubTab) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelectTab(item.id)}
      className="group flex w-full cursor-pointer items-center justify-between px-2 py-5 font-inter text-[16px] font-medium text-[#1F1D1D] transition-colors hover:text-[#3E3EDF]"
    >
      <span>{item.label}</span>
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-gray-400 transition-all group-hover:translate-x-1 group-hover:text-[#3E3EDF]"
      >
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </button>
  );
}
