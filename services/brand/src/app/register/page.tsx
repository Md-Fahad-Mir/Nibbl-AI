import { Suspense } from "react";
import RegisterCard from "@/features/auth/components/RegisterCard";

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterCard />
    </Suspense>
  );
}
