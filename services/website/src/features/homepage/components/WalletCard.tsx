"use client";

import Image from "next/image";

interface WalletCardProps {
  balance?: number;
  onViewWallet?: () => void;
}

export default function WalletCard({ balance = 51.25, onViewWallet }: WalletCardProps) {
  return (
    <div className="w-full max-w-[1137px] mx-auto min-h-[300px] lg:h-[300px] bg-[#7676FF] shadow-[1px_8px_25.2px_rgba(0,0,0,0.25)] rounded-[14px] p-6 lg:py-[37px] lg:px-[50px] flex flex-col justify-center items-center gap-[10px] text-white relative overflow-hidden font-sans select-none">
      {/* Background blobs for premium feel */}
      <div className="absolute -right-10 -top-10 w-44 h-44 bg-white/10 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute -left-10 -bottom-10 w-44 h-44 bg-black/10 rounded-full blur-2xl pointer-events-none" />

      {/* Frame 2147229131: Main layout wrapper */}
      <div className="w-full max-w-[1060px] flex flex-col items-center gap-[47px]">
        {/* Frame 2147229129: Wallet Details stacked vertically */}
        <div className="flex flex-col items-center gap-[19px]">
          
          {/* Wallet Label Row (Frame 2147229084) */}
          <div className="flex items-center gap-[12px] h-[39px] justify-center">
            <Image
              src="/homepage/wallet.svg"
              alt="Wallet Icon"
              width={38}
              height={38}
              className="w-[38px] h-[38px] object-contain brightness-0 invert"
            />
            <span className="text-[32px] font-semibold leading-[39px] text-[#FEFEFE] tracking-tight">
              Wallet
            </span>
          </div>

          {/* Balance Amount Row (Frame 2147229085) */}
          <div className="flex items-center gap-[12px] h-[39px] justify-center">
            <Image
              src="/homepage/money (2).svg"
              alt="Money Icon"
              width={38}
              height={38}
              className="w-[38px] h-[38px] object-contain brightness-0 invert"
            />
            <span className="text-[32px] font-bold leading-[39px] text-[#FEFEFE] tracking-tight">
              {balance.toFixed(2)}
            </span>
          </div>

        </div>

        {/* View Wallet Button Wrapper (Frame 2147229130 / Frame 2147229086) */}
        <div className="w-full flex justify-center">
          <button
            onClick={onViewWallet}
            className="w-full max-w-[520px] h-[49px] bg-[#FEFEFE] hover:bg-gray-50 active:scale-[0.98] text-[#3E3EDF] font-medium text-[24px] leading-[29px] rounded-[12px] flex items-center justify-center transition-all cursor-pointer shadow-sm focus:outline-none"
          >
            View Wallet
          </button>
        </div>
      </div>
    </div>
  );
}
