"use client";

import { Users, Landmark, Award, BarChart3, TrendingUp } from "lucide-react";

interface CustomerMetricsProps {
  totalMembers: number;
  activePercent: string;
  totalRewards: string;
  averageClaims: string;
}

export default function CustomerMetrics({
  totalMembers,
  activePercent,
  totalRewards,
  averageClaims,
}: CustomerMetricsProps) {
  const metrics = [
    {
      title: "Total Members",
      value: totalMembers.toLocaleString("en-US"),
      subText: "Backend customers",
      isTrend: true,
      icon: <Users className="w-4 h-4 text-emerald-600" />,
      colorClass: "text-emerald-600"
    },
    {
      title: "Active Portfolio",
      value: activePercent,
      subText: "Institutional Grade",
      isTrend: false,
      icon: <Landmark className="w-4 h-4 text-[#454656]" />,
      colorClass: "text-[#454656]"
    },
    {
      title: "Total Rewards",
      value: totalRewards,
      subText: "Distributed",
      isTrend: false,
      icon: <Award className="w-4 h-4 text-[#001BD2]" />,
      colorClass: "text-[#001BD2]"
    },
    {
      title: "Average Claims",
      value: averageClaims,
      subText: "Per Member",
      isTrend: false,
      icon: <BarChart3 className="w-4 h-4 text-[#006273]" />,
      colorClass: "text-[#006273]"
    }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 w-full items-stretch font-manrope">
      {metrics.map((m, idx) => (
        <div
          key={idx}
          className="bg-white border border-[#C5C5D9]/10 shadow-[0px_1px_2px_rgba(0,0,0,0.05)] rounded-[20px] p-6 flex flex-col justify-between text-left min-h-[134px] hover:shadow-md transition-shadow"
        >
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-bold text-[#454656] tracking-[0.6px] uppercase">
              {m.title}
            </span>
            <h3 className="font-jakarta font-extrabold text-[30px] leading-[36px] text-[#131B2E] mt-2">
              {m.value}
            </h3>
          </div>
          
          <div className="flex items-center gap-1.5 mt-2">
            {m.isTrend ? (
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              m.icon
            )}
            <span className={`text-xs font-bold ${m.colorClass}`}>
              {m.subText}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
