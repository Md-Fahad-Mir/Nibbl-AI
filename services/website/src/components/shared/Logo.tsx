import React from "react";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

export default function Logo({ className = "", size = "md" }: LogoProps) {
  const sizeClasses = {
    sm: "text-[20px] gap-1.5",
    md: "text-[26px] gap-2",
    lg: "text-[32px] gap-2.5",
  };

  const iconSizes = {
    sm: "w-6 h-6",
    md: "w-[30px] h-[30px]",
    lg: "w-9 h-9",
  };

  return (
    <div className={`flex items-center select-none font-sans ${sizeClasses[size]} ${className}`}>
      {/* Icon: stylized brand double circle magnifying lens */}
      <div className={`relative flex items-center justify-center flex-shrink-0 ${iconSizes[size]} text-[#3E3EDF]`}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
          <circle cx="10" cy="10" r="6" />
          <line x1="21" y1="21" x2="14.2" y2="14.2" />
        </svg>
      </div>
      
      {/* Brand Text */}
      <span className="font-bold tracking-tight text-[#1F1D1D]">
        nibble<span className="text-[#3E3EDF]">Ai</span>
      </span>
    </div>
  );
}
