"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

interface SplashScreenProps {
  onComplete: () => void;
}

export default function SplashScreen({ onComplete }: SplashScreenProps) {
  const [opacity, setOpacity] = useState(1);

  useEffect(() => {
    // Start fade out at 2.0s
    const fadeTimer = setTimeout(() => {
      setOpacity(0);
    }, 2000);

    // Complete transition at 2.7s
    const completeTimer = setTimeout(() => {
      onComplete();
    }, 2700);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-white transition-opacity duration-700 ease-in-out"
      style={{ opacity }}
    >
      <div className="relative transform transition-transform duration-1000 ease-out scale-100 animate-pulse">
        <Image
          src="/logo/logoTiny.svg"
          alt="nibblAI Logo"
          width={280}
          height={120}
          priority
          className="h-auto w-auto max-w-[280px]"
        />
      </div>
    </div>
  );
}
