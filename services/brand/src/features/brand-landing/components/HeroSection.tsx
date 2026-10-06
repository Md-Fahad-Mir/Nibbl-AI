/* eslint-disable @next/next/no-img-element */
import Image from "next/image";

export default function HeroSection() {
  return (
    <section className="w-full flex flex-col lg:flex-row items-center gap-12 lg:gap-8 justify-between font-jakarta py-8">
      {/* Left Content Column */}
      <div className="w-full lg:max-w-[480px] flex flex-col gap-6 items-start">
        {/* Background Badge */}
        <div className="bg-[#F5F7FF] px-3.5 py-1 rounded-full border border-blue-50">
          <span className="text-[11.2px] font-extrabold text-[#2D3FEA] tracking-[1.12px] uppercase">
            The NibblAI Advantage
          </span>
        </div>

        {/* Heading */}
        <h1 className="text-4xl md:text-[56px] leading-[1.05] font-extrabold text-[#0F172A] tracking-tight">
          Turn in-store shoppers into customers you actually own.
        </h1>

        {/* Description */}
        <p className="text-[#64748B] text-base md:text-[17px] leading-relaxed font-normal">
          Rebates drive trial. Reviews build trust. NibblAI connects in-store
          purchases to real customer relationships—so you can grow smarter and
          market with confidence.
        </p>

        {/* Process Steps */}
        <div className="w-full pt-6 border-t border-[#F1F5F9] relative">
          <div className="flex flex-col sm:flex-row gap-6 justify-between">
            {/* Step 1 */}
            <div className="flex flex-col gap-2 items-start max-w-[136px]">
              <div className="w-[30px] h-[30px] rounded-md bg-[#F5F7FF] flex items-center justify-center border border-blue-50">
                <img
                  src="/Auth/2ndPageIcons/inpourchase.svg"
                  alt="In-store purchase icon"
                  className="w-[18px] h-[18px] object-contain"
                />
              </div>
              <span className="text-[11px] font-semibold text-[#475569]">
                In-store purchase happens
              </span>
            </div>

            {/* Step 2 */}
            <div className="flex flex-col gap-2 items-start max-w-[136px]">
              <div className="w-[30px] h-[30px] rounded-md bg-[#FAF5FF] flex items-center justify-center border border-purple-50">
                <img
                  src="/Auth/2ndPageIcons/captureVerify.svg"
                  alt="Capture and verify icon"
                  className="w-[18px] h-[18px] object-contain"
                />
              </div>
              <span className="text-[11px] font-semibold text-[#475569]">
                NibblAI captures & verifies
              </span>
            </div>

            {/* Step 3 */}
            <div className="flex flex-col gap-2 items-start max-w-[136px]">
              <div className="w-[30px] h-[30px] rounded-md bg-[#ECFDF5] flex items-center justify-center border border-emerald-50">
                <img
                  src="/Auth/2ndPageIcons/buildTheRelationship.svg"
                  alt="Build relationship icon"
                  className="w-[18px] h-[18px] object-contain"
                />
              </div>
              <span className="text-[11px] font-semibold text-[#475569]">
                You build the relationship
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column: Visual Component */}
      <div className="flex-1 w-full max-w-[704px] flex flex-col gap-8">
        {/* Main Image */}
        <div className="relative w-full h-[320px] sm:h-[407px] rounded-2xl overflow-hidden shadow-sm">
          <Image
            src="/Auth/2ndPageTopImage.svg"
            alt="Product receipt verification workflow mockup"
            fill
            className="object-contain"
            priority
          />
        </div>

        {/* Small Highlight Cards Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-jakarta">
          {/* Card 1 */}
          <div className="bg-white border border-[#F8FAFC] shadow-sm p-3.5 rounded-lg flex items-start gap-2.5">
            <div className="w-6 h-6 rounded bg-[#EEF2FF] flex items-center justify-center flex-shrink-0">
              <img
                src="/Auth/2ndPageIcons/buildCustomerList.svg"
                alt="Build customer list icon"
                className="w-3.5 h-3.5 object-contain"
              />
            </div>
            <div>
              <h4 className="text-[11px] font-bold text-[#0F172A]">Build your customer list</h4>
              <p className="text-[9px] text-[#64748B] mt-0.5 leading-normal">
                Collect emails, phone numbers & insights (Pro/Scale)
              </p>
            </div>
          </div>

          {/* Card 2 */}
          <div className="bg-white border border-[#F8FAFC] shadow-sm p-3.5 rounded-lg flex items-start gap-2.5">
            <div className="w-6 h-6 rounded bg-[#EFF6FF] flex items-center justify-center flex-shrink-0">
              <img
                src="/Auth/2ndPageIcons/tumIeadIntoBuyer.svg"
                alt="Turn leads into buyers icon"
                className="w-3.5 h-3.5 object-contain"
              />
            </div>
            <div>
              <h4 className="text-[11px] font-bold text-[#0F172A]">Turn leads into buyers</h4>
              <p className="text-[9px] text-[#64748B] mt-0.5 leading-normal">
                Re-engage & convert with emails, SMS & ads
              </p>
            </div>
          </div>

          {/* Card 3 */}
          <div className="bg-white border border-[#F8FAFC] shadow-sm p-3.5 rounded-lg flex items-start gap-2.5">
            <div className="w-6 h-6 rounded bg-[#FAF5FF] flex items-center justify-center flex-shrink-0">
              <img
                src="/Auth/2ndPageIcons/brandLoyalist.svg"
                alt="Create brand loyalists icon"
                className="w-3.5 h-3.5 object-contain"
              />
            </div>
            <div>
              <h4 className="text-[11px] font-bold text-[#0F172A]">Create brand loyalists</h4>
              <p className="text-[9px] text-[#64748B] mt-0.5 leading-normal">
                Deliver experiences driving repeat purchases
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
