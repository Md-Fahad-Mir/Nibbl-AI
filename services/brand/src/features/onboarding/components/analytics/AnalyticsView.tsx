"use client";

import { useState } from "react";
import AnalyticsOverview from "./AnalyticsOverview";
import AnalyticsRebates from "./AnalyticsRebates";
import AnalyticsReviews from "./AnalyticsReviews";
import AnalyticsProducts from "./AnalyticsProducts";
import { Calendar } from "lucide-react";

export default function AnalyticsView() {
  const [activeTabSetting, setActiveTabSetting] = useState<"overview" | "Rebates" | "Reviews" | "Products">("overview");

  const getPageTitle = () => {
    switch (activeTabSetting) {
      case "Rebates":
        return { main: "Performance Console", sub: "Granular conversion rates and cost metrics for active rebates." };
      case "Reviews":
        return { main: "Reviews Analysis", sub: "Averages, trends, and top reviewed products breakdown." };
      default:
        return { main: "Analytics Hub", sub: "Monitoring real-time campaign performance and redemption velocity." };
    }
  };

  const titleInfo = getPageTitle();

  return (
    <div className="flex flex-col gap-8 w-full animate-slide-up text-left font-manrope">
      
      {/* Top Header Integration */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end w-full gap-4 pb-2">
        <div className="flex flex-col gap-1 text-left">
          <h2 className="text-3xl font-extrabold font-jakarta text-[#131B2E] tracking-tight leading-none">
            {titleInfo.main}
          </h2>
          <p className="text-xs text-[#454656] font-medium mt-1">
            {titleInfo.sub}
          </p>
        </div>

        {/* User profile / Status area */}
        <div className="flex items-center gap-4">
          <div className="bg-white border border-[#C5C5D9]/15 rounded-full px-4 py-2 flex items-center gap-2 shadow-sm text-xs font-bold text-[#454656] cursor-pointer">
            <Calendar className="w-3.5 h-3.5 text-[#001BD2]" />
            <span>Last 30 Days</span>
          </div>
        </div>
      </div>

      {/* Sub-navigation Toggles */}
      <div className="bg-[#F2F3FF] p-1 rounded-full flex items-center gap-1 w-fit border border-[#C5C5D9]/5 relative z-10">
        {(["overview", "Rebates", "Reviews", "Products"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTabSetting(tab)}
            className={`px-6 py-2 text-xs font-bold rounded-full transition-all border-none cursor-pointer ${
              activeTabSetting === tab 
                ? "bg-white text-[#001BD2] shadow-sm" 
                : "text-[#454656] hover:text-slate-700"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Main Contents */}
      <div className="w-full mt-2 relative">
        {activeTabSetting === "overview" && <AnalyticsOverview />}
        {activeTabSetting === "Rebates" && <AnalyticsRebates />}
        {activeTabSetting === "Reviews" && <AnalyticsReviews />}
        {activeTabSetting === "Products" && <AnalyticsProducts />}
      </div>

    </div>
  );
}
