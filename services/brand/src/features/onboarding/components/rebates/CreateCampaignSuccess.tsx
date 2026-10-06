/* eslint-disable @next/next/no-img-element */
import { useState } from "react";

interface CreateCampaignSuccessProps {
  onFinish: () => void;
}

export default function CreateCampaignSuccess({ onFinish }: CreateCampaignSuccessProps) {
  const [copied, setCopied] = useState(false);
  const linkText = "https://nibbl.app/c/summer-24-exclusive";

  const handleCopy = () => {
    navigator.clipboard.writeText(linkText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col lg:flex-row justify-center items-center px-4 md:px-6 gap-12 lg:gap-[71px] w-full min-h-[1127.89px] font-manrope text-left mx-auto animate-slide-up py-12">
      
      {/* Left Column: Asset Configuration (Frame 2038) */}
      <div className="w-full lg:w-[677.33px] flex flex-col items-center gap-[64px] flex-shrink-0">
        
        {/* Section - QR Code Display Card */}
        <div className="w-full bg-white shadow-[0px_24px_48px_rgba(19,27,46,0.02)] rounded-[32px] p-6 md:p-10 flex flex-col items-center gap-8 relative">
          
          {/* QR Code Container Box */}
          <div className="w-full max-w-[304px] h-[304px] bg-[#FAF8FF] rounded-[24px] p-[32px] flex items-center justify-center">
            <img src="/Rebate/Campaign QR Code.svg" alt="Campaign QR Code" className="w-[240px] h-[240px] object-contain" />
          </div>

          {/* Heading 3 (Asset Distribution) */}
          <span className="font-jakarta font-bold text-xl text-[#131B2E] text-center">Asset Distribution</span>

          {/* PNG & SVG Download Buttons */}
          <div className="flex flex-col sm:flex-row justify-center items-center gap-4 w-full max-w-[369.61px]">
            {/* Download PNG Button */}
            <button className="flex flex-row items-center p-4 gap-3 bg-[#F2F3FF] rounded-[24px] w-full sm:w-[175.49px] h-[67px] hover:bg-blue-100 transition-colors cursor-pointer text-left border-none">
              <img src="/Rebate/png.svg" alt="PNG" className="w-4 h-4 object-contain" />
              <div className="flex flex-col">
                <span className="text-sm font-bold text-[#131B2E]">Download PNG</span>
                <span className="text-[10px] font-medium text-[#454656] uppercase tracking-[0.5px]">PNG FORMAT</span>
              </div>
            </button>

            {/* Download SVG Button */}
            <button className="flex flex-row items-center p-4 gap-3 bg-[#F2F3FF] rounded-[24px] w-full sm:w-[178.13px] h-[67px] hover:bg-blue-100 transition-colors cursor-pointer text-left border-none">
              <img src="/Rebate/svg.svg" alt="SVG" className="w-5 h-[17px] object-contain" />
              <div className="flex flex-col">
                <span className="text-sm font-bold text-[#131B2E]">Download SVG</span>
                <span className="text-[10px] font-medium text-[#454656] uppercase tracking-[0.5px]">SVG FORMAT</span>
              </div>
            </button>
          </div>

          {/* Campaign Link Input copy bar */}
          <div className="w-full max-w-[512px] flex flex-col gap-2 text-left">
            <span className="text-xs font-bold text-[#454656] tracking-[1.2px] uppercase">CAMPAIGN LINK</span>
            <div className="relative w-full h-[56px] flex items-center bg-[#F2F3FF] rounded-2xl px-4">
              <span className="text-sm md:text-base font-medium text-[#131B2E] truncate pr-20">{linkText}</span>
              <button
                onClick={handleCopy}
                className="absolute right-2 top-2 px-4 h-9 bg-[#001BD2] hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1 border-none"
              >
                <span>📋</span>
                <span>{copied ? "Copied!" : "Copy"}</span>
              </button>
            </div>
          </div>

          {/* Bottom description */}
          <p className="text-sm font-medium text-[#454656] text-center leading-[20px] max-w-[392.44px]">
            Use this QR code in-store, or share the link via email, SMS, or social media.
          </p>

        </div>

        {/* Go to Rebate Catalog Button */}
        <button
          onClick={onFinish}
          className="relative w-[240px] min-w-[240px] h-[60px] bg-gradient-to-r from-[#001BD2] to-[#2D3FEA] text-white font-extrabold text-lg rounded-full transition-all shadow-[0px_25px_50px_-12px_rgba(0,27,210,0.3)] hover:opacity-90 active:scale-[0.98] cursor-pointer flex items-center justify-center border-none"
        >
          Go to Rebate
        </button>
      </div>

      {/* Right Column: Shopper Claim Preview */}
      <div className="w-full lg:w-[474.67px] flex flex-col items-center flex-shrink-0 relative">
        <div className="w-full lg:w-[474.67px] min-h-[1084.5px] bg-[#F2F3FF] rounded-[32px] p-6 md:p-10 flex flex-col items-center gap-8">
          
          {/* Header Label */}
          <div className="w-full text-left flex flex-col gap-2">
            <h3 className="font-jakarta font-bold text-xl text-[#131B2E]">Shopper Claim Preview</h3>
            <span className="text-sm text-[#454656] font-normal leading-[20px]">Real-time view of the customer experience</span>
          </div>

          {/* CSS Simulated Phone Mockup */}
          <div className="relative w-[280px] h-[580px] bg-[#131B2E] border-[4px] border-[#283044] rounded-[48px] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] p-3 flex flex-col overflow-hidden">
            
            {/* Screen Content Wrapper */}
            <div className="w-full h-full bg-white rounded-[35.2px] overflow-hidden flex flex-col relative z-10">
              {/* Dynamic Island bar */}
              <div className="absolute left-1/2 -translate-x-1/2 top-[8px] w-[80px] h-[12px] bg-black rounded-full z-30"></div>

              {/* In-App Header */}
              <div className="h-[88px] bg-[#001BD2] pt-8 px-6 pb-4 flex items-center gap-3 w-full flex-shrink-0">
                <div className="w-8 h-8 rounded-full bg-white/25 flex items-center justify-center">
                  <span className="text-white text-xs">←</span>
                </div>
                <span className="text-white text-sm font-bold">Claim Reward</span>
              </div>

              {/* Product Content page */}
              <div className="p-6 flex flex-col gap-[15px] flex-grow overflow-y-auto">
                <div className="w-full h-[200px] bg-[#DAE2FD] rounded-[32px] flex items-center justify-center relative overflow-hidden flex-shrink-0">
                  <img src="/Rebate/selectedProductSmallImage.svg" alt="Product" className="w-[85%] h-[85%] object-contain" />
                  <span className="absolute right-3 top-3 bg-[#004956] text-white text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider">CASHBACK</span>
                </div>

                <div className="flex flex-col text-left">
                  <h4 className="font-jakarta font-extrabold text-[18px] text-[#131B2E] leading-[22px]">Artisan Whole Milk</h4>
                  <span className="text-xs text-[#454656] font-medium mt-1">Summer Cashback Special • 3.78L</span>
                </div>

                <div className="bg-[#F2F3FF] rounded-[24px] p-4 flex justify-between items-center w-full h-[80px] flex-shrink-0">
                  <div className="flex flex-col text-left">
                    <span className="text-[10px] font-bold text-[#454656] uppercase tracking-wider">REWARD</span>
                    <div className="relative mt-1">
                      <span className="text-2xl font-black text-[#001BD2]">$2.00</span>
                      <span className="text-xs font-bold text-[#001BD2] ml-1">Cashback</span>
                    </div>
                  </div>
                  <div className="w-10 h-10 bg-[#001BD2]/10 rounded-full flex items-center justify-center">
                    <span className="text-[#001BD2] text-sm">✓</span>
                  </div>
                </div>

                {/* Submit Receipt buttons */}
                <div className="flex flex-col gap-3 mt-1 flex-shrink-0">
                  <button className="w-full h-[52px] bg-[#001BD2] text-white font-bold text-sm rounded-[32px] shadow-md shadow-blue-500/10 cursor-pointer border-none">Submit Receipt</button>
                  <button className="w-full h-[56px] border-[2px] border-[#DAE2FD] text-[#131B2E] font-bold text-sm rounded-[32px] cursor-pointer">Cancel Claim</button>
                </div>

                {/* How it works divider */}
                <div className="border-t border-[#DAE2FD] pt-4 flex flex-col gap-3 text-left flex-shrink-0">
                  <span className="text-[10px] font-bold text-[#454656] uppercase tracking-wider">HOW IT WORKS</span>
                  
                  <div className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-[#DAE2FD] flex items-center justify-center flex-shrink-0">
                      <span className="text-[#131B2E] text-[10px] font-bold">1</span>
                    </div>
                    <span className="text-[11px] text-[#454656] font-normal leading-[16px]">Buy Artisan Whole Milk at any retailer.</span>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-[#DAE2FD] flex items-center justify-center flex-shrink-0">
                      <span className="text-[#131B2E] text-[10px] font-bold">2</span>
                    </div>
                    <span className="text-[11px] text-[#454656] font-normal leading-[16px]">Upload your receipt to receive reward.</span>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Working Preview details box */}
          <div className="w-full max-w-[394.66px] bg-white border border-[#DAE2FD] rounded-[32px] p-6 shadow-sm flex flex-row gap-3 text-left mt-4">
            <span className="text-blue-500 text-sm">ℹ️</span>
            <div className="flex flex-col">
              <h4 className="font-jakarta font-bold text-sm text-[#131B2E]">Working Preview</h4>
              <p className="text-xs text-[#454656] font-normal leading-[20px] mt-1">
                See how the claim process works and what details are shared with your customers. This is a real-time simulation of the mobile landing page.
              </p>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}
