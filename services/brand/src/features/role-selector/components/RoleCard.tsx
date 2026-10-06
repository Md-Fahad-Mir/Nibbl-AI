import Image from "next/image";
import Link from "next/link";

interface RoleCardProps {
  title: string;
  description: string;
  buttonText: string;
  buttonColorClass: string;
  imageSrc: string;
  iconSrc: string;
  iconBgClass: string;
  iconColorClass: string;
  href: string;
}

export default function RoleCard({
  title,
  description,
  buttonText,
  buttonColorClass,
  imageSrc,
  iconSrc,
  iconBgClass,
  iconColorClass,
  href,
}: RoleCardProps) {
  return (
    <div className="flex-1 flex flex-col justify-between p-6 bg-white border border-slate-100 rounded-[32px] transition-all duration-300 hover:shadow-xl hover:scale-[1.01] hover:border-slate-200">
      {/* Visual Illustration Container */}
      <div className="w-full flex justify-center pb-8">
        <div className="relative w-[315px] h-[276px] rounded-2xl overflow-hidden bg-white border border-slate-50 shadow-sm flex items-center justify-center">
          <Image
            src={imageSrc}
            alt={`${title} visual`}
            fill
            className="object-contain p-2"
            priority
          />
        </div>
      </div>

      {/* Content Container */}
      <div className="flex flex-col flex-1 gap-4 font-sans">
        <div className="flex items-center gap-4">
          {/* Icon Wrapper */}
          <div
            className={`w-12 h-12 flex items-center justify-center rounded-2xl border ${iconBgClass} ${iconColorClass}`}
          >
            <Image
              src={iconSrc}
              alt={`${title} icon`}
              width={24}
              height={24}
              className="object-contain"
            />
          </div>
          {/* Title */}
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">
            {title}
          </h2>
        </div>

        {/* Description Text */}
        <p className="text-slate-600 font-medium text-base leading-relaxed flex-1">
          {description}
        </p>

        {/* Action Button */}
        <Link
          href={href}
          className={`flex items-center justify-center gap-2 h-14 w-full rounded-xl font-semibold text-white transition-all duration-200 hover:opacity-95 active:scale-[0.98] ${buttonColorClass}`}
        >
          <span>{buttonText}</span>
          <svg
            className="w-5 h-5 transition-transform duration-200 group-hover:translate-x-1"
            viewBox="0 0 20 20"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M3.33334 10H16.6667M16.6667 10L11.6667 5M16.6667 10L11.6667 15"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>
      </div>
    </div>
  );
}
