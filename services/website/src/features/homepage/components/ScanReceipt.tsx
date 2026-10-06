"use client";

import Image from "next/image";

interface ScanReceiptProps {
  onActionClick?: () => void;
}

export default function ScanReceipt({ onActionClick }: ScanReceiptProps) {
  return (
    <div className="w-full max-w-[335px] mx-auto font-sans flex flex-col items-center gap-[18px]">
      {/* Title */}
      <h2 className="text-[20px] font-medium leading-[24px] text-[#1F1D1D] text-center w-full">
        Recent Offer
      </h2>

      {/* Action Cards Row (Frame 2147228985) */}
      <div className="w-full max-w-[335px] h-[136px] flex items-start gap-[16px]">
        {/* Card 1: Scan QR (Frame 2147228982) */}
        <button
          onClick={onActionClick}
          className="w-1/2 h-[136px] bg-[#FEFEFE] border border-[#EBEBEB] hover:border-[#49B46F] shadow-[0px_4px_4px_rgba(42,42,42,0.04)] rounded-[12px] p-4 flex flex-col items-center justify-center text-center gap-[8px] transition-all duration-300 hover:shadow-md active:scale-[0.98] cursor-pointer focus:outline-none min-w-0"
        >
          {/* Icon (bi:qr-code-scan) */}
          <div className="w-[44px] h-[44px] bg-[#DCFCE7] rounded-[40px] flex items-center justify-center p-2.5 flex-shrink-0">
            <Image
              src="/homepage/scanQrIcon.svg"
              alt="Scan QR Icon"
              width={24}
              height={24}
              className="w-6 h-6 object-contain"
            />
          </div>
          
          {/* Text wrapper (Frame 2147228978) */}
          <div className="w-full flex flex-col gap-[1px] items-center min-w-0">
            <span className="text-[14px] font-medium leading-[17px] text-[#1F1D1D] text-center w-full truncate">
              Scan QR
            </span>
            <span className="text-[11px] font-normal leading-[13px] text-[#959595] text-center w-full truncate">
              Earn rewards instantly
            </span>
          </div>
        </button>

        {/* Card 2: Upload Receipt */}
        <button
          onClick={onActionClick}
          className="w-1/2 h-[136px] bg-[#FEFEFE] border border-[#EBEBEB] hover:border-[#A450FF] shadow-[0px_4px_4px_rgba(42,42,42,0.04)] rounded-[12px] p-4 flex flex-col items-center justify-center text-center gap-[8px] transition-all duration-300 hover:shadow-md active:scale-[0.98] cursor-pointer focus:outline-none min-w-0"
        >
          {/* Icon (mage:camera) */}
          <div className="w-[45px] h-[45px] bg-[#F7F0FF] rounded-[24px] flex items-center justify-center p-3 flex-shrink-0">
            <Image
              src="/homepage/cameraIcon.svg"
              alt="Camera Icon"
              width={21}
              height={17}
              className="w-[20.81px] h-[17.34px] object-contain"
            />
          </div>
          
          {/* Text wrapper (Frame 2147228978) */}
          <div className="w-full flex flex-col gap-[1px] items-center min-w-0">
            <span className="text-[14px] font-medium leading-[17px] text-[#1F1D1D] text-center w-full truncate">
              Upload Receipt
            </span>
            <span className="text-[11px] font-normal leading-[13px] text-[#959595] text-center w-full truncate">
              Get cashback
            </span>
          </div>
        </button>
      </div>
    </div>
  );
}
