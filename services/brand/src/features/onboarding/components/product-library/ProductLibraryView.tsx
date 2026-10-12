"use client";

import { Plus } from "lucide-react";
import Pager, { usePaged } from "@/components/shared/Pager";
import { Product } from "../../utils/mockData";
import ProductCard from "./ProductCard";

interface ProductLibraryViewProps {
  products: Product[];
  onViewDetails: (prod: Product) => void | Promise<void>;
  onEditProduct: (prod: Product) => void | Promise<void>;
  onViewReviews: (prod: Product) => void;
  onAddNew: () => void;
  isLoading?: boolean;
}

/** Master Product Library: product count + Add Product at the top, then the
 *  product cards (one per flavor / size). */
export default function ProductLibraryView({
  products,
  onViewDetails,
  onEditProduct,
  onViewReviews,
  onAddNew,
  isLoading = false,
}: ProductLibraryViewProps) {
  const paged = usePaged(products, 12);

  return (
    <div className="flex flex-col gap-6 w-full animate-slide-up">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold font-jakarta text-[#131B2E]">Product Library</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm font-semibold text-[#454656] font-manrope">
            {isLoading ? "Loading…" : `${products.length} product${products.length === 1 ? "" : "s"}`}
          </span>
          <button onClick={onAddNew}
            className="h-11 px-5 rounded-xl bg-[#001BD2] text-white text-sm font-bold flex items-center gap-2 cursor-pointer hover:opacity-95">
            <Plus className="w-4 h-4" /> Add Product
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 w-full">
        {isLoading
          ? Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="bg-white border border-[#C5C5D9]/10 rounded-[20px] p-4 h-[400px] flex flex-col gap-3">
                <div className="w-full h-[190px] bg-slate-100 rounded-xl animate-pulse" />
                <div className="h-5 w-3/4 rounded bg-slate-100 animate-pulse" />
                <div className="h-4 w-1/2 rounded bg-slate-100 animate-pulse" />
              </div>
            ))
          : paged.items.map((prod) => (
              <ProductCard key={`${prod.id}-${prod.imageSrc}`} product={prod} onViewDetails={onViewDetails}
                onEditProduct={onEditProduct} onViewReviews={onViewReviews} />
            ))}
      </div>

      {!isLoading && products.length === 0 && (
        <div className="bg-white border-2 border-dashed border-[#C5C5D9]/40 rounded-[20px] p-10 text-center font-manrope">
          <p className="text-sm font-bold text-[#131B2E]">No products yet</p>
          <p className="text-xs text-[#64748B] mt-1">Add a product for each flavor and size you want to run campaigns on.</p>
        </div>
      )}
      <Pager paged={paged} noun="products" />
    </div>
  );
}
