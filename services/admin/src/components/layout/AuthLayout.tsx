import React from "react";
import Image from "next/image";

interface AuthLayoutProps {
  children: React.ReactNode;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-[#5D5D5D]">
      <div className="w-full max-w-[441px] min-h-[567px] bg-[#FEFEFE] rounded-[16px] py-[64px] px-[44px] flex flex-col items-center gap-[24px] shadow-2xl relative">
        {/* Big Logo */}
        <div className="flex items-center justify-center w-[160px] h-[50px] shrink-0 mb-1">
          <Image
            src="/mainImage/logo.svg"
            alt="NibblAI Logo"
            width={160}
            height={50}
            priority
            className="w-full h-auto object-contain"
          />
        </div>

        {/* Form Body */}
        <div className="w-full flex flex-col items-center gap-[24px]">
          {children}
        </div>
      </div>
    </div>
  );
};
