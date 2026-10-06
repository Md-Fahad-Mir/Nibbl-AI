/* eslint-disable @next/next/no-img-element */
"use client";

interface Category {
  id: string;
  name: string;
  iconSrc: string;
}

export const categories: Category[] = [
  { id: "food", name: "Food & Drinks", iconSrc: "/Auth/3rdPageIcons/food&Drink.svg" },
  { id: "health", name: "Health", iconSrc: "/Auth/3rdPageIcons/health.svg" },
  { id: "beauty", name: "Beauty", iconSrc: "/Auth/3rdPageIcons/Beauty.svg" },
  { id: "home", name: "Home", iconSrc: "/Auth/3rdPageIcons/Home.svg" },
  { id: "kids", name: "Kids", iconSrc: "/Auth/3rdPageIcons/kids.svg" },
  { id: "other", name: "Other", iconSrc: "/Auth/3rdPageIcons/others.svg" },
];

interface CategoryGridProps {
  selected: string;
  onSelect: (categoryId: string) => void;
}

export default function CategoryGrid({ selected, onSelect }: CategoryGridProps) {
  return (
    <div className="w-full flex flex-col gap-3 font-manrope">
      {/* Grid Label */}
      <label className="text-sm font-bold text-[#454656] tracking-tight">
        Business Category
      </label>

      {/* Grid */}
      <div className="grid grid-cols-3 gap-3">
        {categories.map((cat) => {
          const isSelected = selected === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onSelect(cat.id)}
              className={`h-[110px] rounded-2xl bg-white border p-3 flex flex-col items-center justify-center gap-2 transition-all duration-200 cursor-pointer ${
                isSelected
                  ? "border-[#001BD2] ring-1 ring-[#001BD2] shadow-sm shadow-blue-500/5"
                  : "border-slate-200/60 hover:border-slate-300"
              }`}
            >
              {/* Icon Circle */}
              <div className="w-12 h-12 rounded-full bg-[#E2E7FF] flex items-center justify-center">
                <img
                  src={cat.iconSrc}
                  alt={`${cat.name} icon`}
                  className="w-6 h-6 object-contain"
                />
              </div>

              {/* Name */}
              <span className="text-xs font-bold text-[#131B2E] tracking-tight">
                {cat.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
