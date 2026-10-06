"use client";

import React from "react";
import { BrandDetail } from "@/types/brand.types";
import { PaginationBar } from "@/features/earnings/components/PaginationBar";
import { useClientPagination } from "@/hooks/useClientPagination";

interface BrandListTableProps {
  brands?: BrandDetail[];
  onViewBrand?: (brand: BrandDetail) => void;
  onDeleteBrand?: (brand: BrandDetail) => void;
  onReactivateBrand?: (brand: BrandDetail) => void;
  onApproveBrandAccount?: (brand: BrandDetail) => void;
}

export const BrandListTable: React.FC<BrandListTableProps> = ({
  brands = [],
  onViewBrand,
  onDeleteBrand,
  onReactivateBrand,
  onApproveBrandAccount,
}) => {
  const {
    currentPage,
    totalPages,
    paginatedItems,
    setPage,
  } = useClientPagination(brands, 10);

  return (
    <div className="w-full bg-[#FEFEFE] rounded-[8px] shadow-[0px_2px_8px_rgba(0,0,0,0.1)] p-4 sm:p-6 flex flex-col gap-6 overflow-hidden">
      {/* Top Header */}
      <div className="w-full flex items-center justify-between gap-4">
        <h2 className="font-inter text-[20px] font-medium leading-[24px] text-[#1F1D1D]">
          Brand List
        </h2>
      </div>

      {/* Table Container */}
      <div className="w-full overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[700px]">
          {/* Table Header */}
          <thead>
            <tr className="bg-[#3E3EDF] text-[#FEFEFE] font-inter text-[16px] font-medium leading-[150%] h-[50px]">
              <th className="px-6 py-3 rounded-l-[4px]">#Sl</th>
              <th className="px-6 py-3">Brand Name</th>
              <th className="px-6 py-3">Email</th>
              <th className="px-6 py-3">Number</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3">Date</th>
              <th className="px-6 py-3 text-right rounded-r-[4px]">Action</th>
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="font-inter text-[14px] text-[#575757]">
            {paginatedItems.length ? paginatedItems.map((bnd) => (
              <tr
                key={bnd.id}
                className="h-[52px] border-b border-gray-100 hover:bg-gray-50 transition-colors"
              >
                <td className="px-6 py-3">{bnd.sl}</td>
                <td className="px-6 py-3">{bnd.brandName}</td>
                <td className="px-6 py-3">{bnd.email}</td>
                <td className="px-6 py-3">{bnd.number}</td>
                <td className="px-6 py-3 capitalize">{bnd.status || "active"}</td>
                <td className="px-6 py-3">{bnd.date}</td>
                <td className="px-6 py-3 text-right">
                  <div className="inline-flex items-center justify-end gap-2">
                    {bnd.canApprove && (
                      <button
                        type="button"
                        onClick={() => onApproveBrandAccount && onApproveBrandAccount(bnd)}
                        className="inline-flex items-center justify-center h-8 px-3 text-[13px] font-medium text-white bg-[#22A06B] hover:bg-[#1F8F60] rounded-[6px] transition-colors cursor-pointer"
                        aria-label={`Approve brand account ${bnd.brandName}`}
                      >
                        Approve
                      </button>
                    )}
                    {bnd.source === "brand" && bnd.status?.toLowerCase() === "suspended" && (
                      <button
                        type="button"
                        onClick={() => onReactivateBrand && onReactivateBrand(bnd)}
                        className="inline-flex items-center justify-center h-8 px-3 text-[13px] font-medium text-white bg-[#22A06B] hover:bg-[#1F8F60] rounded-[6px] transition-colors cursor-pointer"
                        aria-label={`Activate brand ${bnd.brandName}`}
                      >
                        Activate
                      </button>
                    )}
                    {/* View Eye Icon */}
                    <button
                      type="button"
                      onClick={() => onViewBrand && onViewBrand(bnd)}
                      className="inline-flex items-center justify-center w-8 h-8 text-[#3E3EDF] hover:bg-[#3E3EDF]/10 rounded-full transition-colors cursor-pointer"
                      aria-label={`View details for ${bnd.brandName}`}
                    >
                      <svg
                        width="22"
                        height="22"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#3E3EDF"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    </button>

                    {/* Delete Red Trash Icon */}
                    <button
                      type="button"
                      onClick={() => onDeleteBrand && onDeleteBrand(bnd)}
                      className="inline-flex items-center justify-center w-8 h-8 text-[#FF5C5C] hover:bg-[#FF5C5C]/10 rounded-full transition-colors cursor-pointer"
                      aria-label={
                        bnd.source === "brand-application"
                          ? `Reject brand application ${bnd.brandName}`
                          : `Delete brand ${bnd.brandName}`
                      }
                    >
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#FF5C5C"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        <line x1="10" y1="11" x2="10" y2="17" />
                        <line x1="14" y1="11" x2="14" y2="17" />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            )) : (
              <tr className="h-[72px] border-b border-gray-100">
                <td colSpan={7} className="px-6 py-5 text-center text-[#777777]">
                  No brands returned from the backend.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Bar */}
      <PaginationBar
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setPage}
      />
    </div>
  );
};
