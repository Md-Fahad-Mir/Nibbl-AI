"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Header from "./Header";
import Footer from "./Footer";
import { useConsumerApiStore } from "@/stores/useConsumerApiStore";
import { ApiError, nibblApi } from "@/lib/api/backendApi";
import { displayOffer } from "../lib/offerMappers";
import EmailCodeForm from "@/features/auth/components/EmailCodeForm";

// Master "Rebate Restriction Pop-ups" — keyed by the API's error code.
const RESTRICTION_TITLES: Record<string, string> = {
  consent_required: "Consent required",
  slots_full: "All claim slots are in use",
  already_claimed: "You've already claimed this offer",
  cooldown: "This offer is on cooldown for you",
  one_time_redeemed: "One-time offer already redeemed",
  not_started: "This offer hasn't started yet",
  paused_or_ended: "This offer is paused or has ended",
  capacity_reached: "Current claims are used up",
  unavailable: "This offer is temporarily unavailable",
};

interface ClaimDetailsProps {
  campaignId?: string;
  onBack: () => void;
  onNavigate: (stage: "signin" | "signup" | "view-details") => void;
  onTabChange: (tab: "offer" | "wallet" | "scan" | "profile" | "brand" | "notification", extra?: string) => void;
}

export default function ClaimDetails({ campaignId, onBack, onNavigate, onTabChange }: ClaimDetailsProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  // Two separate, optional marketing consents (email + SMS each).
  const [consentNibbl, setConsentNibbl] = useState(false);
  const [consentBrand, setConsentBrand] = useState(false);
  // Master Reserve Offer: email + phone — prefilled when signed in, collected
  // here when logged out (then a 6-digit email code signs them in).
  const user = useConsumerApiStore((state) => state.user);
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [codeSentTo, setCodeSentTo] = useState("");
  const [sendingCode, setSendingCode] = useState(false);
  const {
    accessToken,
    selectedOffer,
    offers,
    unreadCount,
    status,
    loadOfferDetails,
    claimOffer,
  } = useConsumerApiStore();
  const [restriction, setRestriction] = useState<{ code: string; message: string } | null>(null);
  const latestError = useConsumerApiStore((state) => state.error);
  // Master ④/⑤: personal claim-slot use, and a separate confirmation screen
  // (the slot is only consumed on Confirm & Reserve).
  const [slots, setSlots] = useState<{ used: number; limit: number; available: number } | null>(null);
  const [confirmDeadline, setConfirmDeadline] = useState<Date | null>(null);
  const [reserving, setReserving] = useState(false);

  useEffect(() => {
    // Logged out, the deal comes from its public link (loadPublicOffer);
    // the full details load once the shopper is signed in.
    if (campaignId && accessToken) void loadOfferDetails(campaignId);
  }, [campaignId, accessToken, loadOfferDetails]);

  useEffect(() => {
    if (!accessToken) return;
    let live = true;
    nibblApi.claimSlots().then((data) => live && setSlots(data)).catch(() => undefined);
    return () => {
      live = false;
    };
  }, [accessToken]);

  const fallbackOffer = offers.find((offer) => String(offer.campaign_id ?? offer.id) === campaignId);
  const offer = selectedOffer || fallbackOffer;
  const details = offer ? displayOffer(offer) : null;
  const reviewCount = details?.reviewsCount || 0;
  const visibleRating = reviewCount > 0 ? Math.max(0, Math.min(5, Number(details?.rating || 0))) : 0;

  const signedInEmail = accessToken ? String(user?.email ?? "") : "";
  const savedPhone = accessToken ? String(user?.phone ?? "") : "";
  const phoneLocked = Boolean(accessToken && user?.is_phone_verified && savedPhone);
  const emailValue = signedInEmail || contactEmail;
  const phoneValue = savedPhone || contactPhone;

  const handleClaimClick = async () => {
    if (!consentNibbl || !consentBrand) {
      setRestriction({
        code: "consent_required",
        message: "Please agree to both Nibbl and brand email and SMS to claim this offer.",
      });
      return;
    }

    if (!accessToken) {
      if (!/^\S+@\S+\.\S+$/.test(contactEmail.trim())) {
        setMessage("Enter your email to reserve this offer.");
        return;
      }
      setSendingCode(true);
      setMessage("");
      try {
        await nibblApi.requestEmailCode(contactEmail.trim(), true);
        setCodeSentTo(contactEmail.trim());
        setIsModalOpen(true);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Could not send the code.");
      } finally {
        setSendingCode(false);
      }
      return;
    }

    if (!(campaignId || details?.id)) {
      setMessage("No backend campaign id was found for this offer.");
      return;
    }
    if (slots && slots.available <= 0) {
      setRestriction({
        code: "slots_full",
        message: `You're using all ${slots.limit} claim slots. Submit a receipt or wait for one to clear before claiming another offer.`,
      });
      return;
    }
    // The 7-day window starts when the shopper confirms (Master).
    setConfirmDeadline(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
  };

  const confirmReservation = async () => {
    const id = campaignId || details?.id;
    if (!id) return;
    setReserving(true);
    try {
      const reservation = await claimOffer(id, {
        consent_nibbl: consentNibbl,
        consent_brand: consentBrand,
        ...(!savedPhone && contactPhone.trim() ? { contact_phone: contactPhone.trim(), phone_country: "US" } : {}),
      });
      const reservationId = String(reservation.id || reservation.reservation || "");
      setMessage("Offer claimed. Upload your receipt to complete the reward.");
      onTabChange("scan", reservationId ? `claim:${reservationId}` : undefined);
    } catch (error) {
      const backendMessage = useConsumerApiStore.getState().error;
      const code = error instanceof ApiError ? (error.data as { code?: string } | null)?.code : undefined;
      if (code && RESTRICTION_TITLES[code]) {
        setRestriction({ code, message: backendMessage || "This offer can't be claimed right now." });
        setMessage("");
        return;
      }
      setMessage(backendMessage || "Could not claim this offer.");
    } finally {
      setReserving(false);
      setConfirmDeadline(null);
    }
  };

  return (
    <div className="w-full bg-[#FEFEFE] min-h-screen flex flex-col font-sans select-none relative">
      {/* Header */}
      <Header activeTab="offer" onTabChange={onTabChange} unreadCount={unreadCount} />

      {/* Main Page Layout Wrapper */}
      <main className="flex-grow flex flex-col items-center py-10 px-4 sm:px-6 max-w-[1440px] mx-auto w-full relative">
        {/* Offer headline (the brand's shopper wording — never the internal campaign name) */}
        <h1 className="text-[32px] font-bold text-[#1F1D1D] text-center mb-6 mt-4">
          {details?.headline || details?.title || "Offer Details"}
        </h1>
        {details?.goingFast && (
          <span className="-mt-4 mb-6 rounded-full bg-[#FFF1E6] px-3 py-1 text-[13px] font-semibold text-[#E0700B]">
            Going fast
          </span>
        )}

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

              {/* Offer eligibility: featured retailers, receipt retailer rule, where to buy, cooldown */}
              <div className="w-full max-w-[335px] flex flex-col gap-1 rounded-lg bg-[#F5F5FD] px-3 py-2 text-left text-[12px] leading-[16px] text-[#4D4D4D]">
                {details && details.featuredRetailers.length > 0 && (
                  <p className="font-semibold text-[#1F1D1D]">Available at {details.featuredRetailers.join(", ")}</p>
                )}
                <p>{details?.retailerWording}</p>
                {details && details.whereToBuy.length > 0 && <p>Where to buy: {details.whereToBuy.join(", ")}</p>}
                <p>{details?.cooldownWording}</p>
              </div>

              {/* Eligible products */}
              {details && details.products.length > 1 && (
                <div className="w-full max-w-[335px] flex gap-2 overflow-x-auto pb-1">
                  {details.products.map((product) => (
                    <div key={product.id} className="min-w-[90px] rounded-lg border border-gray-100 p-2 flex flex-col items-center gap-1">
                      <div className="relative h-12 w-12 overflow-hidden rounded bg-gray-50">
                        {product.image && <Image src={product.image} alt={product.name} fill sizes="48px" className="object-contain" />}
                      </div>
                      <span className="text-center text-[11px] leading-[13px] text-[#1F1D1D]">{product.name}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Marketing consents — two separate checkboxes, both required (Master: Reserve Offer) */}
              <div className="w-full max-w-[335px] flex flex-col gap-2 text-left">
                <p className="text-[12px] text-[#4D4D4D]">
                  We&apos;ll use your contact info to reserve your offer, check eligibility and send important claim updates.
                </p>
                <input type="email" value={emailValue} readOnly={Boolean(signedInEmail)}
                  onChange={(e) => setContactEmail(e.target.value)} placeholder="Email"
                  className={`h-10 px-3 rounded-lg border border-gray-300 text-sm ${signedInEmail ? "bg-gray-50 text-gray-500" : ""}`} />
                <input type="tel" value={phoneValue} readOnly={Boolean(savedPhone)}
                  onChange={(e) => setContactPhone(e.target.value)} placeholder="Mobile phone (e.g. +1 512 555 0123)"
                  title={phoneLocked ? "Your verified phone is locked. Change it from Profile." : undefined}
                  className={`h-10 px-3 rounded-lg border border-gray-300 text-sm ${savedPhone ? "bg-gray-50 text-gray-500" : ""}`} />
                {slots && (
                  <div className="flex items-center justify-between gap-2 text-[13px] text-[#4D4D4D]">
                    <span>{slots.used} of {slots.limit} claim slots used</span>
                    <span className="flex gap-1">
                      {Array.from({ length: slots.limit }, (_, i) => (
                        <span key={i} className={`w-3 h-3 rounded-full ${i < slots.used ? "bg-[#3E3EDF]" : "border border-[#3E3EDF]"}`} />
                      ))}
                    </span>
                  </div>
                )}
                <label className="flex items-start gap-2 text-[12px] leading-[16px] text-[#4D4D4D] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consentNibbl}
                    onChange={(e) => setConsentNibbl(e.target.checked)}
                    className="mt-[2px] accent-[#3E3EDF]"
                  />
                  <span>Send me NibblAI offers and updates by email and SMS. <span className="text-[#E65353]">*</span></span>
                </label>
                <label className="flex items-start gap-2 text-[12px] leading-[16px] text-[#4D4D4D] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consentBrand}
                    onChange={(e) => setConsentBrand(e.target.checked)}
                    className="mt-[2px] accent-[#3E3EDF]"
                  />
                  <span>
                    Send me offers and updates from {details?.brand || "this brand"} by email and SMS.{" "}
                    <span className="text-[#E65353]">*</span>
                  </span>
                </label>
              </div>

              {/* CTA Large Claim button (Frame 2147229219) */}
              {details?.unavailableReason && (
                <p className="text-center text-[13px] font-medium text-[#E65353]">{details.unavailableReason}</p>
              )}
              <button
                onClick={handleClaimClick}
                disabled={Boolean(details?.unavailableReason) || sendingCode}
                className="w-full max-w-[197px] h-[46px] bg-gradient-to-b from-[#3E3EDF] to-[#3E3EDF] hover:opacity-90 active:scale-[0.98] text-[#FEFEFE] text-[16px] font-medium leading-[24px] rounded-lg shadow-[0_4px_4px_rgba(0,0,0,0.12),inset_0_4px_4px_rgba(255,255,255,0.12)] flex items-center justify-center cursor-pointer transition-all focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              >
                {details?.unavailableReason ? "Not available" : sendingCode ? "Sending code…" : "Continue"}
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

      {/* Master ⑤ Confirm Reservation */}
      {confirmDeadline && details && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-[440px] bg-white rounded-[16px] p-6 flex flex-col gap-4">
            <div>
              <h3 className="text-[20px] font-semibold text-[#1F1D1D]">Confirm your reservation</h3>
              {slots && (
                <p className="text-[13px] text-[#575757]">This will use slot {slots.used + 1} of {slots.limit}.</p>
              )}
            </div>
            <div className="flex items-center gap-3 border border-gray-100 rounded-[10px] p-3">
              {details.products[0]?.image && (
                <div className="relative w-14 h-14 rounded-[8px] overflow-hidden bg-gray-50 flex-shrink-0">
                  <Image src={details.products[0].image} alt="" fill sizes="56px" className="object-contain" />
                </div>
              )}
              <div className="flex flex-col">
                <span className="text-[12px] text-[#8A8A8A]">{details.brand}</span>
                <span className="text-[15px] font-medium text-[#1F1D1D]">
                  {details.products.length === 1 ? details.products[0].name : details.headline || details.title}
                </span>
                <span className="self-start mt-1 text-[13px] font-medium text-[#3E3EDF] bg-[#EEF0FF] rounded-full px-2 py-0.5">
                  {details.rewardLabel}
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-3 text-[14px]">
              <div>
                <div className="font-medium text-[#1F1D1D]">Purchase at</div>
                <div className="text-[#575757]">{details.retailerWording}</div>
              </div>
              <div>
                <div className="font-medium text-[#E65353]">
                  Purchase and submit receipt by{" "}
                  {confirmDeadline.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                </div>
                <div className="text-[#575757]">7 days from now. Your receipt date must be today or later.</div>
              </div>
              {slots && (
                <div className="text-[#575757]">
                  This will use slot {slots.used + 1} of {slots.limit}. You&apos;ll have {Math.max(slots.available - 1, 0)}{" "}
                  remaining slot{slots.available - 1 === 1 ? "" : "s"} after this reservation.
                </div>
              )}
            </div>
            <button disabled={reserving} onClick={() => void confirmReservation()}
              className="h-11 rounded-[10px] bg-[#3E3EDF] text-white text-[15px] font-medium cursor-pointer disabled:opacity-50">
              {reserving ? "Reserving…" : "Confirm & Reserve"}
            </button>
            <button disabled={reserving} onClick={() => setConfirmDeadline(null)}
              className="h-11 rounded-[10px] bg-[#EEF0FF] text-[#3E3EDF] text-[15px] font-medium cursor-pointer">
              Back
            </button>
          </div>
        </div>
      )}

      {/* Logged out: confirm the email with a 6-digit code (signs in or creates the account) */}
      {isModalOpen && (
        <div onClick={() => setIsModalOpen(false)}
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[380px] bg-white rounded-2xl shadow-[0px_4px_23.6px_rgba(0,0,0,0.12)] p-6 sm:p-8 flex flex-col gap-4 border border-gray-100">
            <h3 className="text-[22px] font-bold text-[#1F1D1D] text-center">Check your email</h3>
            <EmailCodeForm initialEmail={codeSentTo} codeSent create phone={contactPhone.trim()} phoneCountry="US"
              onSignedIn={() => {
                setIsModalOpen(false);
                setMessage("");
                // Signed in: continue to Confirm Reservation (the slot is used only on Confirm & Reserve).
                setConfirmDeadline(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
              }}
              onCancel={() => setIsModalOpen(false)} />
            <button onClick={() => onNavigate("signin")} className="text-xs text-[#3E3EDF] font-medium cursor-pointer">
              Have a password? Sign in instead
            </button>
          </div>
        </div>
      )}
      {restriction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-[400px] bg-white rounded-[16px] p-6 flex flex-col gap-3 text-center">
            <h3 className="text-[18px] font-semibold text-[#1F1D1D]">{RESTRICTION_TITLES[restriction.code]}</h3>
            <p className="text-[14px] text-[#575757]">{restriction.message}</p>
            <div className="flex gap-2 mt-1">
              {restriction.code === "consent_required" ? (
                <button onClick={() => setRestriction(null)}
                  className="flex-1 h-11 rounded-lg bg-[#3E3EDF] text-white text-sm font-semibold cursor-pointer">OK</button>
              ) : restriction.code === "slots_full" || restriction.code === "already_claimed" ? (
                <button onClick={() => { setRestriction(null); onTabChange("scan"); }}
                  className="flex-1 h-11 rounded-lg bg-[#3E3EDF] text-white text-sm font-semibold cursor-pointer">View My Offers</button>
              ) : (
                <button onClick={() => { setRestriction(null); onBack(); }}
                  className="flex-1 h-11 rounded-lg bg-[#3E3EDF] text-white text-sm font-semibold cursor-pointer">Explore More Offers</button>
              )}
              <button onClick={() => setRestriction(null)}
                className="flex-1 h-11 rounded-lg border border-gray-200 text-sm font-semibold text-[#575757] cursor-pointer">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
