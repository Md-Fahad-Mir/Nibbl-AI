/* eslint-disable @next/next/no-img-element */
"use client";

import { useRouter } from "next/navigation";
import { useBrandApiStore } from "@/stores/useBrandApiStore";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  setViewMode: (mode: "list" | "add" | "details") => void;
  sidebarOpen?: boolean;
  setSidebarOpen?: (open: boolean) => void;
  hasBrandAccess?: boolean;
}

const menuItems = [
  { name: "Dashboard", icon: "/sidebarIcon/dashboardIcon.svg" },
  { name: "Product Library", icon: "/sidebarIcon/productLibary.svg" },
  { name: "Rebate", icon: "/sidebarIcon/Rebate.svg" },
  { name: "Reviews", icon: "/sidebarIcon/Reviews.svg" },
  { name: "Redemptions", icon: "/sidebarIcon/redemption.svg" },
  { name: "Analytics", icon: "/sidebarIcon/Analytics.svg" },
  { name: "Customers", icon: "/sidebarIcon/customers.svg" },
  { name: "Wallet", icon: "/sidebarIcon/wallets.svg" },
  { name: "Settings", icon: "/sidebarIcon/settings.svg" },
];

export default function Sidebar({
  activeTab,
  setActiveTab,
  setViewMode,
  sidebarOpen,
  setSidebarOpen,
  hasBrandAccess = true,
}: SidebarProps) {
  const router = useRouter();
  const logout = useBrandApiStore((state) => state.logout);

  return (
    <>
      {/* Mobile Drawer Overlay */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen?.(false)}
          className="fixed inset-0 bg-black/40 z-40 md:hidden transition-opacity"
        ></div>
      )}

      <aside className={`fixed md:sticky top-0 left-0 h-screen bg-[#F2F3FF] flex flex-col justify-between p-6 border-r border-[#C5C5D9]/15 flex-shrink-0 z-50 transition-transform duration-200 w-64 ${
        sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      }`}>
      <div className="flex flex-col gap-8 w-full">
        {/* Logo Area */}
        <div className="px-4 py-2">
          <img
            src="/Auth/LogoImage.svg"
            alt="NibblAI Logo"
            className="w-[194px] h-[72px] object-contain"
          />
        </div>

        {/* Navigation Links */}
        <nav className="flex flex-col gap-1 w-full font-manrope">
          {menuItems.map((item) => {
            const isActive = activeTab === item.name;
            const isLocked = !hasBrandAccess && !["Dashboard", "Settings"].includes(item.name);
            return (
              <button
                key={item.name}
                onClick={() => {
                  if (isLocked) return;
                  setActiveTab(item.name);
                  setViewMode("list");
                }}
                disabled={isLocked}
                className={`flex items-center gap-3 px-4 py-3 rounded-r-none rounded-l-xl transition-all duration-150 border-r-4 text-sm font-semibold ${
                  isLocked
                    ? "cursor-not-allowed border-transparent text-[#757688] opacity-45"
                    : "cursor-pointer"
                } ${
                  isActive
                    ? "bg-[#E2E7FF]/50 border-[#001BD2] text-[#001BD2]"
                    : "border-transparent text-[#454656] hover:bg-[#E2E7FF]/20"
                }`}
              >
                <img
                  src={item.icon}
                  alt={`${item.name} icon`}
                  className="w-[18px] h-[18px] object-contain flex-shrink-0"
                  style={{
                    filter: isActive
                      ? "invert(13%) sepia(95%) saturate(5437%) hue-rotate(234deg) brightness(85%) contrast(145%)"
                      : "none",
                  }}
                />
                <span>{item.name}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* User Sign Out */}
      <div className="pt-6 border-t border-[#C5C5D9]/15 font-jakarta">
        <button
          onClick={async () => {
            await logout();
            router.push("/login");
          }}
          className="flex items-center gap-3 px-4 py-3 bg-white hover:bg-slate-50 transition-colors rounded-2xl text-sm font-bold text-[#FF2D31]"
        >
          <img
            src="/sidebarIcon/signout.svg"
            alt="Sign out icon"
            className="w-[18px] h-[18px] object-contain flex-shrink-0"
          />
          <span>SIGN OUT</span>
        </button>
      </div>
    </aside>
    </>
  );
}
