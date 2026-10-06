/* eslint-disable @next/next/no-img-element */
import Image from "next/image";

export default function SolutionsSection() {
  return (
    <section className="w-full grid grid-cols-1 lg:grid-cols-2 gap-8 font-jakarta py-8">
      {/* 1. Rebates Solution Card */}
      <div className="bg-white border border-[#F1F5F9] rounded-[24px] shadow-sm hover:shadow-md transition-all duration-300 p-8 flex flex-col sm:flex-row gap-6">
        {/* Left List Content */}
        <div className="flex-1 flex flex-col gap-6 justify-between">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-[#2D3FEA] flex items-center justify-center">
                <img
                  src="/Auth/2ndPageIcons/rebates.svg"
                  alt="Rebates icon"
                  className="w-6 h-6 object-contain"
                />
              </div>
              <div>
                <h3 className="text-2xl font-extrabold text-[#2D3FEA] leading-none">
                  Rebates
                </h3>
                <span className="text-xs text-[#64748B] font-medium block mt-1">
                  Drive trial and increase sales
                </span>
              </div>
            </div>

            {/* List */}
            <ul className="flex flex-col gap-3.5 mt-2">
              {[
                "Launch targeted in-store rebates in minutes",
                "Fund your wallet and control daily spend",
                "Test different offers on the fly",
                "Only pay when real shoppers buy and upload a receipt",
              ].map((item, idx) => (
                <li key={idx} className="flex items-start gap-2.5 text-sm text-[#475569] font-medium leading-tight">
                  <span className="text-[#2D3FEA] mt-0.5">✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Right Visual Card (Mock UI) */}
        <div className="w-full sm:w-[190px] bg-[#F8FAFC] border border-[#F1F5F9] rounded-2xl p-4 flex flex-col justify-between items-center h-[334px] shadow-inner">
          <div className="text-center">
            <span className="text-[10px] font-bold text-[#94A3B8] tracking-widest uppercase">
              Your Rebate
            </span>
            <div className="text-3xl font-extrabold text-[#2D3FEA] mt-0.5">
              $2.00
            </div>
            <span className="text-[10px] font-bold text-[#2D3FEA]">Cashback</span>
          </div>

          <div className="relative w-full h-[150px] my-3">
            <Image
              src="/Auth/rebateImage.svg"
              alt="Sea Salt Chips Rebate Product Mockup"
              fill
              className="object-contain rounded-xl"
            />
          </div>

          <button className="w-full py-2 bg-[#2D3FEA] text-white text-[10px] font-bold rounded-lg hover:bg-blue-700 transition-colors shadow-sm shadow-blue-500/10">
            Claim rebate
          </button>
        </div>
      </div>

      {/* 2. Reviews Solution Card */}
      <div className="bg-white border border-[#F1F5F9] rounded-[24px] shadow-sm hover:shadow-md transition-all duration-300 p-8 flex flex-col sm:flex-row gap-6">
        {/* Left List Content */}
        <div className="flex-1 flex flex-col gap-6 justify-between">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-[#9333EA] flex items-center justify-center">
                <img
                  src="/Auth/2ndPageIcons/reviews.svg"
                  alt="Reviews icon"
                  className="w-6 h-6 object-contain"
                />
              </div>
              <div>
                <h3 className="text-2xl font-extrabold text-[#9333EA] leading-none">
                  Reviews
                </h3>
                <span className="text-xs text-[#64748B] font-medium block mt-1">
                  Build trust and boost conversions
                </span>
              </div>
            </div>

            {/* List */}
            <ul className="flex flex-col gap-3.5 mt-2">
              {[
                "Collect verified reviews from real purchases",
                "Use reviews on your website, retailer pages and ads",
                "Improve SEO and drive more organic traffic",
                "Real social proof from real customers",
              ].map((item, idx) => (
                <li key={idx} className="flex items-start gap-2.5 text-sm text-[#475569] font-medium leading-tight">
                  <span className="text-[#9333EA] mt-0.5">✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Right Visual Card (Mock UI) */}
        <div className="w-full sm:w-[221px] bg-[#F8FAFC] border border-[#F1F5F9] rounded-2xl p-4 flex flex-col justify-between items-start h-[334px] shadow-inner font-sans">
          <div className="w-full flex justify-between items-center">
            <span className="text-[9px] font-bold text-[#94A3B8] uppercase">
              Verified Review
            </span>
            <span className="text-xs text-[#22C55E]">✓</span>
          </div>

          <div className="flex gap-0.5 mt-1 text-[#FB923C] text-xs">
            {"★★★★★".split("").map((s, i) => (
              <span key={i}>{s}</span>
            ))}
          </div>

          <p className="text-[10px] font-bold text-[#1E293B] leading-tight my-2 italic">
            &quot;This is now my go-to snack. Love the taste and clean ingredients!&quot;
          </p>

          <div className="w-full flex gap-2 items-center bg-white p-2 rounded-xl border border-slate-100 shadow-sm">
            <div className="relative w-12 h-12 flex-shrink-0">
              <Image
                src="/Auth/reviewImage.svg"
                alt="Product review Sea Salt Chips"
                fill
                className="object-contain rounded-md"
              />
            </div>
            <div>
              <div className="text-[8px] font-extrabold text-[#0F172A]">
                Sea Salt Chips
              </div>
              <div className="text-[7px] font-extrabold text-[#22C55E] flex items-center gap-1 mt-0.5">
                <span>✓</span> Verified Purchase
              </div>
            </div>
          </div>

          {/* Helpfulness */}
          <div className="w-full flex justify-between items-center pt-2 border-t border-slate-100 text-[10px] font-bold text-[#475569] mt-2">
            <span>was this helpful?</span>
            <div className="flex gap-2">
              <button className="flex items-center gap-0.5 bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-100 hover:bg-blue-100 transition-colors">
                👍 <span className="text-[8px]">12</span>
              </button>
              <button className="flex items-center gap-0.5 bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200 hover:bg-slate-200 transition-colors">
                👎 <span className="text-[8px]">2</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
