"use client";

import React, { useState } from "react";
import { BrandFilterState } from "@/types/brand.types";

interface BrandFilterBarProps {
  onSearch?: (filters: BrandFilterState) => void;
}

export const BrandFilterBar: React.FC<BrandFilterBarProps> = ({
  onSearch,
}) => {
  const [filters, setFilters] = useState<BrandFilterState>({
    date: "",
    brandName: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSearch) onSearch(filters);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-3">
      {/* Date Pill */}
      <div className="relative flex items-center h-[36px] px-4 bg-[#FEFEFE] shadow-[0px_2px_8px_rgba(0,0,0,0.1)] rounded-[86px] gap-2">
        <input
          type="text"
          placeholder="Date"
          value={filters.date}
          onChange={(e) => setFilters({ ...filters, date: e.target.value })}
          className="w-20 bg-transparent outline-none font-poppins text-[14px] text-[#575757] placeholder:text-[#575757] text-center"
        />
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#3E3EDF"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0"
        >
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </div>

      {/* Brand Name Pill */}
      <div className="flex items-center h-[36px] px-4 bg-[#FEFEFE] shadow-[0px_2px_8px_rgba(0,0,0,0.1)] rounded-[86px]">
        <input
          type="text"
          placeholder="Brand Name"
          value={filters.brandName}
          onChange={(e) =>
            setFilters({ ...filters, brandName: e.target.value })
          }
          className="w-28 bg-transparent outline-none font-poppins text-[14px] text-[#575757] placeholder:text-[#575757] text-center"
        />
      </div>

      {/* Search Button */}
      <button
        type="submit"
        className="w-[36px] h-[36px] rounded-full bg-[#3E3EDF] hover:bg-[#3232C7] flex items-center justify-center text-white transition-colors cursor-pointer shrink-0 shadow-sm"
        aria-label="Search brands"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#FEFEFE"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </button>
    </form>
  );
};
