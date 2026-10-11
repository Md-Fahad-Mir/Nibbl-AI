"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/features/dashboard/components/Sidebar";
import { Header } from "@/features/dashboard/components/Header";
import { SidebarNavItem } from "@/types/dashboard.types";
import { useAdminApiStore } from "@/stores/useAdminApiStore";

const dateText = (value: unknown) =>
  typeof value === "string" && value ? new Date(value).toLocaleDateString() : "—";

export const PayoutReviewsView = () => {
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const {
    profile,
    loadProfile,
    logout,
    pendingPayoutMethods,
    loadPendingPayoutMethods,
    reviewPayoutMethod,
  } = useAdminApiStore();

  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void loadProfile();
    void loadPendingPayoutMethods();
  }, [loadProfile, loadPendingPayoutMethods]);

  const handleNavSelect = (item: SidebarNavItem) => {
    switch (item) {
      case "dashboard":
        router.push("/dashboard");
        break;
      case "earnings":
        router.push("/earnings");
        break;
      case "users":
        router.push("/users");
        break;
      case "brand":
        router.push("/brand");
        break;
      case "promo-codes":
        router.push("/promo-codes");
        break;
      case "campaign-approvals":
        router.push("/campaign-approvals");
        break;
      case "review-flags":
        router.push("/review-flags");
        break;
      case "brand-discovery":
        router.push("/brand-discovery");
        break;
      case "referrals":
        router.push("/referrals");
        break;
      case "refunds":
        router.push("/refunds");
        break;
      case "payout-reviews":
        router.push("/payout-reviews");
        break;
      case "withdraw-request":
        router.push("/withdraw-request");
        break;
      case "settings":
        router.push("/settings");
        break;
      case "logout":
        logout();
        router.push("/");
        break;
      default:
        break;
    }
  };

  const handleReview = async (methodId: string, approve: boolean) => {
    setBusyId(methodId);
    setError("");
    try {
      await reviewPayoutMethod(methodId, approve);
    } catch (err) {
      setError((err as Error).message || "Could not update this payout method.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-[#FEFEFE]">
      <Sidebar
        activeNav="payout-reviews"
        onNavSelect={handleNavSelect}
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      <main className="flex-1 w-full min-h-screen p-4 sm:p-6 md:p-8 flex flex-col gap-6 items-stretch bg-[#FEFEFE] overflow-x-hidden font-inter">
        <Header
          adminName={String(profile?.full_name || profile?.email || "Admin")}
          adminRole={String(profile?.role || "Admin")}
          unreadCount={0}
          onToggleMobileMenu={() => setIsMobileMenuOpen(true)}
          onProfileClick={() => router.push("/settings")}
        />

        <div>
          <h1 className="text-2xl font-bold text-[#1A1A2E]">Payout Reviews</h1>
          <p className="text-sm text-[#6B6B80] mt-1">
            Approve or reject payout accounts held for review. A shopper&apos;s first
            account is auto-approved; later changes wait here before they can be used.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <div className="bg-white border border-[#ECECF5] rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#F6F6FB] text-[#6B6B80] text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3 font-semibold">Shopper</th>
                  <th className="px-6 py-3 font-semibold">Provider</th>
                  <th className="px-6 py-3 font-semibold">Account</th>
                  <th className="px-6 py-3 font-semibold">Added</th>
                  <th className="px-6 py-3 font-semibold text-right">Review</th>
                </tr>
              </thead>
              <tbody>
                {pendingPayoutMethods.map((method) => {
                  const id = String(method.id);
                  const busy = busyId === id;
                  return (
                    <tr key={id} className="border-t border-[#F0F0F7]">
                      <td className="px-6 py-3 text-[#1A1A2E]">
                        <div className="font-bold">{String(method.user_name || "—")}</div>
                        <div className="text-xs text-[#6B6B80]">{String(method.user_email || "")}</div>
                      </td>
                      <td className="px-6 py-3 text-[#454656] capitalize">{String(method.provider)}</td>
                      <td className="px-6 py-3 text-[#454656]">{String(method.handle)}</td>
                      <td className="px-6 py-3 text-[#454656]">{dateText(method.created_at)}</td>
                      <td className="px-6 py-3">
                        <div className="flex gap-2 justify-end">
                          <button
                            type="button"
                            onClick={() => handleReview(id, true)}
                            disabled={busy}
                            className="h-9 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-full transition-colors disabled:opacity-50 cursor-pointer"
                          >
                            {busy ? "…" : "Approve"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReview(id, false)}
                            disabled={busy}
                            className="h-9 px-4 bg-white border border-[#FF5C5C]/40 text-[#FF5C5C] hover:bg-red-50 font-semibold text-xs rounded-full transition-colors disabled:opacity-50 cursor-pointer"
                          >
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {pendingPayoutMethods.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-[#9A9AB0]">
                      No payout methods awaiting review.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
};
