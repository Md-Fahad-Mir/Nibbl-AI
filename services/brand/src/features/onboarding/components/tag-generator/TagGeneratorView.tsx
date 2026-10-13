"use client";

import Image from "next/image";

/** Master: static Tag Generator — Coming Soon page showing the example
 *  artwork only (no generation, editing, downloads or QR codes yet). */
export default function TagGeneratorView() {
  return (
    <div className="flex flex-col gap-6 w-full animate-slide-up text-left font-manrope">
      <div className="flex flex-col gap-1 text-left">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-3xl font-extrabold font-jakarta text-[#131B2E] tracking-tight leading-none">
            Tag Generator
          </h2>
          <span className="text-xs font-bold text-[#001BD2] bg-[#E2E7FF] rounded-full px-3 py-1">Coming Soon</span>
        </div>
        <p className="text-sm text-[#454656] font-medium mt-1">
          Turn your Nibbl campaign into ready-to-share marketing inspiration.
        </p>
      </div>

      <Image
        src="/tag-generator/example-artwork.jpg"
        alt="Example campaign creative: Meta ads, retail displays, on-pack ideas, email and MMS, and how the Tag Generator will work"
        width={1261}
        height={845}
        className="w-full h-auto rounded-[20px] border border-[#C5C5D9]/20 shadow-sm"
        priority
      />
    </div>
  );
}
