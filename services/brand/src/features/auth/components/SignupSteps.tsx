import { Check } from "lucide-react";

const STEPS = ["Plan", "Account", "Verify", "Payment"];

/** Master brand onboarding progress: Plan → Account → Verify (→ Payment at
 *  checkout). `current` is 1-based; earlier steps show a check mark. */
export default function SignupSteps({ current, withPayment = false }: { current: number; withPayment?: boolean }) {
  const steps = withPayment ? STEPS : STEPS.slice(0, 3);
  return (
    <ol className="flex items-start w-full font-manrope" aria-label="Signup progress">
      {steps.map((label, index) => {
        const n = index + 1;
        const done = n < current;
        const active = n === current;
        return (
          <li key={label} className="flex-1 flex flex-col items-center gap-1.5 relative">
            {index > 0 && (
              <span
                className={`absolute top-4 right-1/2 w-full h-0.5 -z-0 ${n <= current ? "bg-[#001BD2]" : "bg-[#E2E7FF]"}`}
                aria-hidden
              />
            )}
            <span
              className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                done || active ? "bg-[#001BD2] text-white" : "bg-[#E2E7FF] text-[#454656]"
              }`}
            >
              {done ? <Check className="w-4 h-4" /> : n}
            </span>
            <span className={`text-xs font-semibold ${active ? "text-[#001BD2]" : "text-[#454656]"}`}>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}
