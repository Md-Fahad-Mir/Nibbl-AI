"use client";

interface ReceiptItem {
  title: string;
  date: string;
  status: "Verified" | "Pending" | "Rejected";
}

interface ReceiptHistoryCardProps {
  receipts: ReceiptItem[];
}

export default function ReceiptHistoryCard({ receipts }: ReceiptHistoryCardProps) {
  const statusColors = {
    Verified: "text-[#00A671]",
    Pending: "text-[#D7930A]",
    Rejected: "text-[#FF5C5C]",
  };

  return (
    <section className="w-full max-w-[669px] bg-[#FEFEFE] shadow-[0px_4px_8px_rgba(0,0,0,0.25)] rounded-[12px] p-6 sm:py-[12px] sm:px-[18px] flex flex-col gap-[7px] border border-gray-100">
      {/* Title block */}
      <div className="flex items-center gap-[6px] h-6">
        <span className="w-6 h-6 flex-shrink-0 text-[#2D2D2D] flex items-center justify-center">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
          </svg>
        </span>
        <span className="text-[18px] font-medium leading-[22px] text-[#2D2D2D]">
          Receipt History
        </span>
      </div>

      {/* Receipts items mapping */}
      <div className="flex flex-col w-full">
        {receipts.length ? receipts.map((receipt, idx) => (
          <div
            key={idx}
            className="w-full h-[65px] border-b border-[#E0E0E0] last:border-b-0 flex items-center justify-between py-[10px]"
          >
            {/* Left side text stack */}
            <div className="flex flex-col gap-[4px] min-w-0">
              <span className="text-[16px] font-medium leading-[24px] text-[#1F1D1D] truncate">
                {receipt.title}
              </span>
              <span className="text-[14px] font-normal leading-[17px] text-[#575757]">
                {receipt.date}
              </span>
            </div>

            {/* Right side status badge */}
            <div className="w-[72px] h-[29px] flex items-center justify-end">
              <span className={`text-[14px] font-semibold leading-[17px] ${statusColors[receipt.status]} text-right`}>
                {receipt.status}
              </span>
            </div>
          </div>
        )) : (
          <div className="w-full min-h-[65px] border-b border-[#E0E0E0] last:border-b-0 flex items-center py-[10px]">
            <span className="text-[14px] font-normal leading-[17px] text-[#575757]">
              No receipt history from the backend.
            </span>
          </div>
        )}
      </div>

      {/* Bottom Description */}
      <span className="text-[12px] font-normal leading-[15px] text-[#575757] mt-1">
        Recent receipts are shown below- view update status anytime.
      </span>
    </section>
  );
}
