/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { LogOut, Settings, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useBrandApiStore } from "@/stores/useBrandApiStore";

interface NotificationItem {
  id: string;
  title: string;
  time: string;
  message: string;
  iconSrc: string;
  bgClass: string;
  iconColor: string;
}

interface HeaderProps {
  notifications: NotificationItem[];
  handleMarkAllRead: () => void;
  onToggleSidebar?: () => void;
  walletBalance?: string;
  userName?: string;
  userRole?: string;
  avatarUrl?: string;
  onOpenProfile?: () => void;
}

export default function Header({
  notifications,
  handleMarkAllRead,
  onToggleSidebar,
  walletBalance = "$2,450.00",
  userName = "Brand user",
  userRole = "brand",
  avatarUrl,
  onOpenProfile,
}: HeaderProps) {
  const router = useRouter();
  const logout = useBrandApiStore((state) => state.logout);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  return (
    <header className="w-full h-20 bg-[#FAF8FF] border-b border-[#000000]/10 flex items-center justify-between px-4 md:px-8 sticky top-0 z-20">
      {/* Mobile Menu & Search Area */}
      <div className="flex items-center flex-1 max-w-[600px] gap-3">
        <button
          onClick={onToggleSidebar}
          className="md:hidden w-10 h-10 rounded-xl border border-[#C5C5D9]/20 hover:bg-[#E2E7FF]/30 flex items-center justify-center flex-shrink-0 cursor-pointer text-[#131B2E] text-lg font-bold"
        >
          ☰
        </button>
        <div className="w-full relative">
          <input
            type="text"
            placeholder="Search campaigns, users, or metrics..."
            className="w-full h-11 bg-white border border-transparent shadow-[0px_1px_2px_rgba(0,0,0,0.05)] rounded-full pl-12 pr-6 text-sm focus:outline-none focus:border-[#001BD2] focus:ring-1 focus:ring-[#001BD2] text-slate-800 placeholder-slate-400"
          />
          <div className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] flex items-center justify-center">
            <img src="/reviews/searchIcon.svg" alt="Search" className="w-[18px] h-[18px] object-contain" />
          </div>
        </div>
      </div>

      {/* User & Alert Actions */}
      <div className="flex items-center gap-6 relative">
        {/* Notification Bell Button */}
        <button
          onClick={() => {
            setShowNotifications(!showNotifications);
            setShowProfileMenu(false);
          }}
          className="relative p-2 rounded-full hover:bg-slate-100/80 transition-colors cursor-pointer text-slate-600 flex items-center justify-center"
        >
          <img
            src="/Notification/notifications.svg"
            alt="Notifications"
            className="w-5 h-5 object-contain"
          />
          {notifications.length > 0 && (
            <span className="absolute w-2 h-2 bg-[#BA1A1A] rounded-full right-2 top-2 ring-1 ring-white"></span>
          )}
        </button>

        {/* Wallet Balance Tracker */}
        <div className="flex flex-col items-end font-manrope">
          <span className="text-[10px] font-bold text-[#454656] tracking-wider uppercase">
            Balance
          </span>
          <span className="text-sm font-extrabold text-[#131B2E] leading-none mt-0.5">
            {walletBalance}
          </span>
        </div>

        {/* Vertical Divider */}
        <div className="w-[1px] h-8 bg-[#C5C5D9]/15"></div>

        {/* User Profile */}
        <button
          type="button"
          onClick={() => {
            setShowProfileMenu(!showProfileMenu);
            setShowNotifications(false);
          }}
          className="flex items-center gap-3 rounded-2xl px-2 py-1.5 hover:bg-white/80 transition-colors cursor-pointer"
          aria-haspopup="menu"
          aria-expanded={showProfileMenu}
        >
          <div className="flex flex-col items-end font-manrope">
            <span className="text-xs font-bold text-[#131B2E] leading-none">
              {userName}
            </span>
            <span className="text-[10px] text-[#454656] mt-0.5 font-medium">
              {userRole}
            </span>
          </div>
          <div className="w-10 h-10 rounded-full border-2 border-[#E2E7FF] overflow-hidden flex items-center justify-center bg-white shadow-sm flex-shrink-0">
            <img
              src={avatarUrl || "/Notification/profile1.svg"}
              alt="User avatar"
              className="w-full h-full object-cover"
            />
          </div>
        </button>

        {showProfileMenu && (
          <div
            role="menu"
            className="absolute right-0 top-14 w-56 bg-white shadow-[0px_0px_0px_1px_rgba(197,197,217,0.1),0px_24px_48px_rgba(19,27,46,0.1)] rounded-2xl z-50 overflow-hidden animate-slide-up font-manrope"
          >
            <div className="px-4 py-3 bg-[#F2F3FF] border-b border-[#C5C5D9]/10">
              <p className="text-xs font-extrabold text-[#131B2E] truncate">{userName}</p>
              <p className="text-[10px] font-semibold text-[#454656] mt-0.5">{userRole}</p>
            </div>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onOpenProfile?.();
                setShowProfileMenu(false);
              }}
              className="w-full flex items-center gap-3 px-4 py-3 text-left text-xs font-bold text-[#131B2E] hover:bg-[#F2F3FF] transition-colors cursor-pointer"
            >
              <UserRound className="w-4 h-4 text-[#001BD2]" />
              Profile
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onOpenProfile?.();
                setShowProfileMenu(false);
              }}
              className="w-full flex items-center gap-3 px-4 py-3 text-left text-xs font-bold text-[#131B2E] hover:bg-[#F2F3FF] transition-colors cursor-pointer"
            >
              <Settings className="w-4 h-4 text-[#001BD2]" />
              Settings
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 text-left text-xs font-bold text-[#BA1A1A] hover:bg-red-50 transition-colors cursor-pointer border-t border-[#C5C5D9]/10"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        )}

        {/* Notifications Dropdown Panel */}
        {showNotifications && (
          <div className="absolute right-0 top-14 w-[384px] bg-white shadow-[0px_0px_0px_1px_rgba(197,197,217,0.1),0px_24px_48px_rgba(19,27,46,0.08)] rounded-2xl z-50 flex flex-col animate-slide-up">
            {/* Header */}
            <div className="flex justify-between items-center p-5 bg-[#F2F3FF] border-b border-[#C5C5D9]/5 rounded-t-2xl">
              <h3 className="font-jakarta font-bold text-base text-[#131B2E]">
                Notifications
              </h3>
              <button
                onClick={handleMarkAllRead}
                className="font-manrope font-bold text-xs text-[#001BD2] hover:underline cursor-pointer"
              >
                Mark all read
              </button>
            </div>

            {/* Scrollable Container */}
            <div className="max-h-[440px] overflow-y-auto flex flex-col">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-sm font-medium text-slate-400">
                  No new notifications
                </div>
              ) : (
                notifications.map((item) => (
                  <div
                    key={item.id}
                    className="flex gap-4 p-4 border-b border-[#C5C5D9]/5 hover:bg-slate-50 transition-colors text-left"
                  >
                    {/* Left Circle Icon */}
                    <div
                      className={`w-10 h-10 rounded-full ${item.bgClass} flex items-center justify-center flex-shrink-0`}
                    >
                      <img
                        src={item.iconSrc}
                        alt="Notification type icon"
                        className="w-5 h-5 object-contain"
                      />
                    </div>

                    {/* Content details */}
                    <div className="flex-1 flex flex-col gap-1 font-manrope">
                      <div className="flex justify-between items-start">
                        <span className="text-xs font-extrabold text-[#131B2E]">
                          {item.title}
                        </span>
                        <span className="text-[10px] font-medium text-[#454656]">
                          {item.time}
                        </span>
                      </div>
                      <p className="text-xs text-[#454656] leading-[1.6] font-normal">
                        {item.message}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="p-3 bg-[#F2F3FF] border-t border-[#C5C5D9]/5 rounded-b-2xl flex justify-center items-center">
              <button className="font-manrope font-bold text-xs text-[#454656] hover:underline cursor-pointer">
                View All Notifications
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
