import { Suspense } from "react";
import LoginCard from "@/features/auth/components/LoginCard";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginCard />
    </Suspense>
  );
}
