"use client";

import React, { useState } from "react";
import { UserDetail } from "@/types/users.types";
import { useAdminApiStore } from "@/stores/useAdminApiStore";

interface UserDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user?: UserDetail | null;
}

export const UserDetailsModal: React.FC<UserDetailsModalProps> = ({
  isOpen,
  onClose,
  user,
}) => {
  const resetUserPhone = useAdminApiStore((state) => state.resetUserPhone);
  const [phoneMessage, setPhoneMessage] = useState("");
  const [resetting, setResetting] = useState(false);

  if (!isOpen || !user) return null;

  const handleResetPhone = async () => {
    const reason = window.prompt(
      "Reset this shopper's phone number? They'll need to verify a new one, and withdrawals pause for 48 hours after they do. Reason (required):"
    );
    if (!reason || !reason.trim()) return;
    setResetting(true);
    setPhoneMessage("");
    try {
      await resetUserPhone(user.id, reason.trim());
      setPhoneMessage("Phone number reset.");
    } catch (err) {
      setPhoneMessage(err instanceof Error ? err.message : "Could not reset the phone number.");
    } finally {
      setResetting(false);
    }
  };

  const data: UserDetail = user;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      {/* Modal Container */}
      <div className="relative w-full max-w-[444px] min-h-[480px] bg-[#FEFEFE] border border-[#3E3EDF] rounded-[16px] shadow-2xl overflow-hidden flex flex-col justify-between p-6">
        {/* Top-Right Red Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-0 right-0 w-11 h-11 bg-[#FF5C5C] hover:bg-[#E04B4B] rounded-bl-[20px] rounded-tr-[16px] flex items-center justify-center text-white cursor-pointer transition-colors z-10"
          aria-label="Close user details modal"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#FEFEFE"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Modal Title */}
        <h2 className="w-full text-center font-inter text-[16px] font-medium leading-[24px] text-[#171717] pt-2 pb-4">
          User Details
        </h2>

        {/* Details Rows */}
        <div className="w-full flex flex-col font-inter text-[14px]">
          {/* Row 1: User name */}
          <div className="flex items-center justify-between py-3.5 border-b border-[#3E3EDF]">
            <span className="font-medium text-[#1F1D1D]">User name :</span>
            <span className="font-medium text-[#1F1D1D]">{data.userName}</span>
          </div>

          {/* Row 2: Email */}
          <div className="flex items-center justify-between py-3.5 border-b border-[#3E3EDF]">
            <span className="font-medium text-[#1F1D1D]">Email :</span>
            <span className="font-poppins text-[#171717]">{data.email}</span>
          </div>

          {/* Row 3: Phone Number */}
          <div className="flex items-center justify-between py-3.5 border-b border-[#3E3EDF]">
            <span className="font-medium text-[#1F1D1D]">Phone Number :</span>
            <span className="flex items-center gap-3 font-medium text-[#1F1D1D]">
              {data.phoneNumber || "—"}
              {data.phoneNumber && (
                <button
                  type="button"
                  onClick={() => void handleResetPhone()}
                  disabled={resetting}
                  className="text-xs font-semibold text-[#FF5C5C] hover:underline cursor-pointer disabled:opacity-50"
                >
                  {resetting ? "Resetting…" : "Reset"}
                </button>
              )}
            </span>
          </div>
          {phoneMessage && (
            <p className="text-xs font-medium text-[#3E3EDF] pt-2">{phoneMessage}</p>
          )}

          {/* Row 4: Address */}
          <div className="flex items-center justify-between py-3.5 border-b border-[#3E3EDF]">
            <span className="font-medium text-[#1F1D1D]">Address :</span>
            <span className="font-poppins text-[#171717]">
              {data.address || "Not returned"}
            </span>
          </div>

          {/* Row 5: Joining Date */}
          <div className="flex items-center justify-between py-3.5 border-b border-[#3E3EDF]">
            <span className="font-medium text-[#1F1D1D]">Joining Date :</span>
            <span className="font-medium text-[#1F1D1D]">
              {data.joiningDate}
            </span>
          </div>
        </div>

        {/* Bottom Spacing */}
        <div className="pt-4" />
      </div>
    </div>
  );
};
