"use client";

import React from "react";
import { WithdrawRequestDetail } from "@/types/withdraw-request.types";

interface WithdrawDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  request?: WithdrawRequestDetail | null;
  onApprove?: (id: string) => void;
  onCancelRequest?: (id: string) => void;
}

export const WithdrawDetailsModal: React.FC<WithdrawDetailsModalProps> = ({
  isOpen,
  onClose,
  request,
  onApprove,
  onCancelRequest,
}) => {
  if (!isOpen || !request) return null;

  const data: WithdrawRequestDetail = request;

  const handleApproveClick = () => {
    if (onApprove) onApprove(data.id);
    onClose();
  };

  const handleCancelClick = () => {
    if (onCancelRequest) onCancelRequest(data.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      {/* Modal Container */}
      <div className="relative w-full max-w-[444px] min-h-[550px] bg-[#FEFEFE] border border-[#3E3EDF] rounded-[16px] shadow-2xl overflow-hidden flex flex-col justify-between p-6">
        {/* Top-Right Red Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-0 right-0 w-11 h-11 bg-[#FF5C5C] hover:bg-[#E04B4B] rounded-bl-[20px] rounded-tr-[16px] flex items-center justify-center text-white cursor-pointer transition-colors z-10"
          aria-label="Close modal"
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
        <h2 className="w-full text-center font-inter text-[16px] font-medium leading-[24px] text-[#1F1D1D] pt-2 pb-4">
          Withdraw Request Details
        </h2>

        {/* Details Rows */}
        <div className="w-full flex flex-col font-inter text-[14px]">
          {/* Row 1: Provider Name */}
          <div className="flex items-center justify-between py-3 border-b border-[#3E3EDF]">
            <span className="font-medium text-[#1F1D1D]">Provider Name</span>
            <span className="font-medium text-[#1F1D1D]">
              {data.providerName || data.userName}
            </span>
          </div>

          {/* Row 2: Bank Name */}
          <div className="flex items-center justify-between py-3 border-b border-[#3E3EDF]">
            <span className="font-medium text-[#1F1D1D]">Bank Name</span>
            <span className="font-medium text-[#1F1D1D]">{data.bankName}</span>
          </div>

          {/* Row 3: A/C Branch */}
          <div className="flex items-center justify-between py-3 border-b border-[#3E3EDF]">
            <span className="font-medium text-[#1F1D1D]">A/C Branch</span>
            <span className="font-medium text-[#1F1D1D]">
              {data.branchName || "Not returned"}
            </span>
          </div>

          {/* Row 4: A/C Number */}
          <div className="flex items-center justify-between py-3 border-b border-[#3E3EDF]">
            <span className="font-medium text-[#1F1D1D]">A/C Number</span>
            <span className="font-medium text-[#1F1D1D]">
              {data.accountNumber}
            </span>
          </div>

          {/* Row 5: Routing Number */}
          <div className="flex items-center justify-between py-3 border-b border-[#3E3EDF]">
            <span className="font-medium text-[#1F1D1D]">Routing Number</span>
            <span className="font-medium text-[#1F1D1D]">
              {data.routingNumber || "Not returned"}
            </span>
          </div>

          {/* Row 6: A/C type */}
          <div className="flex items-center justify-between py-3 border-b border-[#3E3EDF]">
            <span className="font-medium text-[#1F1D1D]">A/C type</span>
            <span className="font-medium text-[#1F1D1D]">{data.accountType}</span>
          </div>

          {/* Row 7: Withdraw Amount */}
          <div className="flex items-center justify-between py-3 border-b border-[#3E3EDF]">
            <span className="font-medium text-[#1F1D1D]">Withdraw Amount</span>
            <span className="font-medium text-[#1F1D1D]">
              {data.withdrawAmount}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between gap-4 pt-6 pb-2">
          {/* Cancel Button */}
          <button
            type="button"
            onClick={handleCancelClick}
            className="flex-1 h-[44px] bg-[#FEFEFE] border border-[#3E3EDF] hover:bg-[#3E3EDF]/5 text-[#3E3EDF] font-inter text-[18px] font-medium rounded-[8px] transition-colors cursor-pointer flex items-center justify-center"
          >
            Cancel
          </button>

          {/* Approve Button */}
          <button
            type="button"
            onClick={handleApproveClick}
            className="flex-1 h-[44px] bg-[#3E3EDF] hover:bg-[#3232C7] text-[#FEFEFE] font-inter text-[18px] font-medium rounded-[8px] transition-colors cursor-pointer flex items-center justify-center shadow-md"
          >
            Approve
          </button>
        </div>
      </div>
    </div>
  );
};
