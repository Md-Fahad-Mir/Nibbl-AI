import { Suspense } from "react";
import VerifyEmailCard from "@/features/auth/components/VerifyEmailCard";

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailCard />
    </Suspense>
  );
}
