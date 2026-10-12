"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useBrandApiStore } from "@/stores/useBrandApiStore";
import RoleSelectorView, { ROLE_KEY } from "@/features/role-selector/components/RoleSelectorView";

const SERVER = "ssr";
const noSubscribe = () => () => {};
const readChoice = () => {
  try {
    return localStorage.getItem(ROLE_KEY) ?? "";
  } catch {
    return "";
  }
};

/** Signed in → dashboard. Otherwise the Master role gate, remembering the
 *  visitor's earlier choice on this device. */
export default function Home() {
  const router = useRouter();
  const accessToken = useBrandApiStore((state) => state.accessToken);
  const refreshToken = useBrandApiStore((state) => state.refreshToken);
  const choice = useSyncExternalStore(noSubscribe, readChoice, () => SERVER);
  const signedIn = Boolean(accessToken || refreshToken);

  useEffect(() => {
    if (signedIn) router.replace("/onboarding");
    else if (choice === "shopper") window.location.assign("https://www.joinnibbl.com");
    else if (choice === "brand") router.replace("/brand-landing");
  }, [signedIn, choice, router]);

  return !signedIn && choice === "" ? <RoleSelectorView /> : null;
}
