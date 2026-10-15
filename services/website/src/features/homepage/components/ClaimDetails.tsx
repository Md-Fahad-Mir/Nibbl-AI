"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Header from "./Header";
import Footer from "./Footer";
import { useConsumerApiStore } from "@/stores/useConsumerApiStore";
import { ApiError, nibblApi } from "@/lib/api/backendApi";
import { displayOffer } from "../lib/offerMappers";
import EmailCodeForm from "@/features/auth/components/EmailCodeForm";
import { AlertTriangle, CalendarDays, CheckCircle2, ChevronRight, Clock, Flame, Info, Layers, Mail, Package, PauseCircle, Receipt, Share2, ShoppingCart, Star, Store, Tag, Trophy, User, X, type LucideIcon } from "lucide-react";
import { referralLink } from "@/lib/referral";
import ProductReviews from "./ProductReviews";

// Master "Rebate Restriction Pop-ups" (RB-33). Title / message / note come
// from the API (`title`, `message`, `note`, `days_remaining`); these are the
// icons and the codes we know.
const RESTRICTION_ICONS: Record<string, LucideIcon> = {
  consent_required: Mail,
  slots_full: Layers,
  already_claimed: User,
  cooldown: Clock,
  one_time_redeemed: CheckCircle2,
  not_started: CalendarDays,
  paused_or_ended: PauseCircle,
  capacity_reached: Trophy,
  unavailable: AlertTriangle,
  retailer_required: Store,
};

type Restriction = {
  code: string; title: string; message: string; note?: string; days?: number | null; retailers?: string[];
};

interface ClaimDetailsProps {
  campaignId?: string;
  onBack: () => void;
  onNavigate: (stage: "signin" | "signup") => void;
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
  const [restriction, setRestrictionState] = useState<Restriction | null>(null);
  const [showRetailers, setShowRetailers] = useState(false);
  const setRestriction = (value: Restriction | null) => {
    setShowRetailers(false);
    setRestrictionState(value);
  };
  const latestError = useConsumerApiStore((state) => state.error);
  // Master ④/⑤: personal claim-slot use, and a separate confirmation screen
  // (the slot is only consumed on Confirm & Reserve).
  const [slots, setSlots] = useState<{ used: number; limit: number; available: number } | null>(null);
  const [confirmDeadline, setConfirmDeadline] = useState<Date | null>(null);
  const [reserving, setReserving] = useState(false);
  // Master ③ Campaign Details → ④ Reserve Offer sheet → ⑤ Confirm Reservation.
  const [reserveOpen, setReserveOpen] = useState(false);
  const [shareMessage, setShareMessage] = useState("");

