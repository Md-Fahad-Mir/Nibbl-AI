"use client";

import { BarChart3, Clock, FileText, Info, Users } from "lucide-react";

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
    { title: "Opted-In Customers", value: optedIn.toLocaleString("en-US"), sub: "Email + SMS consent for your brand", Icon: Users },
    { title: "Open Claims", value: openClaims.toLocaleString("en-US"), sub: "Claims waiting for a receipt", Icon: FileText },
    { title: "Active Cooldowns", value: activeCooldowns.toLocaleString("en-US"), sub: "Customers who can't claim again yet", Icon: Clock },
    { title: "Brand Conversion", value: conversion, sub: "Customers with a completed rebate", Icon: BarChart3 },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 w-full items-stretch font-manrope">
      {metrics.map((m) => (
        <div
          key={m.title}
          className="bg-white border border-[#EAEDFF] rounded-[20px] p-5 flex items-center gap-4 text-left"
        >
          <span className="w-14 h-14 rounded-full bg-[#EEF0FF] text-[#001BD2] flex items-center justify-center flex-shrink-0">
            <m.Icon className="w-7 h-7" />
          </span>
          <div className="flex flex-col gap-1">
            <span className="flex items-center gap-1 text-sm font-semibold text-[#001BD2]">
              {m.title}
              <span title={m.sub} className="cursor-help"><Info className="w-3.5 h-3.5 text-[#94A3B8]" /></span>
            </span>
            <span className="font-jakarta font-extrabold text-[30px] leading-[36px] text-[#131B2E]">{m.value}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
