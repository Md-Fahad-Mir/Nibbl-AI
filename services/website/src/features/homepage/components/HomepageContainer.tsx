"use client";

import { useEffect, useState } from "react";
import Header from "./Header";
import SearchBar from "./SearchBar";
import RewardsSection from "./RewardsSection";
import LocationGate from "./LocationGate";
import PendingRewards from "./PendingRewards";
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
  const [changingLocation, setChangingLocation] = useState(false);
  const {
    offers,
    categories,
    reservations,
    receipts,
    reviewOpportunities,
    unreadCount,
    status,
    error,
    loadHome,
    loadRewardsHub,
    discoveryLocation,
    saveDiscoveryLocation,
    accessToken,
  } = useConsumerApiStore();
  const signedIn = Boolean(accessToken);

  useEffect(() => {
    void loadHome();
    if (signedIn) void loadRewardsHub();
  }, [loadHome, loadRewardsHub, signedIn]);


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

        {/* Master ⑥ Return Action Prompt: pending receipts and reviews come first */}
        {signedIn && reservations.length + reviewOpportunities.length > 0 && (
          <section className="w-full max-w-[1137px] mx-auto">
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
              onBrowseMore={() => document.getElementById("for-you")?.scrollIntoView({ behavior: "smooth" })}
            />
          </section>
        )}

        {/* Discovery needs a location first (Master: never show unfiltered deals) */}
        {status !== "loading" && (!discoveryLocation || changingLocation) ? (
          <section className="w-full">
            <LocationGate
              onSave={async (body) => {
                await saveDiscoveryLocation(body);
                setChangingLocation(false);
              }}
              onCancel={discoveryLocation ? () => setChangingLocation(false) : undefined}
            />
          </section>
        ) : (
        <section id="for-you" className="w-full scroll-mt-4">
          {discoveryLocation && (
            <p className="max-w-[1137px] mx-auto mb-4 text-[14px] text-[#575757]">
              Deals near {discoveryLocation.zip} ·{" "}
              <button onClick={() => setChangingLocation(true)} className="text-[#3E3EDF] underline cursor-pointer">
                Change
              </button>
            </p>
          )}
          <RewardsSection
            offers={offers}
            categories={categories}
            activeCategory={activeCategory}
            isLoading={status === "loading" && !offers.length}
            error={error}
            onCategoryChange={(category) => {
              setActiveCategory(category);
              void loadHome(searchQuery, category, 1);
            }}
            onClaimOffer={onClaimOffer}
            onViewOffer={onViewOffer}
          />
        </section>
        )}

      </main>

      {/* Footer Branding Links */}
      <Footer onTabChange={onTabChange} />
    </div>
  );
}