  const loadedCampaign = String(selectedOffer?.campaign_id ?? "");
  useEffect(() => {
    // Signed in: always refresh (claim state). Logged out: load only if the
    // deal isn't already here (a deal link loads it via its public link).
    if (campaignId && (accessToken || loadedCampaign !== campaignId)) void loadOfferDetails(campaignId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadedCampaign only gates the first load
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

  const signedInEmail = accessToken ? String(user?.email ?? "") : "";
  const savedPhone = accessToken ? String(user?.phone ?? "") : "";
  const phoneLocked = Boolean(accessToken && user?.is_phone_verified && savedPhone);
  const emailValue = signedInEmail || contactEmail;
  const phoneValue = savedPhone || contactPhone;

  const handleClaimClick = async () => {
    if (!consentNibbl || !consentBrand) {
      setRestriction({
        code: "consent_required",
        title: "Consent required",
        message: `You must provide email and phone and accept both Nibbl and ${details?.brand || "the brand"} email/SMS consent to reserve this offer.`,
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
      setMessage("This offer is no longer available.");
      return;
    }
    if (slots && slots.available <= 0) {
      setRestriction({
        code: "slots_full",
        title: `All ${slots.limit} claim slots are in use`,
        message: "Submit a receipt for an active offer or wait for a claim to close before reserving another.",
      });
      return;
    }
    // The 7-day window starts when the shopper confirms (Master).
    setReserveOpen(false);
    setConfirmDeadline(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
  };

  // Master: share a specific deal with your referral link.
  const handleShareDeal = async () => {
    const code = typeof user?.referral_code === "string" ? user.referral_code : "";
    const id = campaignId || details?.id;
    if (!code || !id) {
      setShareMessage("Sign in to share this deal with your referral link.");
      return;
    }
    await navigator.clipboard.writeText(referralLink(code, String(id)));
    setShareMessage("Deal link copied — friends who join with it count as your referral.");
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
      const data = (error instanceof ApiError ? error.data : null) as Record<string, unknown> | null;
      const code = data?.code ? String(data.code) : undefined;
      if (code && RESTRICTION_ICONS[code]) {
        setRestriction({
          code,
          title: String(data?.title || "This offer can't be claimed"),
          message: String(data?.message || backendMessage || "This offer can't be claimed right now."),
          note: data?.note ? String(data.note) : undefined,
          days: typeof data?.days_remaining === "number" ? data.days_remaining : null,
        });
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

      <main className="flex-grow w-full max-w-[640px] mx-auto px-4 py-6 flex flex-col gap-5">
        <button onClick={onBack} className="self-start text-[#3E3EDF] text-sm font-medium cursor-pointer">
          &larr; Back to Offers
        </button>

        {/* ① Campaign image */}
        <div className="relative w-full aspect-[16/10] rounded-[16px] overflow-hidden bg-[#F2F3FF] flex items-center justify-center">
          {details?.image ? (
            <Image src={details.image} alt={details.headline || "Offer image"} fill sizes="640px" className="object-cover" />
          ) : (
            <Package className="w-12 h-12 text-[#B8B8D9]" />
          )}
        </div>

        {/* ② Brand, headline, description, reward */}
        <div className="flex flex-col gap-2 text-center items-center">
          {details?.brand && <span className="text-[12px] font-semibold tracking-wide uppercase text-[#575757]">{details.brand}</span>}
          <h1 className="text-[24px] sm:text-[28px] font-bold leading-tight text-[#1F1D1D]">
            {details?.headline || details?.title || "Offer Details"}
          </h1>
          {details?.description && <p className="text-[15px] text-[#4D4D4D]">{details.description}</p>}
          {details?.rewardLabel && (
            <span className="mt-1 rounded-lg bg-[#EEEAFE] px-4 py-1.5 text-[16px] font-semibold text-[#3E3EDF]">
              {details.rewardLabel.startsWith("Up to") ? details.rewardLabel.replace("Up to", "Free up to") : details.rewardLabel}
            </span>
          )}
        </div>

        {/* ③ Eligible products (each keeps its own rating) */}
        {details && details.products.length > 0 && (
          <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h2 className="text-[16px] font-semibold text-[#3E3EDF]">Eligible Products</h2>
              <span className="text-[13px] text-[#575757]">{details.products.length} product{details.products.length === 1 ? "" : "s"}</span>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {details.products.map((product) => (
                <div key={product.id} className="min-w-[112px] max-w-[112px] flex flex-col items-center gap-1 text-center">
                  <div className="relative h-20 w-20 overflow-hidden rounded-lg bg-gray-50">
                    {product.image ? (
                      <Image src={product.image} alt={product.name} fill sizes="80px" className="object-contain" />
                    ) : (
                      <Package className="absolute inset-0 m-auto w-7 h-7 text-[#B8B8D9]" />
                    )}
                  </div>
                  <span className="text-[12px] font-medium leading-[15px] text-[#1F1D1D]">{product.name}</span>
                  {product.variant && <span className="text-[11px] text-[#575757]">{product.variant}</span>}
                  <span className="text-[11px] text-[#575757] inline-flex items-center gap-0.5">
                    {product.reviewCount > 0 ? (
                      <>
                        <Star className="w-3 h-3 fill-[#FFB701] text-[#FFB701]" /> {Number(product.rating ?? 0).toFixed(1)} · {product.reviewCount} reviews
                      </>
                    ) : "No reviews yet"}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ④ Offer terms */}
        {details && (
          <section className="flex flex-col divide-y divide-gray-100 rounded-[12px] border border-gray-100">
            {([
              [ShoppingCart, "Where to Buy",
                (details.featuredRetailers.length ? details.featuredRetailers : details.whereToBuy).join(", ") || "Any store that sells the eligible products",
                null],
              [Receipt, "Receipt Eligibility", details.requiredRetailers.length ? `Required: ${details.requiredRetailers.join(", ")}` : "Any retailer",
                details.requiredRetailers.length
                  ? () => setRestriction({
                      code: "retailer_required",
                      title: "Receipt from an eligible retailer required",
                      message: "This campaign requires a receipt from one of the participating retailers.",
                      retailers: details.requiredRetailers,
                    })
                  : null],
              [Tag, details.rewardLabel.startsWith("Up to") ? "Maximum Rebate" : "Reward", details.rewardLabel, null],
              [Info, "Offer Eligibility", details.cooldownWording, null],
            ] as [LucideIcon, string, string, (() => void) | null][]).map(([Icon, label, value, onClick]) => (
              <button key={label} type="button" onClick={onClick ?? undefined} disabled={!onClick}
                className="flex items-center gap-3 px-4 py-3 text-left disabled:cursor-default cursor-pointer">
                <Icon className="w-5 h-5 text-[#3E3EDF] flex-shrink-0" />
                <span className="flex-1 min-w-0">
                  <span className="block text-[14px] font-semibold text-[#1F1D1D]">{label}</span>
                  <span className="block text-[13px] text-[#575757]">{value}</span>
                </span>
                {onClick && <ChevronRight className="w-4 h-4 text-[#9A9AB0]" />}
              </button>
            ))}
          </section>
        )}

        {details?.goingFast && (
          <span className="self-center flex items-center gap-1 rounded-lg bg-[#FFF1E6] px-3 py-1.5 text-[13px] font-semibold text-[#E0700B]">
            <Flame className="w-4 h-4" /> Going fast
          </span>
        )}

        {details?.unavailableReason && (
          <p className="text-center text-[13px] font-medium text-[#E65353]">{details.unavailableReason}</p>
        )}
        <button
          onClick={() => { setMessage(null); setReserveOpen(true); }}
          disabled={Boolean(details?.unavailableReason) || !details}
          className="w-full h-12 rounded-[10px] bg-[#3E3EDF] hover:opacity-90 text-white text-[16px] font-semibold cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
        >
          {details?.unavailableReason ? "Not available" : "Claim This Offer"}
        </button>
        {message && !reserveOpen && (
          <p className={`text-center text-[13px] font-medium ${status === "error" ? "text-[#E65353]" : "text-[#00A671]"}`}>{message}</p>
        )}

        <button type="button" onClick={() => void handleShareDeal()}
          className="self-center flex items-center gap-2 text-[14px] font-medium text-[#3E3EDF] cursor-pointer">
          <Share2 className="w-4 h-4" /> Share this deal with a friend
        </button>
        {shareMessage && <p className="text-center text-[13px] text-[#00A671]">{shareMessage}</p>}

        {details?.products[0] && <ProductReviews productId={details.products[0].id} />}
      </main>

      {/* Footer */}
      <Footer onTabChange={onTabChange} />

      {/* Master ④ Reserve Offer */}
      {reserveOpen && details && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 sm:p-4" onClick={() => setReserveOpen(false)}>
          <div className="w-full max-w-[440px] bg-white rounded-t-[20px] sm:rounded-[16px] p-6 flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-[20px] font-semibold text-[#1F1D1D]">Reserve this offer</h3>
                {slots && <p className="text-[13px] text-[#575757]">{slots.used} of {slots.limit} claim slots used</p>}
              </div>
              <button onClick={() => setReserveOpen(false)} aria-label="Close" className="text-gray-400 hover:text-gray-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            {slots && (
              <span className="flex gap-1.5">
                {Array.from({ length: slots.limit }, (_, i) => (
                  <span key={i} className={`w-3.5 h-3.5 rounded-full ${i < slots.used ? "bg-[#3E3EDF]" : "border border-[#3E3EDF]"}`} />
                ))}
              </span>
            )}
            <p className="text-[13px] text-[#4D4D4D]">
              We&apos;ll use your contact info to reserve your offer, check eligibility and send important claim updates.
            </p>
            <label className="relative">
              <Mail className="w-4 h-4 text-[#9A9AB0] absolute left-3 top-1/2 -translate-y-1/2" />
              <input type="email" value={emailValue} readOnly={Boolean(signedInEmail)}
                onChange={(e) => setContactEmail(e.target.value)} placeholder="Email"
                className={`w-full h-11 pl-9 pr-3 rounded-lg border border-gray-300 text-sm ${signedInEmail ? "bg-gray-50 text-gray-500" : ""}`} />
            </label>
            <input type="tel" value={phoneValue} readOnly={Boolean(savedPhone)}
              onChange={(e) => setContactPhone(e.target.value)} placeholder="Mobile phone (e.g. +1 512 555 0123)"
              title={phoneLocked ? "Your verified phone is locked. Change it from Profile." : undefined}
              className={`h-11 px-3 rounded-lg border border-gray-300 text-sm ${savedPhone ? "bg-gray-50 text-gray-500" : ""}`} />
            <label className="flex items-start gap-2 text-[13px] leading-[17px] text-[#1F1D1D] cursor-pointer">
              <input type="checkbox" checked={consentNibbl} onChange={(e) => setConsentNibbl(e.target.checked)} className="mt-[2px] accent-[#3E3EDF]" />
              <span><b>Nibbl email &amp; SMS (required)</b><br /><span className="text-[#575757]">Get claim updates and reminders about your offers.</span></span>
            </label>
            <label className="flex items-start gap-2 text-[13px] leading-[17px] text-[#1F1D1D] cursor-pointer">
              <input type="checkbox" checked={consentBrand} onChange={(e) => setConsentBrand(e.target.checked)} className="mt-[2px] accent-[#3E3EDF]" />
              <span><b>{details.brand} email &amp; SMS (required)</b><br /><span className="text-[#575757]">Get offers, product news and updates from {details.brand}.</span></span>
            </label>
            {message && <p className="text-[13px] font-medium text-[#E65353]">{message}</p>}
            {latestError && status === "error" && latestError !== message && (
              <p className="text-[13px] font-medium text-[#E65353]">{latestError}</p>
            )}
            <button onClick={() => void handleClaimClick()} disabled={sendingCode}
              className="h-12 rounded-[10px] bg-[#3E3EDF] text-white text-[16px] font-semibold cursor-pointer disabled:opacity-50">
              {sendingCode ? "Sending code…" : "Continue"}
            </button>
          </div>
        </div>
      )}

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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setRestriction(null)}>
          <div className="relative w-full max-w-[380px] bg-white rounded-[16px] p-6 flex flex-col items-center gap-3 text-center"
            onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setRestriction(null)} aria-label="Close"
              className="absolute right-4 top-3 text-gray-400 hover:text-gray-600 cursor-pointer"><X className="w-5 h-5" /></button>
            <span className="w-14 h-14 rounded-full bg-[#EEF0FF] flex items-center justify-center text-2xl">
              {(() => {
                const Icon = RESTRICTION_ICONS[restriction.code] ?? AlertTriangle;
                return <Icon className="w-7 h-7 text-[#3E3EDF]" />;
              })()}
            </span>
            <h3 className="text-[18px] font-semibold text-[#1F1D1D]">{restriction.title}</h3>
            <p className="text-[14px] text-[#575757]">{restriction.message}</p>
            {restriction.code === "cooldown" && restriction.days ? (
              <div className="w-full rounded-lg bg-[#EEF0FF] py-2">
                <div className="text-[26px] font-bold text-[#1F1D1D]">{restriction.days}</div>
                <div className="text-[12px] text-[#575757]">days remaining</div>
              </div>
            ) : null}
            {restriction.note && (
              <p className="w-full rounded-lg bg-[#F5F6FA] px-3 py-2 text-[12px] text-[#575757] flex gap-1.5 text-left"><Info className="w-4 h-4 flex-shrink-0 mt-px" /> {restriction.note}</p>
            )}
            <div className="w-full flex flex-col gap-2 mt-1">
              {restriction.code === "retailer_required" ? (
                showRetailers ? (
                  <p className="rounded-lg bg-[#F5F6FA] px-3 py-2 text-[13px] text-[#1F1D1D]">{(restriction.retailers || []).join(", ")}</p>
                ) : (
                  <button onClick={() => setShowRetailers(true)}
                    className="h-11 rounded-lg bg-[#3E3EDF] text-white text-sm font-semibold cursor-pointer">View Eligible Retailers</button>
                )
              ) : restriction.code === "consent_required" ? (
                <button onClick={() => setRestriction(null)}
                  className="h-11 rounded-lg bg-[#3E3EDF] text-white text-sm font-semibold cursor-pointer">Review &amp; Accept</button>
              ) : restriction.code === "slots_full" || restriction.code === "already_claimed" ? (
                <button onClick={() => { setRestriction(null); onTabChange("scan"); }}
                  className="h-11 rounded-lg bg-[#3E3EDF] text-white text-sm font-semibold cursor-pointer">View My Offers</button>
              ) : (
                <>
                  <button onClick={() => { setRestriction(null); onBack(); }}
                    className="h-11 rounded-lg bg-[#3E3EDF] text-white text-sm font-semibold cursor-pointer">Explore More Offers</button>
                  {restriction.code === "capacity_reached" && accessToken && (
                    <button onClick={() => { setRestriction(null); onTabChange("scan"); }}
                      className="h-11 rounded-lg border border-[#3E3EDF] text-[#3E3EDF] text-sm font-semibold cursor-pointer">View My Offers</button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
