"use client";

interface ReviewsCampaignIdentityProps {
  name: string;
  description: string;
}

export default function ReviewsCampaignIdentity({ name, description }: ReviewsCampaignIdentityProps) {
  return (
    <div className="w-full bg-white shadow-[0px_1px_2px_rgba(0,0,0,0.05)] border-b-4 border-[#001BD2]/10 rounded-xl overflow-hidden flex flex-col font-manrope text-left flex-shrink-0">
      
      {/* Header */}
      <div className="bg-[#F2F3FF] px-8 py-4 flex items-center gap-2 border-b border-[#EAEDFF]">
        <div className="w-4 h-4 bg-[#001BD2] rounded-full flex items-center justify-center text-white text-[10px]">✓</div>
        <h3 className="font-jakarta font-bold text-base text-[#131B2E]">Campaign Identity</h3>
      </div>

      {/* Body */}
      <div className="p-8 flex flex-col gap-6">
        {/* Campaign Name */}
        <div className="flex flex-col gap-1">
          <span className="text-xs font-bold text-[#454656]/60 tracking-[1.2px] uppercase">
            CAMPAIGN NAME
          </span>
          <h4 className="text-xl font-bold text-[#131B2E]">
            {name || "Summer Wellness & Nutrition Drive 2024"}
          </h4>
        </div>

        {/* Description */}
        <div className="flex flex-col gap-1">
          <span className="text-xs font-bold text-[#454656]/60 tracking-[1.2px] uppercase">
            DESCRIPTION
          </span>
          <p className="text-sm text-[#131B2E] leading-relaxed">
            {description || "Focusing on gathering authentic user testimonials for our new organic supplement line. Target audience: 25-45 urban professionals interested in holistic health."}
          </p>
        </div>

        {/* Status Pills */}
        <div className="flex flex-row items-center gap-3">
          <div className="bg-[#001BD2]/10 text-[#001BD2] text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-[#001BD2] rounded-full"></span>
            Ready to Launch
          </div>
          <div className="bg-[#E2E7FF] text-[#454656] text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
            Duration: 30 Days
          </div>
        </div>
      </div>

    </div>
  );
}
