"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { name: "1. Role Selector", path: "/" },
  { name: "2. Brand Advantage", path: "/brand-landing" },
  { name: "3. Registration", path: "/register" },
  { name: "4. Login", path: "/login" },
  { name: "5. Onboarding", path: "/onboarding" },
];

export default function FloatingNav() {
  const pathname = usePathname();

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center justify-center pointer-events-none">
      <nav className="pointer-events-auto flex items-center gap-1 bg-slate-900/80 hover:bg-slate-900/90 text-slate-300 border border-slate-700/50 backdrop-blur-md px-3 py-1.5 rounded-full shadow-2xl transition-all duration-300">
        {navItems.map((item) => {
          const isActive = pathname === item.path;
          return (
            <Link
              key={item.path}
              href={item.path}
              className={`text-xs md:text-sm px-3.5 py-1.5 rounded-full font-medium transition-all duration-200 ${
                isActive
                  ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                  : "hover:text-white hover:bg-slate-800/80"
              }`}
            >
              {item.name}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
