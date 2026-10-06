"use client";

import React from "react";
import Image from "next/image";

interface AuthLayoutProps {
  children: React.ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div
      className="min-h-screen w-full relative flex flex-col bg-cover bg-center bg-no-repeat font-sans"
      style={{
        backgroundImage: "url('/logo/d2bf94a83059106ce67bea53b8b28fd21e75d142.png')",
      }}
    >
      {/* Dark overlay for rich contrast */}
      <div className="absolute inset-0 bg-black/30 z-0" />

      {/* Top Header */}
      <header className="w-full h-[89px] bg-[#F8F8F8] flex items-center border-b border-gray-200/80 px-6 sm:px-12 md:pl-[190px] relative z-10">
        <Image
          src="/logo/logoTiny.svg"
          alt="nibblAI Logo"
          width={150}
          height={57}
          priority
          className="h-auto w-auto max-h-[57px] max-w-[150px]"
        />
      </header>

      {/* Main Content Area */}
      <main className="flex-grow flex items-center justify-center py-10 px-4 relative z-10">
        {children}
      </main>
    </div>
  );
}
