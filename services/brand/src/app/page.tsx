"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useBrandApiStore } from "@/stores/useBrandApiStore";

export default function Home() {
  const router = useRouter();
  const accessToken = useBrandApiStore((state) => state.accessToken);
  const refreshToken = useBrandApiStore((state) => state.refreshToken);

  useEffect(() => {
    router.replace(accessToken || refreshToken ? "/onboarding" : "/login");
  }, [accessToken, refreshToken, router]);

  return null;
}
