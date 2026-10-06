"use client";

import React, { useMemo, useState } from "react";

interface PaginationBarProps {
  currentPage?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
}

export const PaginationBar: React.FC<PaginationBarProps> = ({
  currentPage = 1,
  totalPages = 1,
  onPageChange,
}) => {
  const [goToInput, setGoToInput] = useState(String(currentPage));
  const safeTotalPages = Math.max(1, totalPages);
  const safeCurrentPage = Math.min(Math.max(currentPage, 1), safeTotalPages);

  const pages = useMemo(() => {
    const pageSet = new Set([1, safeCurrentPage - 1, safeCurrentPage, safeCurrentPage + 1, safeTotalPages]);
    return Array.from(pageSet)
      .filter((page) => page >= 1 && page <= safeTotalPages)
      .sort((a, b) => a - b);
  }, [safeCurrentPage, safeTotalPages]);

  const handlePageClick = (page: number) => {
    setGoToInput(String(page));
    onPageChange?.(page);
  };

  const handleGoTo = () => {
    const pageNum = parseInt(goToInput, 10);
    if (pageNum >= 1 && pageNum <= safeTotalPages) {
      handlePageClick(pageNum);
    }
  };

  if (safeTotalPages <= 1) return null;

  return (
    <div className="w-full flex flex-wrap items-center justify-center gap-4 py-4 font-poppins text-[14px]">
      {/* Page Numbers Control Cluster */}
      <div className="flex items-center gap-2">
        {/* Back Button */}
        <button
          type="button"
          onClick={() => safeCurrentPage > 1 && handlePageClick(safeCurrentPage - 1)}
          disabled={safeCurrentPage <= 1}
          className="h-[36px] px-3 bg-[#FEFEFE] shadow-[0px_2px_8px_rgba(0,0,0,0.1)] border border-[#FEFEFE] rounded-[4px] text-[#1F1D1D] flex items-center gap-1 hover:bg-gray-50 transition-colors disabled:opacity-50 cursor-pointer"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
          <span>Back</span>
        </button>

        {pages.map((page, index) => (
          <React.Fragment key={page}>
            {index > 0 && page - pages[index - 1] > 1 && (
              <span className="h-[36px] min-w-[31px] bg-[#FEFEFE] shadow-[0px_2px_8px_rgba(0,0,0,0.1)] rounded-[4px] flex items-center justify-center px-2 text-[#1F1D1D]">
                ...
              </span>
            )}
            <button
              type="button"
              onClick={() => handlePageClick(page)}
              className={`h-[36px] min-w-[29px] px-2 rounded-[4px] flex items-center justify-center cursor-pointer transition-colors ${
                safeCurrentPage === page
                  ? "bg-[#3E3EDF] text-[#FEFEFE] font-medium"
                  : "bg-[#FEFEFE] shadow-[0px_2px_8px_rgba(0,0,0,0.1)] text-[#1F1D1D]"
              }`}
            >
              {page}
            </button>
          </React.Fragment>
        ))}

        {/* Next Button */}
        <button
          type="button"
          onClick={() =>
            safeCurrentPage < safeTotalPages && handlePageClick(safeCurrentPage + 1)
          }
          disabled={safeCurrentPage >= safeTotalPages}
          className="h-[36px] px-3 bg-[#3E3EDF] hover:bg-[#3232C7] text-[#FEFEFE] rounded-[4px] flex items-center gap-1 transition-colors disabled:opacity-50 cursor-pointer"
        >
          <span>Next</span>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {/* Go To Page Cluster */}
      <div className="flex items-center gap-2 text-gray-700">
        <span>Page</span>
        <input
          type="text"
          value={goToInput}
          onChange={(e) => setGoToInput(e.target.value)}
          className="w-[51px] h-[36px] px-2 bg-[#FEFEFE] shadow-[0px_2px_8px_rgba(0,0,0,0.1)] border border-[#FEFEFE] rounded-[4px] text-center font-poppins text-[14px] text-[#1F1D1D] outline-none"
        />
        <button
          type="button"
          onClick={handleGoTo}
          className="h-[36px] px-3 bg-[#3E3EDF] hover:bg-[#3232C7] text-white rounded-[4px] font-poppins text-[14px] cursor-pointer transition-colors"
        >
          Go
        </button>
      </div>
    </div>
  );
};
