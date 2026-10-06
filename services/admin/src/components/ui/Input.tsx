"use client";

import React, { useState } from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  isPassword?: boolean;
  isPrimaryBorder?: boolean;
}

export const Input: React.FC<InputProps> = ({
  isPassword = false,
  isPrimaryBorder = false,
  type = "text",
  className = "",
  placeholder,
  ...props
}) => {
  const [showPassword, setShowPassword] = useState(false);

  const inputType = isPassword ? (showPassword ? "text" : "password") : type;
  const borderColor = isPrimaryBorder ? "border-[#3E3EDF]" : "border-[#959595]";

  return (
    <div
      className={`relative flex items-center justify-between w-full h-[56px] px-3 py-2 bg-[#FEFEFE] border border-solid ${borderColor} focus-within:border-[#3E3EDF] transition-colors rounded-[8px]`}
    >
      <input
        type={inputType}
        placeholder={placeholder}
        className={`w-full h-full bg-transparent outline-none font-poppins text-[16px] text-[#575757] placeholder:text-[#575757] pr-2 ${className}`}
        {...props}
      />
      {isPassword && (
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="flex items-center justify-center w-6 h-6 text-[#575757] hover:text-[#1F1D1D] transition-colors shrink-0 cursor-pointer"
          aria-label={showPassword ? "Hide password" : "Show password"}
        >
          {showPassword ? (
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#575757"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
              <line x1="1" y1="1" x2="23" y2="23" />
            </svg>
          ) : (
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#575757"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      )}
    </div>
  );
};
