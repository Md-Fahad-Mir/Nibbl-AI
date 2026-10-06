interface RewardItem {
  id: string;
  title: string;
  amount: string;
  status: "verified" | "pending";
}

interface RecentRewardsCardProps {
  redemptions?: Record<string, unknown>[];
}

export default function RecentRewardsCard({ redemptions = [] }: RecentRewardsCardProps) {
  const rewards: RewardItem[] = redemptions.map((item) => ({
    id: String(item.id),
    title: String(item.campaign_name || item.brand_name || "Reward"),
    amount: `$${String(item.reward_amount || item.amount || "0.00")}`,
    status: item.status === "pending" ? "pending" : "verified",
  }));

  return (
    <div className="w-full max-w-[716px] bg-[#FEFEFE] shadow-[0px_4px_4px_rgba(0,0,0,0.12)] rounded-[12px] p-6 sm:py-[28px] sm:px-[12px] flex flex-col gap-[16px] border border-gray-100/60">
      
      {/* Recent Rewards Box (Frame 2147229178) */}
      <div className="w-full bg-[#F9F9F9] shadow-[-1px_4px_21.1px_rgba(0,0,0,0.15)] rounded-[12px] p-4 sm:p-[16px] flex flex-col gap-4">
        {/* Title */}
        <h3 className="text-[20px] font-medium leading-[24px] text-[#2D2D2D] text-left">
          Recent Rewards
        </h3>

        {/* List of items */}
        <div className="flex flex-col w-full">
          {rewards.length ? rewards.map((item) => (
            <div
              key={item.id}
              className="w-full h-[50px] border-b border-[#E0E0E0] last:border-b-0 flex items-center justify-between py-[10px] gap-4"
            >
              {/* Title */}
              <span className="text-[16px] font-normal leading-[19px] text-[#1F1D1D] truncate">
                {item.title}
              </span>

              {/* Amount and Icon Stack */}
              <div className="flex items-center gap-[8px] flex-shrink-0">
                <span className="text-[14px] font-medium leading-[17px] text-[#1F1D1D]">
                  {item.amount}
                </span>

                {item.status === "verified" ? (
                  /* tick-01 icon wrapper */
                  <div className="w-[18px] h-[18px] border border-[#6FDC9C] rounded-[33px] flex items-center justify-center bg-[#FEFEFE] flex-shrink-0">
                    <svg className="w-[10px] h-[8px] text-[#17CD60]" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                ) : (
                  /* clock-01 icon wrapper */
                  <div className="w-[19px] h-[19px] flex-shrink-0 flex items-center justify-center">
                    <svg className="w-[19px] h-[19px] text-[#F8B600]" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 1.5" />
                    </svg>
                  </div>
                )}
              </div>
            </div>
          )) : (
            <div className="w-full h-[50px] border-b border-[#E0E0E0] last:border-b-0 flex items-center py-[10px]">
              <span className="text-[16px] font-normal leading-[19px] text-[#575757]">
                No recent rewards from the backend.
              </span>
            </div>
          )}
        </div>
      </div>

      {/* View Full History Button */}
      <button className="w-full h-[56px] border border-[#E0E0E0] hover:bg-gray-50 active:scale-[0.99] rounded-[8px] flex items-center justify-center transition-all cursor-pointer font-normal text-[18px] leading-[22px] text-[#1F1D1D] focus:outline-none">
        View Full History
      </button>
      
    </div>
  );
}
