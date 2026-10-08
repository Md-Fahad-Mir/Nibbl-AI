"use client";

import { Tag } from "lucide-react";

export default function TagGeneratorView() {
  return (
    <div className="flex flex-col gap-8 w-full animate-slide-up text-left font-manrope">
      {/* Header */}
      <div className="flex flex-col gap-1 text-left pb-2">
        <h2 className="text-3xl font-extrabold font-jakarta text-[#131B2E] tracking-tight leading-none">
          Tag Generator
        </h2>
        <p className="text-xs text-[#454656] font-medium mt-1">
          Generate tracking tags for your campaigns.
        </p>
      </div>

      {/* Coming Soon card */}
      <div className="bg-white border border-[#C5C5D9]/30 rounded-2xl shadow-sm px-6 py-16 flex flex-col items-center justify-center text-center gap-5">
        <div className="w-16 h-16 rounded-2xl bg-[#E2E7FF]/60 flex items-center justify-center">
          <Tag className="w-7 h-7 text-[#001BD2]" strokeWidth={2} />
        </div>
        <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#001BD2]">
          Coming Soon
        </span>
        <h3 className="text-2xl font-extrabold font-jakarta text-[#131B2E] max-w-md">
          The Tag Generator is on its way.
        </h3>
        <p className="text-sm font-medium text-[#454656] leading-relaxed max-w-md">
          Soon you&apos;ll be able to generate tracking tags for your campaigns right
          here. We&apos;re putting the finishing touches on it — check back shortly.
        </p>
      </div>
    </div>
  );
}
