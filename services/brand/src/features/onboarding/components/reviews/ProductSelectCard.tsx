/* eslint-disable @next/next/no-img-element */
"use client";

interface ProductItem {
  id: string;
  name: string;
  category: string;
  imageSrc: string;
}

interface ProductSelectCardProps {
  product: ProductItem;
  isSelected: boolean;
  onToggle: (id: string) => void;
}

export default function ProductSelectCard({ product, isSelected, onToggle }: ProductSelectCardProps) {
  return (
    <div
      onClick={() => onToggle(product.id)}
      className={`relative w-full max-w-[206.25px] h-[290.25px] bg-white rounded-[20px] overflow-hidden flex flex-col cursor-pointer transition-all ${
        isSelected
          ? "shadow-[0px_0px_0px_2px_#001BD2]"
          : "shadow-[0px_0px_0px_1px_rgba(197,197,217,0.15)] hover:shadow-[0px_0px_0px_1px_rgba(197,197,217,0.3)]"
      }`}
    >
      {/* Product Image Wrapper */}
      <div className="w-full h-[206px] bg-[#FAF8FF] flex items-center justify-center overflow-hidden p-4">
        <img
          src={product.imageSrc}
          alt={product.name}
          className="max-h-full max-w-full object-contain transition-transform hover:scale-105"
        />
      </div>

      {/* Checkbox Overlay */}
      <div
        className={`absolute w-6 h-6 right-4 top-4 border rounded-[6px] flex items-center justify-center transition-all ${
          isSelected
            ? "bg-[#001BD2] border-[#001BD2] text-white"
            : "bg-white border-[#C5C5D9]"
        }`}
      >
        {isSelected && <span className="text-[12px] font-bold">✓</span>}
      </div>

      {/* Bottom Labels */}
      <div className="p-4 flex flex-col gap-1 text-left bg-white flex-grow justify-center border-t border-slate-50">
        <h4 className="text-base font-extrabold text-[#131B2E] font-jakarta truncate leading-normal">
          {product.name}
        </h4>
        <span className="text-xs font-medium text-[#454656] font-manrope truncate">
          {product.category}
        </span>
      </div>
    </div>
  );
}
