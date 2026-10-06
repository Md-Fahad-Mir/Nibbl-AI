"use client";

import React from "react";

interface ReviewsFooterProps {
  leftElement: React.ReactNode;
  rightElement: React.ReactNode;
}

export default function ReviewsFooter({ leftElement, rightElement }: ReviewsFooterProps) {
  return (
    <div className="w-full bg-white border-t border-[#C5C5D9]/10 py-6 px-4 md:px-12 flex flex-col md:flex-row justify-between items-center gap-4 mt-8 font-manrope">
      <div className="flex-1 flex justify-start items-center text-left">
        {leftElement}
      </div>
      <div className="flex items-center gap-4 flex-wrap justify-end">
        {rightElement}
      </div>
    </div>
  );
}
