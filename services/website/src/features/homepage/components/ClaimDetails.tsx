"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Header from "./Header";
import Footer from "./Footer";
import { useConsumerApiStore } from "@/stores/useConsumerApiStore";
import { displayOffer } from "../lib/offerMappers";

interface ClaimDetailsProps {
  campaignId?: string;
  onBack: () => void;
  onNavigate: (stage: "signin" | "signup" | "view-details") => void;
  onTabChange: (tab: "offer" | "wallet" | "scan" | "profile" | "brand" | "notification", extra?: string) => void;
}

export default function ClaimDetails({ campaignId, onBack, onNavigate, onTabChange }: ClaimDetailsProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const {
    accessToken,
    selectedOffer,
    offers,
    unreadCount,
    status,
    loadOfferDetails,
    claimOffer,
  } = useConsumerApiStore();
  const latestError = useConsumerApiStore((state) => state.error);

  useEffect(() => {
    if (campaignId) void loadOfferDetails(campaignId);
  }, [campaignId, loadOfferDetails]);

  const fallbackOffer = offers.find((offer) => String(offer.campaign_id ?? offer.id) === campaignId);
  const offer = selectedOffer || fallbackOffer;
  const details = offer ? displayOffer(offer) : null;
  const reviewCount = details?.reviewsCount || 0;
  const visibleRating = reviewCount > 0 ? Math.max(0, Math.min(5, Number(details?.rating || 0))) : 0;

  const handleClaimClick = async () => {
    if (!accessToken) {
      setIsModalOpen(true);
      return;
    }

    const id = campaignId || details?.id;
    if (!id) {
      setMessage("No backend campaign id was found for this offer.");
      return;
    }

    try {
      const reservation = await claimOffer(id);
      const reservationId = String(reservation.id || reservation.reservation || "");
      setMessage("Offer claimed. Upload your receipt to complete the reward.");
      onTabChange("scan", reservationId ? `claim:${reservationId}` : undefined);
    } catch {
      const backendMessage = useConsumerApiStore.getState().error;
      setMessage(backendMessage || "Could not claim this offer.");
    }
  };

  return (
    <div className="w-full bg-[#FEFEFE] min-h-screen flex flex-col font-sans select-none relative">
      {/* Header */}
      <Header activeTab="offer" onTabChange={onTabChange} unreadCount={unreadCount} />

      {/* Main Page Layout Wrapper */}
      <main className="flex-grow flex flex-col items-center py-10 px-4 sm:px-6 max-w-[1440px] mx-auto w-full relative">
        {/* Campaign Name Title */}
        <h1 className="text-[32px] font-bold text-[#1F1D1D] text-center mb-6 mt-4">
          {details?.campaignName || details?.title || "Offer Details"}
        </h1>

        {/* Claim Details Card (Frame 2147229230) */}
        <div className="w-full max-w-[614px] bg-[#FEFEFE] shadow-[0px_4px_11.5px_rgba(0,0,0,0.08)] rounded-[12px] p-6 sm:py-[12px] sm:px-[33px] flex flex-col items-center gap-[22px] border border-gray-100/50">
          
          {/* Blue Header Card (Group 85 / Rectangle 34628220) */}
          <div className="w-full max-w-[548px] min-h-[139px] bg-[#3E3EDF] rounded-lg p-5 flex flex-col justify-center items-center gap-1.5 relative overflow-hidden text-white shadow-sm flex-shrink-0">
            {/* Background Blob for aesthetic */}
            <div className="absolute -right-6 -top-6 w-20 h-20 bg-white/10 rounded-full blur-xl pointer-events-none" />

            {/* $10% OFF */}
            <h2 className="text-[48px] font-semibold leading-[58px] text-[#FEFEFE] text-center tracking-tight">
              {details?.rewardLabel || "Reward"}
            </h2>
            
            {/* Subtext */}
            <p className="text-[16px] font-normal leading-[19px] text-[#FEFEFE] text-center">
              Buy, upload, and get rewarded after verification
            </p>
          </div>

          {/* White Inner Card (Frame 2147229221) */}
          <div className="w-full max-w-[548px] bg-[#FEFEFE] shadow-[0px_4px_23.6px_rgba(0,0,0,0.06)] rounded-[12px] py-[27px] px-4 flex flex-col items-center gap-[20px] border border-gray-50">
            
            {/* Popcorn bag image (0E4EF3F6-89A0-44D4-B898-AF59D3F0B5B2) */}
            <div className="w-[179px] h-[179px] relative bg-gray-50 rounded-lg overflow-hidden flex-shrink-0 border border-gray-100/60">
              {details?.image ? (
                <Image
                  src={details.image}
                  alt={details.title || "Backend offer image"}
                  fill
                  sizes="179px"
                  className="object-contain p-2"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-gray-500">
                  No image returned
                </div>
              )}
            </div>

            {/* Details Box (Frame 2147229239) */}
            <div className="w-full max-w-[335px] bg-[#FEFEFE] shadow-[1px_-4px_18px_rgba(0,0,0,0.12),_2px_4px_6.9px_rgba(0,0,0,0.08)] rounded-[12px] py-[14px] px-3 flex flex-col items-center gap-[13px] border border-gray-50">
              
              {/* Star Rating Row (Frame 2147228493) */}
              <div className="w-[170px] h-[20px] flex items-center justify-center gap-2 text-[14px] font-semibold leading-[17px] text-[#1F1D1D]">
                {/* Frame 2147228492 */}
                <div className="w-[116px] h-[20px] flex items-center gap-1 flex-shrink-0">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <svg
                      key={i}
                      className={`w-[20px] h-[20px] fill-current ${i < Math.round(visibleRating) ? "text-[#FF9F19]" : "text-[#C0C0C0]"}`}
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <span className="truncate">
                  {visibleRating.toFixed(2)} ({reviewCount})
                </span>
              </div>

              {/* Description message */}
              <p className="text-[#4D4D4D] text-[14px] font-normal leading-[17px] text-center w-full max-w-[335px]">
                {details?.description || "Claim this backend offer and upload your receipt to receive the reward."}
              </p>

              {/* CTA Large Claim button (Frame 2147229219) */}
              <button
                onClick={handleClaimClick}
                className="w-full max-w-[197px] h-[46px] bg-gradient-to-b from-[#3E3EDF] to-[#3E3EDF] hover:opacity-90 active:scale-[0.98] text-[#FEFEFE] text-[16px] font-medium leading-[24px] rounded-lg shadow-[0_4px_4px_rgba(0,0,0,0.12),inset_0_4px_4px_rgba(255,255,255,0.12)] flex items-center justify-center cursor-pointer transition-all focus:outline-none"
              >
                Claim Offer
            </button>
            {message && (
              <p className={`text-center text-[13px] font-medium ${status === "error" ? "text-[#E65353]" : "text-[#00A671]"}`}>
                {message}
              </p>
            )}
            {latestError && status === "error" && latestError !== message && (
              <p className="text-center text-[13px] font-medium text-[#E65353]">
                {latestError}
              </p>
            )}
            </div>

            {/* Sub details block (Frame 2147229237) */}
            <div className="w-full max-w-[335px] flex flex-col items-center gap-[4px] mt-2">
              <p className="text-[#4D4D4D] text-[14px] font-normal leading-[17px] text-center w-full">
                {details?.expires ? `Offer expires ${details.expires}.` : "Sign in, claim this offer, then upload your receipt."}
              </p>
              
              {/* More Details link (Frame 2147229236) */}
              <button
                type="button"
                onClick={() => onNavigate("view-details")}
                className="w-[72px] h-[25px] border-b border-[#000000] text-[#000000] text-[12px] font-normal leading-[15px] flex items-center justify-center cursor-pointer hover:opacity-75 transition-all focus:outline-none"
              >
                More Details
              </button>
            </div>

          </div>

          {/* Back to Homepage Button */}
          <button
            onClick={onBack}
            className="text-[#3E3EDF] hover:underline text-sm font-medium mt-1 cursor-pointer focus:outline-none"
          >
            &larr; Back to Offers
          </button>
        </div>
      </main>

      {/* Footer */}
      <Footer onTabChange={onTabChange} />

      {/* Auth Modal Overlay (Blurred background, overlay card) */}
      {isModalOpen && (
        <div
          onClick={() => setIsModalOpen(false)}
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 cursor-pointer"
        >
          {/* Modal Container */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[380px] bg-white rounded-2xl shadow-[0px_4px_23.6px_rgba(0,0,0,0.12)] p-6 sm:p-8 flex flex-col items-center gap-6 relative select-none animate-scale-in cursor-default border border-gray-100"
          >
            {/* Title */}
            <h3 className="text-[24px] font-bold text-[#1F1D1D] text-center">
              Claim Offer
            </h3>

            {/* Red Warning text */}
            <p className="text-[14px] font-semibold text-[#E65353] text-center leading-relaxed">
              Receipts must be uploaded within 7 days of claiming this offer.
            </p>

            {/* Alert / Clock Info Box */}
            <div className="flex items-center gap-3 bg-gray-50 border border-gray-100 rounded-lg p-3 w-full">
              <span className="text-[#575757] flex-shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </span>
              <span className="text-[13px] font-semibold text-[#1F1D1D]">
                Please sign in or sign up to continue
              </span>
            </div>

            {/* Buttons stack */}
            <div className="w-full flex flex-col gap-3">
              {/* Sign In Button */}
              <button
                onClick={() => onNavigate("signin")}
                className="w-full h-[40px] bg-[#3E3EDF] hover:bg-[#3232c4] active:scale-[0.98] text-white text-sm font-semibold rounded-lg flex items-center justify-center cursor-pointer transition-all shadow-sm focus:outline-none"
              >
                Sign In
              </button>

              {/* Sign Up Button */}
              <button
                onClick={() => onNavigate("signup")}
                className="w-full h-[40px] bg-white border border-[#3E3EDF] hover:bg-gray-50 active:scale-[0.98] text-[#3E3EDF] text-sm font-semibold rounded-lg flex items-center justify-center cursor-pointer transition-all focus:outline-none"
              >
                Sign Up
              </button>
            </div>

            {/* Bottom text */}
            <span className="text-[12px] font-normal text-[#676464] text-center">
              New here? It only takes a few seconds.
            </span>

          </div>
        </div>
      )}
    </div>
  );
}
