import { Suspense } from "react";
import { ShoppersView } from "@/features/users/views/ShoppersView";

export default function UsersPage() {
  return (
    <Suspense fallback={null}>
      <ShoppersView />
    </Suspense>
  );
}
