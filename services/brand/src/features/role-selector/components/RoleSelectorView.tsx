import Image from "next/image";
import RoleCard from "./RoleCard";

export default function RoleSelectorView() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-slate-200/50 backdrop-blur-sm">
      {/* Main Modal Container */}
      <div className="relative w-full max-w-[1000px] bg-white border border-slate-100 rounded-[40px] shadow-2xl p-6 md:p-16 flex flex-col items-center gap-12 transition-all duration-300 animate-slide-up">
        {/* Close Button */}
        <button
          type="button"
          className="absolute right-8 top-8 w-10 h-10 flex items-center justify-center rounded-full bg-slate-50 border border-slate-100 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors duration-200"
          aria-label="Close modal"
        >
          <svg
            className="w-5 h-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Header Section */}
        <div className="text-center flex flex-col items-center gap-4 font-sans">
          <h1 className="text-3xl md:text-[44px] font-extrabold text-slate-900 tracking-tight leading-tight">
            Choose your <span className="text-blue-600">NibblAi</span> experience.
          </h1>
          <p className="text-slate-500 font-semibold text-lg md:text-xl">
            Pick the experience that&apos;s right for you.
          </p>
        </div>

        {/* Role Cards Container */}
        <div className="w-full flex flex-col md:flex-row gap-8">
          <RoleCard
            title="For Brands"
            description="Launch rebate and review campaigns, drive in-store purchases, and track performance with powerful analytics."
            buttonText="Explore Brand Platform"
            buttonColorClass="bg-[#124CE8]"
            imageSrc="/Auth/brandImage.svg"
            iconSrc="/Auth/brandIcon.svg"
            iconBgClass="bg-[#EFF6FF]"
            iconColorClass="border-[#2563EB]"
            href="/brand-landing"
          />

          <RoleCard
            title="For Shoppers"
            description="Find rebates, upload receipts, complete reviews, and get cashback on products you already love."
            buttonText="Start Claiming Rewards!"
            buttonColorClass="bg-[#6C38E0]"
            imageSrc="/Auth/shopperImage.svg"
            iconSrc="/Auth/shopperIcon.svg"
            iconBgClass="bg-[#FAF5FF]"
            iconColorClass="border-[#9333EA]"
            href="/register"
          />
        </div>

        {/* Footer Info */}
        <div className="flex items-center gap-3 bg-slate-50 border border-slate-100 px-6 py-3 rounded-full max-w-lg text-center font-sans shadow-sm">
          <div className="w-5 h-5 flex-shrink-0 relative">
            <Image
              src="/Auth/1stPageBottomIcon.svg"
              alt="Info icon"
              fill
              className="object-contain"
            />
          </div>
          <p className="text-sm font-medium text-slate-500">
            Not sure? Brands create and manage campaigns. Shoppers claim rewards
            and{" "}
            <span className="text-purple-600 font-semibold">earn cashback</span>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
