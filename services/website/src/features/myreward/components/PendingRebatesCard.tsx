"use client";

import Image from "next/image";

interface PendingRebatesCardProps {
  reservations?: Record<string, unknown>[];
  receipts?: Record<string, unknown>[];
  selectedReservationId?: string | null;
  selectedMessage?: string | null;
  selectedMessageTone?: "success" | "error";
  onUploadReceiptClick: (reservationId: string) => void;
}

export default function PendingRebatesCard({
  reservations = [],
  receipts = [],
  selectedReservationId,
  selectedMessage,
  selectedMessageTone = "success",
  onUploadReceiptClick,
}: PendingRebatesCardProps) {
  const pendingReceipts = receipts.filter((receipt) =>
    ["pending", "manual_review", "processing"].includes(
      String(receipt.status || "").toLowerCase()
    )
  );
  const hasPendingItems = reservations.length > 0 || pendingReceipts.length > 0;

  return (
    <section className="w-full max-w-[669px] bg-[#FEFEFE] shadow-[0px_4px_8px_rgba(0,0,0,0.25)] rounded-[12px] p-6 sm:py-[12px] sm:px-[18px] flex flex-col gap-[7px] border border-gray-100">
      {/* Title block (Frame 2147229169) */}
      <div className="flex items-center gap-[6px] h-6">
        <div className="w-6 h-6 flex-shrink-0 flex items-center justify-center relative">
          <Image
            src="/myreward/watch-01.svg"
            alt="watch-icon"
            width={24}
            height={24}
            className="object-contain"
          />
        </div>
        <span className="text-[18px] font-medium leading-[22px] text-[#2D2D2D]">
          Active Claim
        </span>
      </div>

      {hasPendingItems ? (
        <>
      {reservations.slice(0, 3).map((reservation) => {
        const reservationId = String(reservation.id || "");
        const isSelected = selectedReservationId === reservationId;

        return (
          <div key={reservationId} className="w-full border-b border-[#E0E0E0] py-[10px]">
            <div className="flex items-center justify-between gap-4">
              <span className="text-[14px] font-normal leading-[17px] text-[#1F1D1D] truncate">
                {String(reservation.campaign_name || reservation.product_name || "Pending rebate")}
              </span>
              <button
                onClick={() => onUploadReceiptClick(reservationId)}
                className={`w-[114px] h-[29px] text-white text-[14px] font-normal rounded-[4px] active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center flex-shrink-0 ${
                  isSelected
                    ? "bg-[#2727AA]"
                    : "bg-[#3E3EDF] hover:bg-[#3232c7]"
                }`}
              >
                Upload Receipt
              </button>
            </div>
            {isSelected && selectedMessage && (
              <p className={`mt-2 text-[12px] font-medium ${selectedMessageTone === "error" ? "text-[#E65353]" : "text-[#00A671]"}`}>
                {selectedMessage}
              </p>
            )}
          </div>
        );
      })}
      {pendingReceipts.slice(0, 3).map((receipt) => (
        <div key={String(receipt.id || receipt.created_at)} className="w-full border-b border-[#E0E0E0] py-[10px]">
          <div className="flex items-center justify-between gap-4">
            <span className="text-[14px] font-normal leading-[17px] text-[#1F1D1D] truncate">
              {String(receipt.campaign_name || receipt.merchant || "Pending receipt")}
            </span>
            <span className="w-[134px] h-[29px] text-[#D7930A] bg-[#FFF7E6] text-[13px] font-medium rounded-[4px] flex items-center justify-center flex-shrink-0">
              Verification Pending
            </span>
          </div>
        </div>
      ))}
        </>
      ) : (
        <div className="w-full min-h-[49px] border-b border-[#E0E0E0] flex items-center py-[10px]">
          <span className="text-[14px] font-normal leading-[17px] text-[#575757]">
            No claims are waiting for receipt upload.
          </span>
        </div>
      )}

      {/* Bottom Description */}
      <span className="text-[12px] font-normal leading-[15px] text-[#575757] mt-1">
        Claimed offers stay here until a receipt is uploaded and verified.
      </span>
    </section>
  );
}
