import HeroSection from "./HeroSection";
import SolutionsSection from "./SolutionsSection";
import FeaturesRow from "./FeaturesRow";
import PlansSection from "./PlansSection";

export default function BrandLandingView() {
  return (
    <div className="w-full min-h-screen bg-white text-[#0F172A] font-jakarta py-16 md:py-24 px-4 sm:px-10 lg:px-16 flex flex-col gap-16 md:gap-24 items-center overflow-x-hidden">
      {/* Container Wrapper for max constraints */}
      <div className="w-full max-w-[1200px] flex flex-col gap-16 md:gap-20">
        {/* 1. Hero / Advantage Section */}
        <HeroSection />

        {/* 2. Detailed Solutions Section */}
        <SolutionsSection />

        {/* 3. Sub-Features Pillars */}
        <FeaturesRow />

        {/* 4. Plans and Pricing Grid */}
        <PlansSection />

        {/* 5. Bottom Disclaimer Info */}
        <div className="w-full flex flex-col items-center text-center gap-1.5 py-6">
          <span className="text-[13.8px] font-bold text-[#2D3FEA]">
            Not performance based. You&apos;re in control.
          </span>
          <span className="text-[13.8px] font-medium text-[#64748B]">
            Fund your wallet. Set your limits. We handle the rest.
          </span>
        </div>
      </div>
    </div>
  );
}
