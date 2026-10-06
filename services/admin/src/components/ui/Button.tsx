import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  className = "",
  isLoading = false,
  disabled,
  ...props
}) => {
  return (
    <button
      disabled={disabled || isLoading}
      className={`w-full h-[54px] px-4 flex items-center justify-center gap-4 bg-[#3E3EDF] hover:bg-[#3232C7] transition-all duration-200 shadow-[0px_4px_4px_rgba(0,0,0,0.12),inset_0px_4px_4px_rgba(255,255,255,0.12)] rounded-[8px] text-[#FEFEFE] text-[18px] font-medium font-inter cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      {...props}
    >
      {isLoading ? (
        <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
      ) : (
        children
      )}
    </button>
  );
};
