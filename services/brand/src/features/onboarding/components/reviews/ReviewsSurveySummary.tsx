"use client";

export default function ReviewsSurveySummary() {
  return (
    <div className="w-full bg-white shadow-[0px_1px_2px_rgba(0,0,0,0.05)] rounded-xl overflow-hidden flex flex-col font-manrope text-left flex-shrink-0">
      
      {/* Header */}
      <div className="bg-[#F2F3FF] px-8 py-4 flex items-center gap-2 border-b border-[#EAEDFF]">
        <div className="w-4 h-4 bg-[#001BD2] rounded-full flex items-center justify-center text-white text-[10px]">📋</div>
        <h3 className="font-jakarta font-bold text-base text-[#131B2E]">Review Survey Configuration</h3>
      </div>

      {/* Body */}
      <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* Rating System */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm">⭐</span>
            <h4 className="font-bold text-sm text-[#131B2E]">Rating System</h4>
          </div>
          <p className="text-xs text-[#454656] leading-[22px] font-medium">
            Standard 5-star quantitative rating with mandatory photo verification requirement enabled.
          </p>
        </div>

        {/* Detailed Testimonials */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm">💬</span>
            <h4 className="font-bold text-sm text-[#131B2E]">Detailed Testimonials</h4>
          </div>
          <p className="text-xs text-[#454656] leading-[22px] font-medium">
            Long-form narrative input. Minimum 150 characters enforced for quality and SEO benefit.
          </p>
        </div>

        {/* Custom Attributes */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm">✨</span>
            <h4 className="font-bold text-sm text-[#131B2E]">Custom Attributes</h4>
          </div>
          <ul className="flex flex-col gap-2 text-xs text-[#454656] font-medium">
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-[#001BD2] rounded-full"></span>
              Packaging Quality
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-[#001BD2] rounded-full"></span>
              Flavor Profile Accuracy
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-[#001BD2] rounded-full"></span>
              Delivery Speed Experience
            </li>
          </ul>
        </div>

      </div>

    </div>
  );
}
