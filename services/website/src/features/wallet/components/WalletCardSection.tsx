"use client";

import Image from "next/image";

interface WalletCardSectionProps {
  balance: number;
  onWithdrawClick: () => void;
  withdrawDisabled?: boolean;
  onHistoryClick?: () => void;
}

export default function WalletCardSection({
  balance,
  onWithdrawClick,
  withdrawDisabled = false,
  onHistoryClick,
}: WalletCardSectionProps) {
  return (
    <div className="w-full max-w-[1165px] bg-[#7676FF] shadow-[1px_8px_25.2px_rgba(0,0,0,0.25)] rounded-[14px] px-6 py-8 sm:py-[37px] sm:px-[50px] flex flex-col justify-center items-start text-white border border-indigo-400/30">
      <div className="w-full flex flex-col gap-8 md:gap-[47px]">
        
        {/* Top Info row (Frame 2147229129) */}
        <div className="flex flex-col sm:flex-row gap-6 sm:gap-[60px] md:gap-[120px]">
          {/* Wallet Label Block (Frame 2147229084) */}
          <div className="flex items-center gap-[12px] h-[39px]">
            <div className="w-[38px] h-[38px] relative flex items-center justify-center">
              <Image
                src="/homepage/wallet.svg"
                alt="Wallet Icon"
                width={38}
                height={38}
                className="w-[38px] h-[38px] object-contain brightness-0 invert"
              />
            </div>
            <span className="text-[32px] font-semibold leading-[39px] text-[#FEFEFE]">
              Wallet
            </span>
          </div>

          {/* Balance Block (Frame 2147229085) */}
          <div className="flex items-center gap-[12px] h-[39px]">
            <div className="w-[38px] h-[38px] relative flex items-center justify-center">
              <Image
                src="/homepage/money (2).svg"
                alt="Money Icon"
                width={38}
                height={38}
                className="w-[38px] h-[38px] object-contain brightness-0 invert"
              />
            </div>
            <span className="text-[32px] font-bold leading-[39px] text-[#FEFEFE]">
              {balance.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Buttons Row (Frame 2147229130) */}
        <div className="w-full flex flex-col sm:flex-row gap-4 sm:gap-[20px]">
          {/* Withdraw (Frame 2147229086) */}
          <button
            onClick={onWithdrawClick}
            disabled={withdrawDisabled}
            className="flex-1 max-w-full sm:max-w-[520px] h-[49px] bg-[#FEFEFE] hover:bg-gray-50 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 text-[#1F1D1D] rounded-[12px] flex items-center justify-center gap-2.5 transition-all cursor-pointer focus:outline-none shadow-sm"
          >
            <div className="w-6 h-6 relative flex items-center justify-center">
              <Image
                src="/homepage/wallet.svg"
                alt="Wallet Icon"
                width={20}
                height={20}
                className="w-5 h-5 object-contain"
              />
            </div>
            <span className="text-[24px] font-medium leading-[29px]">
              Withdraw
            </span>
          </button>

          {/* Wallet History (Frame 2147229104) */}
          <button
            onClick={onHistoryClick}
            className="flex-1 max-w-full sm:max-w-[520px] h-[49px] bg-transparent border border-[#FEFEFE] hover:bg-white/10 active:scale-[0.99] text-[#FEFEFE] rounded-[12px] flex items-center justify-center gap-2.5 transition-all cursor-pointer focus:outline-none"
          >
            <div className="w-6 h-6 relative flex items-center justify-center">
              <Image
                src="/homepage/wallet.svg"
                alt="Wallet Icon"
                width={20}
                height={20}
                className="w-5 h-5 object-contain brightness-0 invert"
              />
            </div>
            <span className="text-[24px] font-normal leading-[29px]">
              Wallet History
            </span>
          </button>
        </div>

      </div>
    </div>
  );
}
