/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";
import ReviewsStepper from "./ReviewsStepper";
import PerformanceEstimatorCard from "./PerformanceEstimatorCard";
import BudgetTipBanner from "./BudgetTipBanner";

interface CreateReviewStep3Props {
  onBack: () => void;
  onContinue: (reward: string, budget: number) => void;
}

export default function CreateReviewStep3({ onBack, onContinue }: CreateReviewStep3Props) {
  const [budget, setBudget] = useState("25.00");

  const handleContinue = () => {
    onContinue("$2.50 Cashback", Number(budget) || 25);
  };

  const handleBudgetChange = (val: string) => {
    // Only allow numbers and decimal
    if (/^\d*\.?\d*$/.test(val)) {
      setBudget(val);
    }
  };

  return (
    <div className="flex flex-col gap-8 w-full animate-slide-up text-left font-manrope">
      <ReviewsStepper activeStep={3} />

      {/* Title Header with Icon */}
      <div className="flex flex-row items-center gap-4">
        <div className="w-12 h-12 bg-[#F2F3FF] rounded-xl flex items-center justify-center flex-shrink-0">
          <img src="/reviews/dailyBudget.svg" alt="Budget" className="w-6 h-6 object-contain" />
        </div>
        <div className="flex flex-col">
          <h2 className="text-3xl font-extrabold font-jakarta text-[#131B2E] tracking-tight leading-tight">
            Budget & Performance
          </h2>
          <p className="text-sm text-[#454656] font-medium mt-1">
            Define your daily investment and project your campaign reach.
          </p>
        </div>
      </div>

      {/* Bento Layout Content */}
      <div className="flex flex-col lg:flex-row gap-8 items-start w-full">
        {/* Left Column (Inputs & Plan) */}
        <div className="flex-1 flex flex-col gap-6 w-full">
          
          {/* Daily Review Budget Card */}
          <div className="bg-white shadow-[0px_24px_48px_rgba(19,27,46,0.02)] rounded-xl p-8 flex flex-col gap-4 border border-[#C5C5D9]/10">
            <label className="text-sm font-bold text-[#131B2E]">Daily Review Budget</label>
            
            {/* Input Box */}
            <div className="relative w-full h-[76px] bg-[#F2F3FF] rounded-lg flex items-center px-4">
              <span className="text-2xl font-bold text-[#454656] pr-2">$</span>
              <input
                type="text"
                value={budget}
                onChange={(e) => handleBudgetChange(e.target.value)}
                className="w-full bg-transparent border-none focus:outline-none font-jakarta font-extrabold text-[30px] text-[#131B2E]"
                placeholder="25.00"
              />
            </div>

            {/* Wallet Info Overlay */}
            <div className="flex justify-between items-center bg-[#E2E7FF]/30 rounded-lg p-4 text-xs font-semibold">
              <div className="flex items-center gap-2 text-[#131B2E]">
                <span>💳</span>
                <span>Wallet Balance: $1,420.50</span>
              </div>
              <button className="text-[#001BD2] font-bold bg-transparent border-none cursor-pointer hover:underline">
                Top Up
              </button>
            </div>
          </div>

          {/* Your Plan Card */}
          <div className="relative bg-gradient-to-br from-[#001BD2] to-[#2D3FEA] shadow-md rounded-xl p-8 overflow-hidden text-white flex flex-col gap-1.5 min-h-[152px]">
            <div className="absolute -right-4 -bottom-4 w-[117px] h-[112px] bg-white/10 rounded-full z-0 pointer-events-none"></div>
            <span className="text-xs font-bold tracking-widest text-[#BDC2FF] uppercase z-10">YOUR PLAN</span>
            <h3 className="text-3xl font-extrabold font-jakarta text-white z-10 leading-tight">
              Cost per Review: $2.50
            </h3>
            <span className="text-sm text-[#CACDFF] font-medium z-10">
              Locked premium rate for Q4 campaigns.
            </span>
          </div>

        </div>

        {/* Right Column (Estimator & CTA) */}
        <div className="w-full lg:w-[359.33px] flex flex-col gap-6 flex-shrink-0">
          <PerformanceEstimatorCard dailyBudget={Number(budget) || 0} />
          
          <div className="flex flex-col gap-4 text-center items-center w-full">
            <button
              onClick={handleContinue}
              className="w-full h-[68px] bg-gradient-to-r from-[#001BD2] to-[#2D3FEA] hover:opacity-95 text-white font-extrabold text-lg rounded-full shadow-[0px_10px_15px_-3px_rgba(0,0,0,0.1)] transition-all cursor-pointer border-none flex items-center justify-center"
            >
              Continue to Publish
            </button>
            <p className="text-[12px] text-[#454656] leading-[16px] max-w-[276px]">
              You won&apos;t be charged until you confirm on the final review page.
            </p>
            <button onClick={onBack} className="text-xs font-bold text-[#757688] hover:underline cursor-pointer bg-transparent border-none mt-2">
              ← Go back to product list
            </button>
          </div>
        </div>
      </div>

      {/* Tip Banner */}
      <BudgetTipBanner />
    </div>
  );
}
