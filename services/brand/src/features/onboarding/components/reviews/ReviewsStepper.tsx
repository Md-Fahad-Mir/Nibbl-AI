"use client";

interface StepInfo {
  step: number;
  label: string;
}

interface ReviewsStepperProps {
  activeStep: number;
}

const steps: StepInfo[] = [
  { step: 1, label: "Basic Info" },
  { step: 2, label: "Products" },
  { step: 3, label: "Budget" },
  { step: 5, label: "Review & publish" },
];

export default function ReviewsStepper({ activeStep }: ReviewsStepperProps) {
  return (
    <div 
      className="relative flex flex-row justify-between items-center w-full max-w-[897px] h-[72px] isolate mx-auto overflow-x-auto lg:overflow-x-visible gap-8 md:gap-0 pb-2 scrollbar-none"
      style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
    >
      <style>{`
        .scrollbar-none::-webkit-scrollbar {
          display: none;
        }
      `}</style>
      {/* Horizontal Divider Line */}
      <div className="absolute h-[2px] left-0 right-0 top-1/2 -translate-y-1/2 bg-[#EAEDFF] z-0"></div>

      {steps.map(({ step, label }) => {
        const isActive = step === activeStep;
        return (
          <div key={step} className="flex flex-col items-center gap-3 w-[112px] h-[72px] z-10 flex-shrink-0 font-manrope">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                isActive
                  ? "bg-[#001BD2] text-white shadow-[0px_0px_0px_8px_#DFE0FF]"
                  : "bg-[#DAE2FD] text-[#454656]"
              }`}
            >
              <span className="text-base font-normal">{step}</span>
            </div>
            <span
              className={`text-xs font-semibold whitespace-nowrap ${
                isActive ? "text-[#001BD2]" : "text-[#454656] opacity-60"
              }`}
            >
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
