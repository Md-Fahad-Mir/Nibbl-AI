"use client";

import React from "react";
import { TransactionDetail } from "@/types/earnings.types";

interface TransactionDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction?: TransactionDetail | null;
}

export const TransactionDetailsModal: React.FC<
  TransactionDetailsModalProps
> = ({ isOpen, onClose, transaction }) => {
  if (!isOpen || !transaction) return null;

  const data: TransactionDetail = transaction;

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    const file = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = `transaction-${data.transactionId}.json`;
    link.click();
    URL.revokeObjectURL(url);
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
        <h2 className="w-full text-center font-inter text-[18px] font-medium leading-[22px] text-[#1F1D1D] pt-2 pb-4">
          Transaction Details
        </h2>

        {/* Details Rows */}
        <div className="w-full flex flex-col font-inter text-[14px]">
          {/* Row 1: Transaction ID */}
          <div className="flex items-center justify-between py-3 border-b border-[#3E3EDF]">
            <span className="font-medium text-[#1F1D1D]">Transaction ID :</span>
            <span className="font-medium text-[#1F1D1D]">
              {data.transactionId.startsWith("#")
                ? data.transactionId
                : `#${data.transactionId}`}
            </span>
          </div>

          {/* Row 2: Date */}
          <div className="flex items-center justify-between py-3 border-b border-[#3E3EDF]">
            <span className="font-medium text-[#1F1D1D]">Date :</span>
            <span className="font-medium text-[#1F1D1D]">{data.date}</span>
          </div>

          {/* Row 3: User name */}
          <div className="flex items-center justify-between py-3 border-b border-[#3E3EDF]">
            <span className="font-medium text-[#1F1D1D]">User name :</span>
            <span className="font-normal text-[#1F1D1D]">{data.userName}</span>
          </div>

          {/* Row 4: A/C number */}
          <div className="flex items-center justify-between py-3 border-b border-[#3E3EDF]">
            <span className="font-medium text-[#1F1D1D]">A/C number :</span>
            <span className="font-medium text-[#1F1D1D]">
              {data.accountNumber || "Not returned"}
            </span>
          </div>

          {/* Row 5: A/C holder name */}
          <div className="flex items-center justify-between py-3 border-b border-[#3E3EDF]">
            <span className="font-medium text-[#1F1D1D]">A/C holder name :</span>
            <span className="font-normal text-[#1F1D1D]">
              {data.accountHolderName || data.userName || "Not returned"}
            </span>
          </div>

          {/* Row 6: Transaction amount */}
          <div className="flex items-center justify-between py-3 border-b border-[#3E3EDF]">
            <span className="font-medium text-[#1F1D1D]">Transaction amount :</span>
            <span className="font-medium text-[#1F1D1D]">{data.amount}</span>
          </div>

          {/* Row 7: Provider name */}
          <div className="flex items-center justify-between py-3 border-b border-[#3E3EDF]">
            <span className="font-medium text-[#1F1D1D]">Provider name :</span>
            <span className="font-medium text-[#1F1D1D]">
              {data.providerName || "Not returned"}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between gap-4 pt-6 pb-2">
          {/* Download Button */}
          <button
            type="button"
            onClick={handleDownload}
            className="flex-1 h-[44px] bg-[#FEFEFE] border border-[#3E3EDF] hover:bg-[#3E3EDF]/5 text-[#3E3EDF] font-inter text-[16px] font-medium rounded-[16px] transition-colors cursor-pointer flex items-center justify-center"
          >
            Download
          </button>

          {/* Print Button */}
          <button
            type="button"
            onClick={handlePrint}
            className="flex-1 h-[44px] bg-[#3E3EDF] hover:bg-[#3232C7] text-[#FEFEFE] font-inter text-[16px] font-medium rounded-[16px] transition-colors cursor-pointer flex items-center justify-center shadow-md"
          >
            Print
          </button>
        </div>
      </div>
    </div>
  );
};
