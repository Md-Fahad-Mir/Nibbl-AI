"use client";

interface EarnMoreCardProps {
  opportunities?: Record<string, unknown>[];
  onStartReviewClick: (opportunity: Record<string, unknown>) => void;
}

export default function EarnMoreCard({ opportunities = [], onStartReviewClick }: EarnMoreCardProps) {
  const reviews = opportunities.length
    ? opportunities.map((item) => ({
        id: String(item.id),
        name: String(item.product_name || "Review opportunity"),
        brand: String(item.brand_name || ""),
        reward: formatRewardAmount(item.reward_amount || "1.00"),
        opportunity: item,
      }))
    : [];

  return (
    <section className="w-full max-w-[669px] bg-[#E8E8FF] shadow-[0px_4px_8px_rgba(0,0,0,0.25)] rounded-[12px] p-6 sm:py-[12px] sm:px-[18px] flex flex-col gap-[7px] border border-[#d2d2f7]">
      {/* Title block (Frame 2147229169 / 2147229170) */}
      <div className="flex flex-col items-center gap-[1px] w-full text-center py-1">
        <span className="text-[18px] font-medium leading-[22px] text-[#2D2D2D]">
          Want to earn more?
        </span>
        <span className="text-[12px] font-normal leading-[15px] text-[#575757] max-w-[373px] mx-auto mt-0.5">
          Complete quick reviews from verified receipts and earn extra rewards
        </span>
      </div>

      {/* Review items mapping */}
      <div className="flex flex-col w-full mt-2">
        {reviews.length ? reviews.map((item) => (
          <div
            key={item.id}
            className="w-full min-h-[47px] border-b border-[#E0E0E0] last:border-b-0 flex items-center justify-between py-[10px] gap-3"
          >
            <div className="min-w-0 flex flex-col gap-0.5">
              <span className="text-[14px] font-medium leading-[17px] text-[#1F1D1D] truncate">
                {item.name}
              </span>
              <span className="text-[12px] font-normal leading-[15px] text-[#575757] truncate">
                {item.brand ? `${item.brand} review invitation` : "Review invitation"}
              </span>
            </div>
            <button
              onClick={() => onStartReviewClick(item.opportunity)}
              className="min-w-[112px] h-[27px] bg-[#3E3EDF] text-white text-[12px] font-medium rounded-[4px] hover:bg-[#3232c7] active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center px-3"
            >
              Review for {item.reward}
            </button>
          </div>
        )) : (
          <div className="w-full h-[47px] border-b border-[#E0E0E0] last:border-b-0 flex items-center py-[10px]">
            <span className="text-[14px] font-normal leading-[17px] text-[#575757]">
              No review opportunities from the backend.
            </span>
          </div>
        )}
      </div>
    </section>
  );
}

const formatRewardAmount = (value: unknown) => {
  const amount = String(value || "1.00");
  return amount.startsWith("$") ? amount : `$${amount}`;
};
