/* eslint-disable @next/next/no-img-element */
interface FeatureItemProps {
  title: string;
  description: string;
  iconSrc: string;
  bgClass: string;
  borderClass: string;
}

function FeatureItem({
  title,
  description,
  iconSrc,
  bgClass,
  borderClass,
}: FeatureItemProps) {
  return (
    <div className="flex items-center gap-3.5 font-jakarta">
      {/* Icon Wrapper */}
      <div
        className={`w-10 h-10 rounded-full flex items-center justify-center border ${bgClass} ${borderClass} flex-shrink-0`}
      >
        <img
          src={iconSrc}
          alt={`${title} icon`}
          className="w-5 h-5 object-contain"
        />
      </div>

      {/* Texts */}
      <div className="flex flex-col">
        <h5 className="text-[13px] font-bold text-[#0F172A] leading-tight">
          {title}
        </h5>
        <p className="text-[10px] text-[#64748B] font-medium mt-0.5 leading-tight">
          {description}
        </p>
      </div>
    </div>
  );
}

export default function FeaturesRow() {
  return (
    <section className="w-full bg-white border border-[#F1F5F9] rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow duration-300">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 md:gap-8 justify-between">
        <FeatureItem
          title="You fund the wallet"
          description="Add funds anytime. We don't charge for performance."
          iconSrc="/Auth/2ndPageIcons/fundAndWallet.png"
          bgClass="bg-[#ECFDF5]"
          borderClass="border-[#059669]"
        />

        <FeatureItem
          title="Full control"
          description="Set daily spend limits and adjust offers anytime."
          iconSrc="/Auth/2ndPageIcons/fullControl.svg"
          bgClass="bg-[#EFF6FF]"
          borderClass="border-[#2563EB]"
        />

        <FeatureItem
          title="No performance fees"
          description="Flexible plans that grow with your brand."
          iconSrc="/Auth/2ndPageIcons/noPerformanceFee.svg"
          bgClass="bg-[#EEF2FF]"
          borderClass="border-[#4F46E5]"
        />

        <FeatureItem
          title="Fraud protection built-in"
          description="We verify receipts and protect your budget."
          iconSrc="/Auth/2ndPageIcons/FroudProtection.svg"
          bgClass="bg-[#F0FDFA]"
          borderClass="border-[#0D9488]"
        />
      </div>
    </section>
  );
}
