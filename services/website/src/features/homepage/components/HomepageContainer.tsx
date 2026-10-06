"use client";

import { useEffect, useState } from "react";
import Header from "./Header";
import SearchBar from "./SearchBar";
import WalletCard from "./WalletCard";
import RewardsSection from "./RewardsSection";
import PendingRewards from "./PendingRewards";
import ScanReceipt from "./ScanReceipt";
import Footer from "./Footer";
import { useConsumerApiStore } from "@/stores/useConsumerApiStore";

interface HomepageContainerProps {
  onClaimOffer: (campaignId?: string) => void;
  onViewOffer: (campaignId?: string) => void;
  onTabChange: (tab: "offer" | "wallet" | "scan" | "profile" | "brand" | "notification", extra?: string) => void;
}

export default function HomepageContainer({
  onClaimOffer,
  onViewOffer,
  onTabChange,
}: HomepageContainerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const {
    wallet,
    offers,
    offerPagination,
    categories,
    reservations,
    receipts,
    reviewOpportunities,
    unreadCount,
    status,
    error,
    loadHome,
    loadRewardsHub,
  } = useConsumerApiStore();

  useEffect(() => {
    void loadHome();
    void loadRewardsHub();
  }, [loadHome, loadRewardsHub]);

  const balance = Number(wallet?.available ?? wallet?.balance ?? 0);
  const loadOfferPage = (page: number) => {
    void loadHome(searchQuery, activeCategory, page);
  };

  return (
    <div className="w-full bg-[#FEFEFE] min-h-screen flex flex-col font-sans select-none">
      {/* Navigation Header */}
      <Header activeTab="offer" onTabChange={onTabChange} unreadCount={unreadCount} />

      {/* Main Content Area */}
      <main className="flex-grow flex flex-col gap-10 md:gap-12 py-10 px-4 sm:px-8 max-w-[1440px] mx-auto w-full">
        {/* Search Bar section (Frame 2147229121: top: 135px) */}
        <section className="w-full flex justify-center">
          <SearchBar
            onSearch={(query) => {
              setSearchQuery(query);
              void loadHome(query, activeCategory, 1);
            }}
          />
        </section>

        {/* Wallet Balance Card (Frame 2147229286: top: 317px) */}
        <section className="w-full flex justify-center">
          <WalletCard balance={balance} onViewWallet={() => onTabChange("wallet")} />
        </section>

        {/* Rewards Section (Your Rewards title, Filter categories, Products Grid, Pagination) */}
        <section className="w-full">
          <RewardsSection
            offers={offers}
            categories={categories}
            activeCategory={activeCategory}
            isLoading={status === "loading" && !offers.length}
            error={error}
            pagination={offerPagination}
            onCategoryChange={(category) => {
              setActiveCategory(category);
              void loadHome(searchQuery, category, 1);
            }}
            onPageChange={loadOfferPage}
            onClaimOffer={onClaimOffer}
            onViewOffer={onViewOffer}
          />
        </section>

        {/* User Pending Rewards List */}
        <section className="w-full max-w-[1137px] mx-auto flex justify-start">
          <PendingRewards
            reservations={reservations}
            receipts={receipts}
            reviewOpportunities={reviewOpportunities}
            onUploadReceiptClick={(reservationId) =>
              onTabChange("scan", reservationId ? `reservation:${reservationId}` : undefined)
            }
            onLeaveReviewClick={(opportunityId) =>
              onTabChange("scan", opportunityId ? `review:${opportunityId}` : undefined)
            }
          />
        </section>

        {/* Scan & Receipt action section centered below */}
        <section className="w-full max-w-[1137px] mx-auto flex justify-center pb-10">
          <ScanReceipt onActionClick={() => onTabChange("scan")} />
        </section>
      </main>

      {/* Footer Branding Links */}
      <Footer onTabChange={onTabChange} />
    </div>
  );
}
