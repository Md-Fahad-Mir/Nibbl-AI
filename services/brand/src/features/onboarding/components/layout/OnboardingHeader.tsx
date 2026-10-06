import Image from "next/image";
import Link from "next/link";

export default function OnboardingHeader() {
  return (
    <header className="w-full h-18 bg-white border-b border-slate-100 flex items-center justify-between px-6 md:px-12 font-jakarta">
      {/* Brand Logo */}
      <div className="relative w-[140px] h-[52px]">
        <Image
          src="/Auth/LogoImage.svg"
          alt="NibblAI Logo"
          fill
          className="object-contain"
          priority
        />
      </div>

      {/* Navigation */}
      <nav className="flex items-center gap-6 md:gap-8">
        <Link
          href="/brand-landing"
          className="text-sm font-semibold text-[#64748B] hover:text-[#0F172A] transition-colors duration-200"
        >
          Support
        </Link>
        <Link
          href="/brand-landing"
          className="text-sm font-semibold text-[#64748B] hover:text-[#0F172A] transition-colors duration-200"
        >
          Help Center
        </Link>

        {/* Divider */}
        <div className="h-8 w-[1px] bg-slate-200"></div>

        {/* User Profile Trigger */}
        <button
          type="button"
          className="flex items-center gap-2 cursor-pointer group"
          aria-label="User profile menu"
        >
          <div className="w-8 h-8 rounded-full bg-[#F3F4F6] border border-slate-200 flex items-center justify-center text-slate-500 font-semibold group-hover:bg-[#E5E7EB] transition-colors text-xs">
            👤
          </div>
          <span className="text-slate-400 text-xs group-hover:text-slate-600 transition-colors">
            ▼
          </span>
        </button>
      </nav>
    </header>
  );
}
