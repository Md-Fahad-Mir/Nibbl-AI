"use client";

import { useState } from "react";

interface BankDetailsModalProps {
  onClose: () => void;
  onSubmit: (details: {
    provider: "paypal" | "venmo";
    handle: string;
  }) => void;
}

export default function BankDetailsModal({ onClose, onSubmit }: BankDetailsModalProps) {
  const [provider, setProvider] = useState<"paypal" | "venmo">("paypal");
  const [handle, setHandle] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!handle.trim()) return;
    onSubmit({
      provider,
      handle: handle.trim(),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto select-none">
      {/* Frame 2147229125 */}
      <div className="w-full max-w-[608px] my-8 bg-[#FEFEFE] border border-[#E0E0E0] shadow-[0px_4px_4px_rgba(0,0,0,0.08)] rounded-[12px] p-6 sm:p-8 relative flex flex-col gap-6 animate-scale-up">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          type="button"
          className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 text-xl font-bold cursor-pointer focus:outline-none"
        >
          &times;
        </button>

        {/* Header Title */}
        <h2 className="text-[24px] font-semibold leading-[29px] text-[#1F1D1D] w-full border-b border-gray-100 pb-2">
          Enter Payout Details
        </h2>

        {/* Form Details Grid */}
        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
          <div className="w-full flex flex-col gap-2">
            <label className="text-[16px] font-medium leading-[24px] text-[#1F1D1D]">
              Provider
            </label>
            <div className="grid grid-cols-2 gap-3">
              {(["paypal", "venmo"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setProvider(option)}
                  className={`h-[50px] rounded-[8px] border text-[15px] font-medium capitalize transition-colors ${
                    provider === option
                      ? "border-[#3E3EDF] bg-[#3E3EDF] text-white"
                      : "border-[#959595] bg-[#FEFEFE] text-[#1F1D1D] hover:border-[#3E3EDF]"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div className="w-full flex flex-col gap-2">
            <label className="text-[16px] font-medium leading-[24px] text-[#1F1D1D]">
              Payout Handle
            </label>
            <div className="w-full h-[50px] bg-[#FEFEFE] border border-[#959595] rounded-[8px] flex items-center px-4">
              <input
                type="text"
                placeholder={provider === "paypal" ? "paypal@example.com" : "@venmo"}
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                required
                className="w-full bg-transparent border-none text-[#1F1D1D] placeholder-[#737373] text-[14px] font-normal leading-[17px] focus:outline-none"
              />
            </div>
          </div>

          {/* Submit CTA Large */}
          <button
            type="submit"
            className="w-full h-[54px] bg-gradient-to-r from-[#3E3EDF] to-[#3E3EDF] hover:bg-[#3232c7] active:scale-[0.99] transition-all text-white text-[18px] font-medium rounded-[8px] flex items-center justify-center cursor-pointer focus:outline-none shadow-[0px_4px_4px_rgba(0,0,0,0.12),_inset_0px_4px_4px_rgba(255,255,255,0.12)] mt-4"
          >
            Submit Withdraw Request
          </button>

        </form>
      </div>
    </div>
  );
}
