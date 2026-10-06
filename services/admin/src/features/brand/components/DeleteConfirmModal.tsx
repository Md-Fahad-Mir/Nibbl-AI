"use client";

import React from "react";

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      {/* Modal Container */}
      <div className="w-full max-w-[260px] bg-[#FEFEFE] rounded-[14px] p-5 shadow-2xl flex flex-col items-center gap-4 text-center">
        {/* Red Circle Warning Icon */}
        <div className="w-9 h-9 rounded-full bg-[#EF4639] flex items-center justify-center text-white shrink-0 shadow-xs">
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
        </div>

        {/* Message */}
        <p className="font-inter text-[13px] font-normal leading-[16px] text-[#575757]">
          Are You Sure Delete this Campaign ?
        </p>

        {/* Buttons Cluster */}
        <div className="w-full flex items-center justify-between gap-3 pt-1">
          {/* No Button */}
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-[33px] border border-[#FF6B6E] text-[#FF6B6E] hover:bg-[#FF6B6E]/10 rounded-[30px] font-inter text-[14px] font-medium transition-colors cursor-pointer flex items-center justify-center"
          >
            No
          </button>

          {/* Yes Button */}
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 h-[33px] bg-[#FF6B6E] hover:bg-[#E05558] text-[#FEFEFE] rounded-[30px] font-inter text-[14px] font-medium transition-colors cursor-pointer flex items-center justify-center shadow-xs"
          >
            Yes
          </button>
        </div>
      </div>
    </div>
  );
};
