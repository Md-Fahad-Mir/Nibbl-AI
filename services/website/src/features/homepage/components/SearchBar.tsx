"use client";

import { useState } from "react";

interface SearchBarProps {
  onSearch?: (query: string) => void;
}

export default function SearchBar({ onSearch }: SearchBarProps) {
  const [query, setQuery] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSearch) onSearch(query);
  };

  return (
    <div className="w-full max-w-[1191px] mx-auto bg-[#FDFDFD] border border-[#E6E6E6] shadow-[0px_2px_20px_rgba(0,0,0,0.08)] rounded-[12px] sm:rounded-[18px] p-4 sm:p-6 flex items-center justify-center font-sans">
      <form onSubmit={handleSubmit} className="w-full flex flex-col lg:flex-row items-center gap-[13px]">
        {/* Search Input Card */}
        <div className="w-full lg:w-[839px] h-[50px] sm:h-[79px] bg-[#FEFEFE] border border-[#B9DAFE] shadow-[0px_2px_10px_rgba(0,0,0,0.1)] rounded-[12px] sm:rounded-[20px] px-4 sm:px-[30px] flex items-center gap-3 sm:gap-5 transition-colors focus-within:border-[#3E3EDF]">
          <span className="w-6 h-6 sm:w-[30px] sm:h-[30px] flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 sm:w-[25px] sm:h-[25px] text-[#828282]" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          
          <input
            type="text"
            placeholder="Search Offers......"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent border-none text-[#1F1D1D] placeholder-[#828282] text-[16px] sm:text-[20px] leading-[20px] sm:leading-[24px] focus:outline-none"
          />
        </div>

        {/* Search Button */}
        <button
          type="submit"
          className="w-full lg:w-[285px] h-[50px] sm:h-[79px] bg-[#3E3EDF] hover:bg-[#3232c4] active:scale-[0.98] text-[#FEFEFE] font-semibold text-[18px] sm:text-[24px] leading-[22px] sm:leading-[29px] rounded-[10px] sm:rounded-lg shadow-[inset_0px_4px_4px_rgba(255,255,255,0.12)] transition-all flex items-center justify-center cursor-pointer flex-shrink-0 focus:outline-none"
        >
          Search
        </button>
      </form>
    </div>
  );
}
