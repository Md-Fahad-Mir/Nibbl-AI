import { redirect } from "next/navigation";

// The pre-Master Earnings page was replaced by Revenue Analytics.
export default function EarningsPage() {
  redirect("/analytics");
}
