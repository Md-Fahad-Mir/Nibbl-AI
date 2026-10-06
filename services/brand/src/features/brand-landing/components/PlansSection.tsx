/* eslint-disable @next/next/no-img-element */
import Link from "next/link";

interface PlanCardProps {
  name: string;
  description: string;
  iconSrc: string;
  iconBgClass: string;
  iconColorClass: string;
}

function PlanCard({
  name,
  description,
  iconSrc,
  iconBgClass,
  iconColorClass,
}: PlanCardProps) {
  return (
    <div className="flex-1 min-w-[240px] bg-white border border-[#F1F5F9] rounded-[23px] shadow-sm hover:shadow-md hover:scale-[1.01] transition-all duration-300 p-8 flex flex-col justify-between h-[228px] font-jakarta">
      <div className="flex flex-col gap-4">
        {/* Icon Circle */}
        <div
          className={`w-[46px] h-[46px] rounded-2xl flex items-center justify-center border ${iconBgClass} ${iconColorClass}`}
        >
          <img
            src={iconSrc}
            alt={`${name} icon`}
            className="w-6 h-6 object-contain"
          />
        </div>

        {/* Title */}
        <h4 className="text-[19.3px] font-extrabold text-[#0F172A] leading-tight">
          {name}
        </h4>
      </div>

      {/* Description */}
      <p className="text-[13.5px] font-medium text-[#64748B] leading-relaxed">
        {description}
      </p>
    </div>
  );
}

export default function PlansSection() {
  return (
    <section className="w-full flex flex-col xl:flex-row items-center gap-12 justify-between py-12 font-jakarta">
      {/* Left Details Column */}
      <div className="w-full xl:max-w-[320px] flex flex-col gap-6 items-start">
        <h2 className="text-3xl md:text-[34.8px] leading-[44px] font-extrabold text-[#0F172A] tracking-tight">
          Flexible plans. Built for every brand.
        </h2>
        <p className="text-[13.5px] font-medium text-[#64748B] leading-relaxed">
          Choose the plan that fits your goals. Fund your wallet, control your
          daily spend, and grow on your terms.
        </p>

        {/* Buttons Stack */}
        <div className="w-full flex flex-col gap-3 pt-4">
          <Link
            href="/register"
            className="flex items-center justify-center h-[51px] w-full bg-[#2D3FEA] hover:bg-blue-700 text-white font-bold text-[13.5px] rounded-[11.6px] transition-colors shadow-md shadow-blue-500/20 active:scale-[0.98]"
          >
            Create your first campaign
          </Link>
          <Link
            href="/register"
            className="flex items-center justify-center h-[52px] w-full bg-white hover:bg-slate-50 text-[#2D3FEA] border border-[rgba(45,63,234,0.2)] font-bold text-[13.5px] rounded-[11.6px] transition-all duration-200 active:scale-[0.98]"
          >
            View plans & pricing
          </Link>
        </div>
      </div>

      {/* Right Grid Column */}
      <div className="flex-1 w-full grid grid-cols-1 md:grid-cols-3 gap-6 xl:gap-8">
        <PlanCard
          name="Starter"
          description="Perfect for testing offers and getting started."
          iconSrc="/Auth/2ndPageIcons/starter.svg"
          iconBgClass="bg-[#EFF6FF]"
          iconColorClass="border-[#2563EB]"
        />

        <PlanCard
          name="Pro"
          description="Build your customer list and collect more customer data."
          iconSrc="/Auth/2ndPageIcons/pro.svg"
          iconBgClass="bg-[#FAF5FF]"
          iconColorClass="border-[#9333EA]"
        />

        <PlanCard
          name="Scale"
          description="For high-volume brands that want lower unit costs."
          iconSrc="/Auth/2ndPageIcons/scale.svg"
          iconBgClass="bg-[#F0FDFA]"
          iconColorClass="border-[#0D9488]"
        />
      </div>
    </section>
  );
}
