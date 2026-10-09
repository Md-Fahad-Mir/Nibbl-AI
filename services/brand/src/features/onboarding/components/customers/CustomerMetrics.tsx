"use client";

import { Users, Clock, Timer, TrendingUp } from "lucide-react";

interface CustomerMetricsProps {
  optedIn: number;
  openClaims: number;
  activeCooldowns: number;
  /** Customers with at least one completed rebate, as a % of all customers. */
  conversion: string;
}

/** Master Customer Summary: opted-in customers, open claims, active
 *  cooldowns and brand conversion. */
export default function CustomerMetrics({ optedIn, openClaims, activeCooldowns, conversion }: CustomerMetricsProps) {
  const metrics = [
    { title: "Opted-in customers", value: optedIn.toLocaleString("en-US"), sub: "Email + SMS consent for your brand", icon: <Users className="w-4 h-4 text-[#001BD2]" /> },
    { title: "Open claims", value: openClaims.toLocaleString("en-US"), sub: "Waiting for a receipt", icon: <Clock className="w-4 h-4 text-[#006273]" /> },
    { title: "Active cooldowns", value: activeCooldowns.toLocaleString("en-US"), sub: "Can't claim again yet", icon: <Timer className="w-4 h-4 text-[#454656]" /> },
    { title: "Brand conversion", value: conversion, sub: "Customers with a completed rebate", icon: <TrendingUp className="w-4 h-4 text-emerald-600" /> },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 w-full items-stretch font-manrope">
      {metrics.map((m) => (
        <div
          key={m.title}
          className="bg-white border border-[#C5C5D9]/10 shadow-[0px_1px_2px_rgba(0,0,0,0.05)] rounded-[20px] p-6 flex flex-col justify-between text-left min-h-[134px]"
        >
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-bold text-[#454656] tracking-[0.6px] uppercase">{m.title}</span>
            <h3 className="font-jakarta font-extrabold text-[30px] leading-[36px] text-[#131B2E] mt-2">{m.value}</h3>
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            {m.icon}
            <span className="text-xs font-bold text-[#454656]">{m.sub}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
