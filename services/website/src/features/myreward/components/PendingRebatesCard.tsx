"use client";

/* eslint-disable @next/next/no-img-element */
import { CalendarDays, Clock, Package } from "lucide-react";

interface PendingRebatesCardProps {
  reservations?: Record<string, unknown>[];
  receipts?: Record<string, unknown>[];
  selectedReservationId?: string | null;
  selectedMessage?: string | null;
  selectedMessageTone?: "success" | "error";
  onUploadReceiptClick: (reservationId: string) => void;
}

const daysLeft = (value: unknown) => {
  const ms = Date.parse(String(value ?? "")) - Date.now();
  if (Number.isNaN(ms)) return "";
  if (ms <= 0) return "Expired";
  const days = Math.floor(ms / 86400000);
  if (days >= 1) return `${days} day${days === 1 ? "" : "s"} left`;
  return `${Math.max(1, Math.floor(ms / 3600000))}h left`;
};

const Thumb = ({ src, alt }: { src: unknown; alt: string }) => (
  <div className="w-[96px] h-[96px] flex-shrink-0 rounded-[10px] bg-[#F5F5FD] overflow-hidden flex items-center justify-center">
    {typeof src === "string" && src ? (
      <img src={src} alt={alt} className="w-full h-full object-cover" />
    ) : (
      <Package className="w-8 h-8 text-[#B8B8D9]" />
    )}
  </div>
);

/** Master My Offers: one card per active offer (days left + Submit Receipt),
 *  then receipts being checked. */
export default function PendingRebatesCard({
  reservations = [],
  receipts = [],
  selectedReservationId,
  selectedMessage,
  selectedMessageTone = "success",
  onUploadReceiptClick,
}: PendingRebatesCardProps) {
  const pendingReceipts = receipts.filter((receipt) =>
    ["pending", "manual_review", "processing"].includes(String(receipt.status || "").toLowerCase())
  );

  if (!reservations.length && !pendingReceipts.length) {
    return (
      <section className="w-full rounded-[12px] border border-gray-100 bg-white p-6 text-center text-[14px] text-[#575757]">
        No active offers. Claim an offer from For You to get started.
      </section>
    );
  }

  return (
    <section className="w-full flex flex-col gap-4" aria-label="My Offers">
      {reservations.map((reservation) => {
        const id = String(reservation.id || "");
        const title = String(reservation.offer_headline || reservation.campaign_name || reservation.product_name || "Your offer");
        const left = daysLeft(reservation.expires_at);
        const urgent = left === "Expired" || /h left$/.test(left) || /^[12] days? left$/.test(left);
        return (
          <article key={id} className="w-full rounded-[14px] bg-white shadow-[0px_2px_8px_rgba(0,0,0,0.10)] p-3 flex gap-4">
            <Thumb src={reservation.campaign_image_url} alt={title} />
            <div className="flex-1 min-w-0 flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold tracking-wide uppercase text-[#575757] truncate">
                {String(reservation.brand_name || "")}
              </span>
              <h3 className="text-[16px] font-semibold leading-tight text-[#1F1D1D] line-clamp-2">{title}</h3>
              {left && (
                <span className={`self-start flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-semibold ${
                  urgent ? "bg-[#FDECEC] text-[#E65353]" : "bg-[#F5F5FD] text-[#3E3EDF]"
                }`}>
                  <CalendarDays className="w-3.5 h-3.5" /> {left}
                </span>
              )}
              <button
                onClick={() => onUploadReceiptClick(id)}
                className={`mt-auto h-10 rounded-[10px] text-white text-[14px] font-semibold cursor-pointer ${
                  selectedReservationId === id ? "bg-[#2727AA]" : "bg-[#3E3EDF] hover:opacity-90"
                }`}
              >
                Submit Receipt
              </button>
              {selectedReservationId === id && selectedMessage && (
                <p className={`text-[12px] font-medium ${selectedMessageTone === "error" ? "text-[#E65353]" : "text-[#00A671]"}`}>
                  {selectedMessage}
                </p>
              )}
            </div>
          </article>
        );
      })}

      {pendingReceipts.map((receipt) => (
        <article key={String(receipt.id || receipt.created_at)}
          className="w-full rounded-[14px] bg-white border border-gray-100 p-3 flex items-center gap-3">
          <span className="w-10 h-10 rounded-full bg-[#FFF7E6] flex items-center justify-center flex-shrink-0">
            <Clock className="w-5 h-5 text-[#D7930A]" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-medium text-[#1F1D1D] truncate">
              {String(receipt.offer_headline || receipt.campaign_name || receipt.merchant || "Your receipt")}
            </p>
            <p className="text-[12px] text-[#575757]">
              {String(receipt.status) === "manual_review"
                ? "A person is checking your receipt — you'll hear back within 7 days."
                : "We're checking your receipt now."}
            </p>
          </div>
        </article>
      ))}

      <p className="text-[12px] text-[#575757] text-center">
        Your claim stays in My Offers and its slot stays used until your receipt is approved or finally rejected.
      </p>
    </section>
  );
}
