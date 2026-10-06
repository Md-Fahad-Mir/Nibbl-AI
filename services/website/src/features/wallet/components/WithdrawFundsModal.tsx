"use client";

interface WithdrawFundsModalProps {
  onClose: () => void;
  onConfirm: () => void;
  amount: number;
}

export default function WithdrawFundsModal({ onClose, onConfirm, amount }: WithdrawFundsModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in select-none">
      {/* Frame 2147229110 */}
      <div className="w-full max-w-[613px] bg-white rounded-[16px] p-6 sm:p-[61px] flex flex-col items-center border border-gray-100 shadow-[1px_8px_25.2px_rgba(0,0,0,0.25)] animate-scale-up">
        
        {/* Modal Inner wrapper (Frame 2147229109) */}
        <div className="w-full flex flex-col items-center gap-[47px]">
          
          {/* Text block (Frame 2147229107) */}
          <div className="w-full flex flex-col justify-center items-center gap-[26px] text-center">
            <h2 className="text-[24px] font-medium leading-[29px] text-[#1F1D1D] w-full">
              Withdraw Funds
            </h2>
            <span className="text-[24px] font-medium leading-[29px] text-[#1F1D1D] w-full block">
              Withdraw ${amount.toFixed(2)} to your payout method:
            </span>
          </div>

          {/* Actions & Payout Info block */}
          <div className="w-full flex flex-col items-center gap-[20px]">
            {/* Withdraw CTA (Frame 2147229104) */}
            <button
              onClick={onConfirm}
              className="w-full max-w-[279px] h-[39px] bg-gradient-to-r from-[#3E3EDF] to-[#3E3EDF] hover:opacity-90 active:scale-[0.98] transition-all text-white text-[16px] font-normal leading-[19px] rounded-[12px] flex items-center justify-center cursor-pointer focus:outline-none"
            >
              Withdraw
            </button>

            {/* Note Text */}
            <p className="text-[12px] font-medium leading-[15px] text-[#1F1D1D] text-center w-full">
              Payouts typically land in 24–48 hours.
            </p>

            {/* Cancel Button (Frame 2147229108) */}
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
