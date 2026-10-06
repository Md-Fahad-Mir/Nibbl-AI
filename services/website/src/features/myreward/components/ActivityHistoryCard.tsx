"use client";

import { useState } from "react";
import Image from "next/image";

interface ActivityItem {
  id: string;
  type: "verified" | "pending" | "rejected" | "referral";
  title: string;
  subtitle: string;
  statusText: string;
  statusColor: string;
  iconBg: string;
  iconSrc: string;
}

interface ActivityHistoryCardProps {
  activities: ActivityItem[];
}

const PREVIEW_LIMIT = 3;

export default function ActivityHistoryCard({ activities }: ActivityHistoryCardProps) {
  const [showFullHistory, setShowFullHistory] = useState(false);
  const visibleActivities = showFullHistory
    ? activities
    : activities.slice(0, PREVIEW_LIMIT);
  const hasMoreHistory = activities.length > PREVIEW_LIMIT;

  return (
    <section className="w-full max-w-[669px] bg-[#FEFEFE] shadow-[0px_4px_8.4px_rgba(0,0,0,0.12)] rounded-[12px] p-6 sm:py-[12px] sm:px-[18px] flex flex-col gap-[17px] border border-gray-100/60">
      {/* Title Header (Frame 2147229169) */}
      <div className="flex items-center gap-[8px] h-[22px]">
        <span className="text-[18px] font-medium leading-[22px] text-[#2D2D2D]">
          Activity History
        </span>
      </div>

      {/* List (Frame 2147229254 etc) */}
      <div className="flex flex-col w-full">
        {visibleActivities.length ? visibleActivities.map((item) => (
          <div
            key={item.id}
            className="w-full min-h-[75px] border-b border-[#E0E0E0] last:border-b-0 flex items-center justify-between py-3.5 gap-2"
          >
            {/* Left side info block */}
            <div className="flex items-center gap-3 min-w-0">
              {/* Circular Icon Container */}
              {item.type === "rejected" ? (
                <div className="w-9 h-9 flex-shrink-0 flex items-center justify-center relative">
                  <Image
                    src={item.iconSrc}
                    alt={item.type}
                    width={31}
                    height={31}
                    className="object-contain"
                  />
                </div>
              ) : (
                <div
                  className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center relative overflow-hidden"
                  style={{ backgroundColor: item.iconBg }}
                >
                  <div className="w-6 h-6 relative flex items-center justify-center">
                    <Image
                      src={item.iconSrc}
                      alt={item.type}
                      width={20}
                      height={20}
                      className="object-contain filter invert-0 brightness-200"
                    />
                  </div>
                </div>
              )}

              {/* Title & Subtitle Stack */}
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-[15px] sm:text-[16px] font-medium leading-[130%] text-[#1F1D1D]">
                  {item.title}
                </span>
                <span className="text-[12px] sm:text-[14px] font-normal leading-[130%] text-[#575757]">
                  {item.subtitle}
                </span>
              </div>
            </div>

            {/* Right side status badge */}
            <span className={`text-[14px] font-semibold leading-[17px] ${item.statusColor} flex-shrink-0 text-right`}>
              {item.statusText}
            </span>
          </div>
        )) : (
          <div className="w-full min-h-[75px] border-b border-[#E0E0E0] last:border-b-0 flex items-center py-3.5">
            <span className="text-[14px] font-normal leading-[17px] text-[#575757]">
              No activity history from the backend.
            </span>
          </div>
        )}
      </div>

      {/* View Full History Button Link */}
      {hasMoreHistory && (
      <div className="w-full flex justify-center mt-1">
        <button
          onClick={() => setShowFullHistory((value) => !value)}
          className="border-b border-[#3E3EDF] text-[#3E3EDF] text-[16px] sm:text-[18px] font-semibold leading-[22px] pb-[2px] hover:text-[#2d2db0] hover:border-[#2d2db0] active:scale-[0.98] transition-all cursor-pointer focus:outline-none"
        >
          {showFullHistory ? "View Less" : "View Full History"}
        </button>
      </div>
      )}
    </section>
  );
}
