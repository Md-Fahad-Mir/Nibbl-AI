"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useBrandApiStore } from "@/stores/useBrandApiStore";

/** Master passwordless sign-in: the emailed link lands here. */
function MagicSignIn() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") || "";
  const adminBrand = params.get("admin_brand") || "";
  const signInWithMagicLink = useBrandApiStore((s) => s.signInWithMagicLink);
  const [failed, setFailed] = useState("");
  const attempted = useRef(false);
  const problem = token ? failed : "This sign-in link is incomplete.";

  useEffect(() => {
    if (attempted.current || !token) return;
    attempted.current = true;
    signInWithMagicLink(token, adminBrand)
      .then(() => router.replace("/onboarding"))
      .catch((err: unknown) => setFailed(err instanceof Error ? err.message : "This sign-in link is invalid or has expired."));
  }, [token, adminBrand, signInWithMagicLink, router]);

  return (
    <div className="min-h-screen w-full bg-[#FAF8FF] flex items-center justify-center p-4 font-jakarta">
      <div className="w-full max-w-[448px] bg-white rounded-3xl shadow-xl p-8 flex flex-col gap-4 text-center">
        <h1 className="text-2xl font-extrabold text-[#131B2E]">{problem ? "Link expired" : "Signing you in…"}</h1>
        <p className="text-sm text-[#454656]">
          {problem || "One moment while we open your brand workspace."}
        </p>
        {problem && (
          <Link href="/login" className="h-12 rounded-full bg-[#001BD2] text-white font-bold text-sm flex items-center justify-center">
            Send a new sign-in link
          </Link>
        )}
      </div>
    </div>
  );
}

export default function MagicSignInPage() {
  return (
    <Suspense fallback={null}>
      <MagicSignIn />
    </Suspense>
  );
}
