/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";
import ReviewsStepper from "./ReviewsStepper";

interface CreateReviewStep1Props {
  initialData: { name: string; description: string; isActive: boolean };
  onCancel: () => void;
  onContinue: (data: { name: string; description: string; isActive: boolean }) => void;
}

export default function CreateReviewStep1({ initialData, onCancel, onContinue }: CreateReviewStep1Props) {
  const [name, setName] = useState(initialData.name);
  const [description, setDescription] = useState(initialData.description);
  const [isActive, setIsActive] = useState(initialData.isActive);

  const handleContinue = () => {
    if (name.trim()) {
      onContinue({ name, description, isActive });
    }
  };

  return (
    <div className="flex flex-col gap-8 w-full animate-slide-up text-left font-manrope">
      
      {/* Title Header with Icon */}
      <div className="flex flex-row items-center gap-4">
        <div className="w-12 h-12 bg-[#F2F3FF] rounded-xl flex items-center justify-center flex-shrink-0">
          <img src="/reviews/editIcon.svg" alt="Edit" className="w-6 h-6 object-contain" />
        </div>
        <div className="flex flex-col">
          <h2 className="text-3xl font-extrabold font-jakarta text-[#131B2E] tracking-tight leading-tight">
            Create Review Campaign
          </h2>
          <p className="text-sm text-[#454656] font-medium mt-1">
            Configure your basic campaign details to get started.
          </p>
        </div>
      </div>

      <ReviewsStepper activeStep={1} />

      <div className="flex flex-col lg:flex-row gap-8 items-start w-full">
        {/* Left Column Form Card */}
        <div className="flex-grow flex flex-col gap-6 w-full lg:max-w-[62%] bg-white shadow-[0px_24px_48px_rgba(19,27,46,0.02)] border border-[#C5C5D9]/10 rounded-[32px] p-8">
          <div className="flex flex-col gap-6 w-full">
            {/* Campaign Name */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-[#131B2E]">Campaign Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Summer Influencer Review Drive"
                className="w-full h-12 bg-[#F2F3FF] border border-transparent rounded-xl px-4 text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-[#001BD2] text-[#131B2E] placeholder-[#454656]/40"
              />
            </div>

            {/* Campaign Status Toggle */}
            <div className="bg-[#F2F3FF] p-5 rounded-2xl flex justify-between items-center w-full">
              <div className="flex flex-col text-left">
                <span className="text-sm font-bold text-[#131B2E]">Campaign Status</span>
                <span className="text-xs text-[#454656] mt-0.5">Set whether this campaign goes live immediately.</span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsActive(!isActive)}
                  className={`w-14 h-8 rounded-full p-1 transition-colors duration-150 cursor-pointer border-none ${
                    isActive ? "bg-[#001BD2]" : "bg-slate-300"
                  }`}
                >
                  <div className={`w-6 h-6 rounded-full bg-white transition-transform duration-150 ${
                    isActive ? "translate-x-6" : "translate-x-0"
                  }`}></div>
                </button>
                <span className="text-xs font-bold text-[#001BD2]">{isActive ? "Active" : "Paused"}</span>
              </div>
            </div>

            {/* Short Description */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-[#131B2E]">Short Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the goals and scope of this campaign..."
                className="w-full bg-[#F2F3FF] border border-transparent rounded-xl p-4 text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-[#001BD2] text-[#131B2E] placeholder-[#454656]/40 resize-none h-[140px]"
              />
            </div>
          </div>

          <button
            onClick={handleContinue}
            disabled={!name.trim()}
            className={`w-full h-14 bg-[#001BD2] text-white font-extrabold text-sm rounded-full transition-all flex items-center justify-center gap-2 border-none shadow-[0px_8px_16px_rgba(0,27,210,0.15)] cursor-pointer ${
              !name.trim() ? "opacity-50 cursor-not-allowed" : "hover:opacity-90 active:scale-[0.99]"
            }`}
          >
            Continue to Products ➔
          </button>
        </div>

        {/* Right Column Bento Info Cards */}
        <div className="w-full lg:w-[359.33px] flex flex-col gap-6 flex-shrink-0">
          {/* Pro Tip Card */}
          <div className="bg-[#001BD2] text-white rounded-[24px] p-8 flex flex-col gap-4 text-left relative overflow-hidden shadow-sm">
            <span className="text-[10px] font-bold text-white/60 tracking-wider uppercase">PRO TIP</span>
            <h4 className="text-lg font-extrabold leading-snug">
              Authenticity drives conversion 3x better than generic ads.
            </h4>
            <p className="text-xs text-white/80 font-medium leading-relaxed">
              Keep your campaign name descriptive for your internal team, and use the description to outline specific brand voice guidelines.
            </p>
          </div>

          {/* Wizard Progress Card */}
          <div className="bg-[#F2F3FF]/40 border border-slate-100 rounded-[24px] p-8 shadow-sm flex flex-col gap-6 text-left w-full">
            <h4 className="text-sm font-bold text-[#131B2E]">Wizard Progress</h4>
            <div className="flex flex-col gap-5 font-semibold text-xs">
              <div className="flex items-center gap-3 text-[#001BD2]">
                <span className="w-5 h-5 rounded-full bg-[#001BD2] text-white flex items-center justify-center text-[10px] font-bold">✓</span>
                <span>Defining Basics</span>
              </div>
              <div className="flex items-center gap-3 text-slate-400">
                <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center text-[10px] font-bold">2</span>
                <span>Product Selection</span>
              </div>
              <div className="flex items-center gap-3 text-slate-400">
                <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center text-[10px] font-bold">3</span>
                <span>Reward Structure</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Cancel Action */}
      <button onClick={onCancel} className="text-xs font-bold text-[#757688] hover:underline self-start bg-transparent border-none cursor-pointer">
        Cancel and exit campaign creator
      </button>
    </div>
  );
}
