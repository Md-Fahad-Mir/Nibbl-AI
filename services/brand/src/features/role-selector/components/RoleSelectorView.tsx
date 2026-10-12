"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

export const ROLE_KEY = "nibbl-role-choice";
const SHOPPER_SITE = "https://www.joinnibbl.com";

const remember = (role: "brand" | "shopper") => {
  try {
    localStorage.setItem(ROLE_KEY, role);
  } catch {
    // Private mode: the gate simply shows again next time.
  }
};

/** Master onboarding ① "Role Gate": What brings you to Nibbl? */
export default function RoleSelectorView() {
  const router = useRouter();
  const cards = [
    {
      role: "brand" as const, title: "I'm a Brand", image: "/Auth/brandImage.svg", cta: "Explore Nibbl for Brands",
      text: "Acquire new shoppers, reconnect with customers, build loyalty, and generate verified reviews.",
      className: "bg-[#001BD2]", go: () => router.push("/brand-landing"),
    },
    {
      role: "shopper" as const, title: "I'm a Shopper", image: "/Auth/shopperImage.svg", cta: "View Deals",
      text: "Discover deals, submit receipts, and earn rewards.",
      className: "bg-[#6C38E0]", go: () => window.location.assign(SHOPPER_SITE),
    },
  ];
  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-slate-200/50 font-jakarta">
      <div className="w-full max-w-[860px] bg-white rounded-[32px] shadow-2xl p-6 md:p-12 flex flex-col items-center gap-8">
        <Image src="/Auth/LogoImage.svg" alt="Nibbl" width={150} height={56} priority />
        <h1 className="text-3xl md:text-4xl font-extrabold text-[#131B2E] text-center">What brings you to Nibbl?</h1>
        <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-5">
          {cards.map((card) => (
            <div key={card.role} className="flex flex-col gap-3 rounded-[24px] border border-slate-100 bg-[#F8F9FF] p-5">
              <div className="relative w-full h-[180px]">
                <Image src={card.image} alt="" fill className="object-contain" />
              </div>
              <h2 className="text-xl font-extrabold text-[#131B2E]">{card.title}</h2>
              <p className="text-sm text-[#454656] flex-1">{card.text}</p>
              <button type="button" onClick={() => { remember(card.role); card.go(); }}
                className={`h-12 rounded-xl text-white font-bold text-sm cursor-pointer ${card.className}`}>
                {card.cta} →
              </button>
            </div>
          ))}
        </div>
        <div className="text-center text-sm text-[#454656] font-manrope flex flex-col gap-1">
          <span>Already a brand user? <Link href="/login" className="font-bold text-[#001BD2]">Sign In</Link></span>
          <span className="text-xs text-[#94A3B8]">We&apos;ll remember your choice on this device.</span>
        </div>
      </div>
    </div>
  );
}
