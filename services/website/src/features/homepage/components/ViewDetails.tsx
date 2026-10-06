"use client";

import { useEffect, useState } from "react";
import UserAvatar from "@/components/UserAvatar";
import Header from "./Header";
import Footer from "./Footer";
import { useConsumerApiStore } from "@/stores/useConsumerApiStore";
import { displayOffer, displayReviews } from "../lib/offerMappers";

interface ViewDetailsProps {
  campaignId?: string;
  onBack: () => void;
  onTabChange: (tab: "offer" | "wallet" | "scan" | "profile" | "brand" | "notification", extra?: string) => void;
}

export default function ViewDetails({ campaignId, onBack, onTabChange }: ViewDetailsProps) {
  const [email, setEmail] = useState("");
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const {
    accessToken,
    selectedOffer,
    offers,
    unreadCount,
    status,
    loadOfferDetails,
    saveOffer,
  } = useConsumerApiStore();
  const latestError = useConsumerApiStore((state) => state.error);

  useEffect(() => {
    if (campaignId) void loadOfferDetails(campaignId);
  }, [campaignId, loadOfferDetails]);

  const fallbackOffer = offers.find((offer) => String(offer.campaign_id ?? offer.id) === campaignId);
  const offer = selectedOffer || fallbackOffer;
  const details = offer ? displayOffer(offer) : null;
  const reviews = displayReviews(offer);

  const handleSaveReward = async () => {
    const id = campaignId || details?.id;
    if (!accessToken) {
      onTabChange("scan");
      return;
    }
    if (!id) {
      setSavedMessage("No backend campaign id was found for this offer.");
      return;
    }

    try {
      await saveOffer(id);
      setSavedMessage("Offer saved from the backend.");
      onTabChange("scan");
    } catch {
      const backendMessage = useConsumerApiStore.getState().error;
      setSavedMessage(backendMessage || "Could not save this offer.");
    }
  };

  return (
    <div className="w-full bg-[#FEFEFE] min-h-screen flex flex-col font-sans select-none">
      <Header activeTab="offer" onTabChange={onTabChange} unreadCount={unreadCount} />

      <main className="flex-grow flex flex-col items-center py-10 px-4 sm:px-6 max-w-[1440px] mx-auto w-full">
        <div className="w-full max-w-[535px] flex flex-col gap-6">
          <div className="w-full flex flex-col gap-6">
            <div className="w-full flex flex-col gap-[3px]">
              <h1 className="text-[32px] font-medium leading-[39px] text-[#2D2D2D] w-full">
                {details?.campaignName || details?.title || "Offer Details"}
              </h1>
              <span className="text-[18px] font-normal leading-[22px] text-[#4D4D4D]">
                {details?.expires ? `Expires ${details.expires}` : "Backend offer"}
              </span>
            </div>

            <div className="w-full flex flex-col gap-[3px]">
              <h2 className="text-[20px] font-medium leading-[24px] text-[#1F1D1D] w-full">
                Top Offer {details?.rewardLabel || "Reward"}
              </h2>

              <div className="text-[20px] font-normal leading-[24px] text-[#4D4D4D] w-full flex flex-col gap-1">
                <p>1. {details?.description || "Buy this eligible product from a participating retailer."}</p>
                <p>2. Claim the backend offer in NibblAI.</p>
                <p>3. Upload a valid receipt for verification.</p>
                <p>4. Receive {details?.rewardLabel || "your reward"} in your wallet after approval.</p>
              </div>
            </div>
          </div>

          <div className="w-full max-w-[531px] bg-[#FEFEFE] shadow-[0px_4px_8.2px_rgba(0,0,0,0.2)] rounded-[12px] p-3 flex flex-col gap-2">
            <h3 className="text-[20px] font-medium leading-[24px] text-[#1F1D1D] w-full">
              How It Works
            </h3>

            <div className="w-full flex flex-col gap-2">
              {[
                "Buy this product at any participating store or online retailer.",
                "Upload your receipt through NibblAI to verify your purchase.",
                "Receive your reward directly in your Nibbl wallet.",
              ].map((step, index) => (
                <div key={step} className="flex gap-2 items-center w-full">
                  <span className="w-6 h-6 flex-shrink-0 text-[#3E3EDF]">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                      {index === 0 ? (
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5a2 2 0 10-2 2h2zm-2 4h4m8 0a2 2 0 10-2-2v2m0 0h2m-2 0a2 2 0 11-2-2v2m0 0h2m0 0v10a2 2 0 01-2 2H6a2 2 0 01-2-2V11" />
                      ) : index === 1 ? (
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                      )}
                    </svg>
                  </span>
                  <p className="text-[16px] font-normal leading-[19px] text-[#4D4D4D]">
                    {step}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="w-full flex flex-col gap-[18px]">
            <h3 className="text-[20px] font-medium leading-[24px] text-[#2D2D2D] w-full">
              Top Reviews
            </h3>

            <div className="w-full flex flex-col gap-6">
              {reviews.length ? reviews.map((review) => (
                <div key={review.id} className="w-full flex flex-col gap-2 relative">
                  <div className="w-full flex justify-between items-start">
                    <div className="flex gap-3 items-center">
                      <UserAvatar
                        src={review.avatar}
                        alt={review.author}
                        className="h-10 w-10 border border-gray-200"
                        iconClassName="h-5 w-5"
                      />
                      <div className="flex flex-col">
                        <span className="text-[16px] font-medium leading-[24px] text-[#1F1D1D]">
                          {review.author}
                        </span>
                        <div className="flex gap-[5px] items-center">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <svg
                              key={i}
                              className={`w-[16px] h-[16px] fill-current ${i < Math.round(review.rating) ? "text-[#FFB701]" : "text-[#C0C0C0]"}`}
                              viewBox="0 0 20 20"
                            >
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                          ))}
                        </div>
                      </div>
                    </div>

                    <span className="text-[14px] font-normal leading-[17px] text-[#4D4D4D] flex-shrink-0">
                      {review.date}
                    </span>
                  </div>

                  <p className="text-[16px] font-normal leading-[19px] text-[#4D4D4D] pl-1.5 mt-1.5">
                    {review.body}
                  </p>
                </div>
              )) : (
                <div className="w-full rounded-lg border border-gray-100 bg-white p-4 text-sm text-[#575757]">
                  No reviews returned by the backend for this offer.
                </div>
              )}
            </div>

            <div className="w-[502px] max-w-full h-[45px] bg-[#FEFEFE] border border-[#E0E0E0] rounded-[4px] flex items-center px-[6px] py-[11px] gap-2.5 mt-2">
              <input
                type="email"
                placeholder="Your email address"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="bg-transparent border-none text-[#4D4D4D] placeholder-[#4D4D4D] text-[10px] font-normal leading-[12px] focus:outline-none w-full h-full"
              />
            </div>

            <button
              onClick={handleSaveReward}
              className="w-full h-[56px] bg-white border border-[#3E3EDF] hover:bg-gray-50 active:scale-[0.98] text-[#1F1D1D] text-[20px] font-normal leading-[24px] rounded-lg shadow-[inset_0px_4px_4px_rgba(255,255,255,0.12)] filter drop-shadow(0px_4px_4px_rgba(0,0,0,0.12)) transition-all flex items-center justify-center cursor-pointer focus:outline-none mt-2"
            >
              Save My Reward
            </button>
            {savedMessage && (
              <p className={`text-center text-[13px] font-medium ${status === "error" ? "text-[#E65353]" : "text-[#00A671]"}`}>
                {savedMessage}
              </p>
            )}
            {status === "error" && latestError && latestError !== savedMessage && (
              <p className="text-center text-[13px] font-medium text-[#E65353]">
                {latestError}
              </p>
            )}
          </div>

          <button
            onClick={onBack}
            className="text-[#3E3EDF] hover:underline text-sm font-medium text-center mt-4 cursor-pointer focus:outline-none"
          >
            &larr; Back to Offers
          </button>
        </div>
      </main>

      <Footer onTabChange={onTabChange} />
    </div>
  );
}
