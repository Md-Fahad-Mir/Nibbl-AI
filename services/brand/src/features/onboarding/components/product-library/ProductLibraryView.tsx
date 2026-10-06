"use client";

import { useMemo, useState } from "react";
import ProductCard from "./ProductCard";

interface Product {
  id: string;
  name: string;
  imageSrc: string;
  category: string;
  flavor: string;
  format: string;
  size: string;
  aliases: string[];
  aliasCount?: number;
  activeCampaigns: number;
}

interface ProductLibraryViewProps {
  products: Product[];
  onViewDetails: (prod: Product) => void | Promise<void>;
  onEditProduct: (prod: Product) => void | Promise<void>;
  onAddNew: () => void;
  isLoading?: boolean;
}

export default function ProductLibraryView({
  products,
  onViewDetails,
  onEditProduct,
  onAddNew,
  isLoading = false,
}: ProductLibraryViewProps) {
  const [page, setPage] = useState(1);
  const itemsPerPage = 7;
  const totalPages = Math.max(1, Math.ceil(products.length / itemsPerPage));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * itemsPerPage;
  const paginatedProducts = products.slice(pageStart, pageStart + itemsPerPage);
  const pageNumbers = useMemo(
    () => Array.from({ length: totalPages }, (_, index) => index + 1),
    [totalPages]
  );
  const activeCategories = new Set(products.map((product) => product.category).filter(Boolean)).size;
  const skeletonItems = Array.from({ length: 3 }, (_, index) => index);

  return (
    <div className="flex flex-col gap-8 w-full animate-slide-up">
      {/* Header Title */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold font-jakarta text-[#131B2E]">
          Product Library
        </h1>
      </div>

      {/* Metrics Header Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-[#C5C5D9]/10 rounded-2xl p-6 shadow-sm flex flex-col font-jakarta">
          <span className="text-xs font-semibold text-[#454656] tracking-wider uppercase font-manrope">
            Total SKUs
          </span>
          {isLoading ? (
            <span className="mt-3 h-9 w-14 rounded-lg bg-slate-100 animate-pulse" />
          ) : (
            <span className="text-[30px] font-extrabold text-[#131B2E] mt-2">
              {products.length}
            </span>
          )}
        </div>
        <div className="bg-white border border-[#C5C5D9]/10 rounded-2xl p-6 shadow-sm flex flex-col font-jakarta">
          <span className="text-xs font-semibold text-[#454656] tracking-wider uppercase font-manrope">
            Active Categories
          </span>
          {isLoading ? (
            <span className="mt-3 h-9 w-14 rounded-lg bg-slate-100 animate-pulse" />
          ) : (
            <span className="text-[30px] font-extrabold text-[#131B2E] mt-2">
              {activeCategories}
            </span>
          )}
        </div>
        <div className="bg-white border border-[#C5C5D9]/10 rounded-2xl p-6 shadow-sm flex flex-col font-jakarta">
          <span className="text-xs font-semibold text-[#454656] tracking-wider uppercase font-manrope">
            Out of Stock
          </span>
          {isLoading ? (
            <span className="mt-3 h-9 w-14 rounded-lg bg-slate-100 animate-pulse" />
          ) : (
            <span className="text-[30px] font-extrabold text-[#DC2626] mt-2">
              0
            </span>
          )}
        </div>
      </div>

      {/* Product Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 w-full">
        {isLoading
          ? skeletonItems.map((item) => (
              <div
                key={item}
                className="bg-white border border-[#C5C5D9]/10 rounded-[20px] p-6 shadow-sm flex flex-col justify-between h-[420px] font-jakarta"
              >
                <div className="w-full h-[180px] bg-slate-100 rounded-xl mb-4 animate-pulse" />
                <div className="flex-grow flex flex-col gap-3 justify-between">
                  <div className="flex flex-col gap-3">
                    <div className="h-5 w-3/4 rounded bg-slate-100 animate-pulse" />
                    <div className="flex gap-2">
                      <div className="h-5 w-16 rounded bg-slate-100 animate-pulse" />
                      <div className="h-5 w-20 rounded bg-slate-100 animate-pulse" />
                      <div className="h-5 w-14 rounded bg-slate-100 animate-pulse" />
                    </div>
                  </div>
                  <div className="border-t border-slate-100 pt-4 flex justify-between">
                    <div className="h-4 w-20 rounded bg-slate-100 animate-pulse" />
                    <div className="h-4 w-28 rounded bg-slate-100 animate-pulse" />
                  </div>
                  <div className="h-4 w-full rounded bg-slate-100 animate-pulse" />
                </div>
              </div>
            ))
          : paginatedProducts.map((prod) => (
              <ProductCard
                key={`${prod.id}-${prod.imageSrc}`}
                product={prod}
                onViewDetails={onViewDetails}
                onEditProduct={onEditProduct}
              />
            ))}

        {/* Add New Product Card */}
        <button
          onClick={onAddNew}
          className="bg-white border-2 border-dashed border-[#C5C5D9]/40 rounded-[20px] p-6 shadow-sm flex flex-col items-center justify-center gap-4 h-[420px] hover:border-[#001BD2] hover:bg-[#E2E7FF]/5 transition-colors cursor-pointer w-full group"
        >
          <div className="w-12 h-12 rounded-full bg-[#E2E7FF] text-[#001BD2] font-bold flex items-center justify-center text-xl group-hover:scale-105 transition-transform">
            +
          </div>
          <div className="text-center font-jakarta">
            <h3 className="text-sm font-bold text-[#131B2E]">
              Add New Product
            </h3>
            <p className="text-xs text-[#64748B] font-medium mt-1">
              Manual entry or direct upload
            </p>
          </div>
        </button>
      </div>

      <div className="flex justify-between items-center px-4 py-4 bg-[#F2F3FF] border-t border-[#C5C5D9]/5 rounded-xl font-manrope mt-4">
        <span className="text-xs font-semibold text-[#454656]">
          {isLoading
            ? "Loading products..."
            : `Showing ${products.length ? pageStart + 1 : 0} - ${Math.min(pageStart + paginatedProducts.length, products.length)} of ${products.length} products`}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            disabled={currentPage === 1}
            className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-xs text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            &lt;
          </button>
          {pageNumbers.map((pageNumber) => (
            <button
              key={pageNumber}
              type="button"
              onClick={() => setPage(pageNumber)}
              className={`w-8 h-8 rounded-lg border flex items-center justify-center text-xs font-bold ${
                currentPage === pageNumber
                  ? "bg-[#001BD2] text-white border-[#001BD2]"
                  : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
              }`}
            >
              {pageNumber}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
            disabled={currentPage === totalPages}
            className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-xs text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            &gt;
          </button>
        </div>
      </div>

      {/* Pagination footer */}
      <div className="hidden">
        <span className="text-xs font-semibold text-[#454656]">
          Showing 1 - {products.length} of {products.length} products
        </span>
        <div className="flex items-center gap-1">
          <button className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-xs text-slate-500 hover:bg-slate-50">
            ‹
          </button>
          <button className="w-8 h-8 rounded-lg bg-[#001BD2] text-white flex items-center justify-center text-xs font-bold">
            1
          </button>
          <button className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-xs text-slate-500 hover:bg-slate-50">
            2
          </button>
          <button className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-xs text-slate-500 hover:bg-slate-50">
            3
          </button>
          <span className="px-1 text-slate-400 text-xs">...</span>
          <button className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-xs text-slate-500 hover:bg-slate-50">
            ›
          </button>
        </div>
      </div>
    </div>
  );
}
