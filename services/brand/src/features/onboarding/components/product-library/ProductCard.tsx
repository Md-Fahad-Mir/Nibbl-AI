/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";
import { Ellipsis, Pencil, Star } from "lucide-react";
import { Product } from "../../utils/mockData";

interface ProductCardProps {
  product: Product;
  onViewDetails: (prod: Product) => void | Promise<void>;
  onEditProduct: (prod: Product) => void | Promise<void>;
  onViewReviews: (prod: Product) => void;
}

const titleCase = (value: string) =>
  value.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

/** Master Product Library card: image, name, flavor · size, clickable
 *  rating, category, Product ID, receipt alias count, Edit Product. */
export default function ProductCard({ product, onViewDetails, onEditProduct, onViewReviews }: ProductCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const variant = [product.flavor && titleCase(product.flavor), product.sizeLabel || product.size].filter(Boolean).join(" · ");
  const reviews = product.reviewCount ?? 0;

  return (
    <div className="bg-white border border-[#C5C5D9]/20 rounded-[20px] p-4 shadow-sm flex flex-col gap-3 font-jakarta hover:shadow-md transition-shadow">
      <div className="relative">
        <button onClick={() => onViewDetails(product)} aria-label={`View ${product.name}`}
          className="relative w-full h-[190px] bg-slate-50 rounded-xl overflow-hidden cursor-pointer block">
          {!imageLoaded && <div className="absolute inset-0 bg-slate-100 animate-pulse" />}
          <img src={product.imageSrc} alt={product.name} loading="lazy"
            onLoad={() => setImageLoaded(true)} onError={() => setImageLoaded(true)}
            className={`w-full h-full object-contain transition-opacity duration-200 ${imageLoaded ? "opacity-100" : "opacity-0"}`} />
        </button>
        <button type="button" onClick={() => setMenuOpen((open) => !open)} aria-label="Product actions" aria-expanded={menuOpen}
          className="absolute right-2 top-2 w-8 h-8 rounded-full bg-white shadow flex items-center justify-center text-[#454656] cursor-pointer">
          <Ellipsis className="w-4 h-4" />
        </button>
        {menuOpen && (
          <div role="menu" onMouseLeave={() => setMenuOpen(false)}
            className="absolute right-2 top-11 z-10 w-40 bg-white rounded-xl shadow-lg border border-[#EAEDFF] py-1 text-sm font-manrope">
            {([
              ["View Details", () => onViewDetails(product)],
              ["Edit Product", () => onEditProduct(product)],
              ["View Reviews", () => onViewReviews(product)],
            ] as [string, () => void][]).map(([label, action]) => (
              <button key={label} type="button" role="menuitem"
                onClick={() => { setMenuOpen(false); action(); }}
                className="w-full text-left px-3 py-2 text-[#131B2E] hover:bg-[#F2F3FF] cursor-pointer">
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-0.5">
        <h3 className="text-base font-bold text-[#131B2E] tracking-tight line-clamp-1">{product.name}</h3>
        <p className="text-xs text-[#64748B] line-clamp-1">{variant || "—"}</p>
        {reviews > 0 ? (
          <button onClick={() => onViewReviews(product)}
            className="self-start flex items-center gap-1 text-xs font-bold text-[#001BD2] hover:underline cursor-pointer mt-1">
            <Star className="w-3.5 h-3.5 fill-[#001BD2]" /> {product.avgRating == null ? "—" : Number(product.avgRating).toFixed(1)} · {reviews} review{reviews === 1 ? "" : "s"}
          </button>
        ) : (
          <span className="text-xs text-[#94A3B8] mt-1">No reviews yet</span>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs font-manrope">
        <div><dt className="text-[#94A3B8]">Category</dt><dd className="font-semibold text-[#131B2E]">{product.category ? titleCase(product.category) : "—"}</dd></div>
        <div><dt className="text-[#94A3B8]">Product ID</dt><dd className="font-semibold text-[#131B2E]">{product.code || "—"}</dd></div>
        <div><dt className="text-[#94A3B8]">Receipt Aliases</dt><dd className="font-semibold text-[#131B2E]">{product.aliasCount ?? product.aliases.length}</dd></div>
      </dl>

      <button onClick={() => onEditProduct(product)}
        className="mt-auto h-10 rounded-xl bg-[#E2E7FF] text-[#001BD2] text-sm font-bold flex items-center justify-center gap-2 cursor-pointer hover:bg-[#D0D7FF]">
        <Pencil className="w-4 h-4" /> Edit Product
      </button>
    </div>
  );
}
