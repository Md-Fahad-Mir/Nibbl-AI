"use client";

import { useState } from "react";

interface PayoutMethodOption {
  id: string;
  label: string;
}

interface WithdrawFundsModalProps {
  onClose: () => void;
  onConfirm: (methodId: string) => void;
  onAddNew: () => void;
  amount: number;
  methods: PayoutMethodOption[];
}

export default function WithdrawFundsModal({
  onClose,
  onConfirm,
  onAddNew,
  amount,
  methods,
}: WithdrawFundsModalProps) {
  const [selectedId, setSelectedId] = useState(methods[0]?.id ?? "");
  const hasMethods = methods.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in select-none">
      <div className="w-full max-w-[613px] bg-white rounded-[16px] p-6 sm:p-[61px] flex flex-col items-center border border-gray-100 shadow-[1px_8px_25.2px_rgba(0,0,0,0.25)] animate-scale-up">
        <div className="w-full flex flex-col items-center gap-[36px]">
          <div className="w-full flex flex-col justify-center items-center gap-[20px] text-center">
            <h2 className="text-[24px] font-medium leading-[29px] text-[#1F1D1D] w-full">
              Withdraw Funds
            </h2>
            <span className="text-[18px] font-medium leading-[24px] text-[#1F1D1D] w-full block">
              Withdraw ${amount.toFixed(2)} to your payout account:
            </span>
          </div>

          <div className="w-full flex flex-col items-center gap-[18px]">
            {hasMethods ? (
              <>
                <select
                  value={selectedId}
                  onChange={(event) => setSelectedId(event.target.value)}
                  className="w-full max-w-[360px] h-[44px] px-3 rounded-[12px] border border-[#D5D5E5] text-[15px] text-[#1F1D1D] outline-none focus:border-[#3E3EDF]"
                >
                  {methods.map((method) => (
                    <option key={method.id} value={method.id}>
                      {method.label}
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => selectedId && onConfirm(selectedId)}
                  disabled={!selectedId}
                  className="w-full max-w-[279px] h-[39px] bg-[#3E3EDF] hover:opacity-90 active:scale-[0.98] transition-all text-white text-[16px] rounded-[12px] flex items-center justify-center cursor-pointer disabled:opacity-50 focus:outline-none"
                >
                  Withdraw
                </button>

                <button
                  onClick={onAddNew}
                  className="text-[13px] font-medium text-[#3E3EDF] hover:underline cursor-pointer"
                >
                  + Add a new payout account
                </button>
              </>
            ) : (
              <>
                <p className="text-[14px] text-[#6B6B80] text-center max-w-[360px]">
                  You don&apos;t have a payout account yet. Add one to withdraw.
                </p>
                <button
                  onClick={onAddNew}
                  className="w-full max-w-[279px] h-[39px] bg-[#3E3EDF] hover:opacity-90 active:scale-[0.98] transition-all text-white text-[16px] rounded-[12px] flex items-center justify-center cursor-pointer focus:outline-none"
                >
                  Add payout account
                </button>
              </>
            )}

            <p className="text-[12px] font-medium leading-[15px] text-[#1F1D1D] text-center w-full">
              Payouts typically land in 24–48 hours.
            </p>

            <button
              onClick={onClose}
              className="w-[60px] h-[35px] border border-black rounded-[6px] hover:bg-gray-50 active:scale-[0.98] transition-all text-black text-[12px] font-medium leading-[15px] flex items-center justify-center cursor-pointer focus:outline-none"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
