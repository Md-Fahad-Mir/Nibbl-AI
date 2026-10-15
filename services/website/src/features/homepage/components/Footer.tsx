"use client";

import Image from "next/image";
import { Mail } from "lucide-react";

interface FooterProps {
  onTabChange?: (tab: "offer" | "wallet" | "scan" | "profile" | "brand" | "notification", extra?: string) => void;
}

const SUPPORT_EMAIL = "support@joinnibbl.com";

const LINKS: { label: string; extra: string }[] = [
  { label: "Contact us", extra: "help" },
  { label: "Privacy Policy", extra: "privacy" },
  { label: "Terms & Conditions", extra: "terms" },
  { label: "FAQ", extra: "faq" },
];

export default function Footer({ onTabChange }: FooterProps) {
  return (
    <footer className="w-full bg-[#F0F0F0] pt-8 pb-6 px-6 sm:px-12 font-sans">
      <div className="w-full max-w-[1061px] mx-auto flex flex-col gap-8">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-8">
          <div className="flex flex-col gap-3 max-w-[320px]">
            <Image src="/logo/smallLogo.svg" alt="nibblAI" width={150} height={57} className="h-[44px] w-auto object-contain" />
            <p className="text-sm text-[#575757]">
              Claim offers, buy the product, submit your receipt and get cash back.
            </p>
          </div>

          <nav className="flex flex-col gap-3" aria-label="Help & support">
            <h3 className="text-base font-semibold text-[#434343]">Help &amp; support</h3>
            {LINKS.map((link) => (
              <a
                key={link.extra}
                href={onTabChange ? "#" : `mailto:${SUPPORT_EMAIL}`}
                onClick={(e) => {
                  if (!onTabChange) return;
                  e.preventDefault();
                  onTabChange("profile", link.extra);
                }}
                className="text-sm text-[#575757] hover:text-black cursor-pointer"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="flex flex-col gap-3">
            <h3 className="text-base font-semibold text-[#434343]">Contact</h3>
            <a href={`mailto:${SUPPORT_EMAIL}`} className="flex items-center gap-2 text-sm text-[#575757] hover:text-black">
              <Mail className="w-4 h-4" /> {SUPPORT_EMAIL}
            </a>
          </div>
        </div>

        <div className="border-t border-[#D0D0D0] pt-4 text-sm text-[#575757] text-center sm:text-left">
          © {new Date().getFullYear()} Nibbl. All rights reserved.
        </div>
        {/* Room for the phone bottom tab bar */}
        <div className="h-16 md:hidden" aria-hidden />
      </div>
    </footer>
  );
}
