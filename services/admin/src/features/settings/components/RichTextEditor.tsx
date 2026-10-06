"use client";

import React, { useRef, useEffect, useState } from "react";

interface RichTextEditorProps {
  initialValue: string;
  onSave: (newValue: string) => void | Promise<void>;
  isSaving?: boolean;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  initialValue,
  onSave,
  isSaving = false,
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = initialValue.replace(/\n/g, "<br/>");
    }
  }, [initialValue]);

  const exec = (command: string, value: string = "") => {
    if (editorRef.current) {
      editorRef.current.focus();
    }
    document.execCommand(command, false, value);
  };

  const handleUpdate = async () => {
    if (!editorRef.current) return;

    setIsUpdating(true);
    try {
      await onSave(editorRef.current.innerHTML);
    } finally {
      setIsUpdating(false);
    }
  };

  const saving = isSaving || isUpdating;

  return (
    <div className="w-full flex flex-col gap-6 font-inter">
      {/* Editor Container */}
      <div className="w-full bg-[#FEFEFE] border border-gray-200 rounded-[12px] shadow-sm overflow-hidden flex flex-col">
        {/* Toolbar Header (Blue background `#3E3EDF`) */}
        <div className="w-full bg-[#3E3EDF] text-white p-3 flex flex-wrap items-center gap-2 rounded-t-[12px]">
          {/* Font Size Selector */}
          <select
            onChange={(e) => exec("fontSize", e.target.value)}
            defaultValue="3"
            className="bg-transparent border border-white/30 rounded px-2 py-1 text-[13px] text-white outline-none cursor-pointer"
          >
            <option value="1" className="text-gray-900">12px</option>
            <option value="2" className="text-gray-900">14px</option>
            <option value="3" className="text-gray-900">16px</option>
            <option value="4" className="text-gray-900">18px</option>
            <option value="5" className="text-gray-900">20px</option>
            <option value="6" className="text-gray-900">24px</option>
          </select>

          <div className="h-5 w-[1px] bg-white/30 mx-1" />

          {/* Style Buttons */}
          <button
            type="button"
            onClick={() => exec("bold")}
            className="w-7 h-7 rounded flex items-center justify-center font-bold text-[14px] hover:bg-white/20 active:bg-white/30 transition-colors"
            title="Bold (Selection/Upcoming)"
          >
            B
          </button>
          <button
            type="button"
            onClick={() => exec("italic")}
            className="w-7 h-7 rounded flex items-center justify-center italic font-serif text-[14px] hover:bg-white/20 active:bg-white/30 transition-colors"
            title="Italic (Selection/Upcoming)"
          >
            I
          </button>
          <button
            type="button"
            onClick={() => exec("underline")}
            className="w-7 h-7 rounded flex items-center justify-center underline text-[14px] hover:bg-white/20 active:bg-white/30 transition-colors"
            title="Underline (Selection/Upcoming)"
          >
            U
          </button>
          <button
            type="button"
            onClick={() => exec("strikeThrough")}
            className="w-7 h-7 rounded flex items-center justify-center line-through text-[14px] hover:bg-white/20 active:bg-white/30 transition-colors"
            title="Strikethrough (Selection/Upcoming)"
          >
            S
          </button>

          <div className="h-5 w-[1px] bg-white/30 mx-1" />

          {/* Alignments */}
          <button
            type="button"
            onClick={() => exec("justifyLeft")}
            className="p-1.5 rounded hover:bg-white/20 transition-colors"
            title="Align Left"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="17" y1="10" x2="3" y2="10" /><line x1="21" y1="6" x2="3" y2="6" /><line x1="21" y1="14" x2="3" y2="14" /><line x1="17" y1="18" x2="3" y2="18" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => exec("justifyCenter")}
            className="p-1.5 rounded hover:bg-white/20 transition-colors"
            title="Align Center"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="10" x2="6" y2="10" /><line x1="21" y1="6" x2="3" y2="6" /><line x1="21" y1="14" x2="3" y2="14" /><line x1="18" y1="18" x2="6" y2="18" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => exec("justifyRight")}
            className="p-1.5 rounded hover:bg-white/20 transition-colors"
            title="Align Right"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="21" y1="10" x2="7" y2="10" /><line x1="21" y1="6" x2="3" y2="6" /><line x1="21" y1="14" x2="3" y2="14" /><line x1="21" y1="18" x2="7" y2="18" />
            </svg>
          </button>

          <div className="h-5 w-[1px] bg-white/30 mx-1" />

          {/* Lists */}
          <button
            type="button"
            onClick={() => exec("insertUnorderedList")}
            className="p-1.5 rounded hover:bg-white/20 transition-colors"
            title="Bullet List"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => exec("insertOrderedList")}
            className="p-1.5 rounded hover:bg-white/20 transition-colors"
            title="Numbered List"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="10" y1="6" x2="21" y2="6" /><line x1="10" y1="12" x2="21" y2="12" /><line x1="10" y1="18" x2="21" y2="18" /><path d="M4 6h1v4M4 10h2M4 14h3l-3 4h3" />
            </svg>
          </button>
        </div>

        {/* contentEditable Area */}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          className="w-full p-6 min-h-[220px] outline-none bg-white text-[#1F1D1D] leading-[170%]"
        />
      </div>

      {/* Bottom Update Button */}
      <div className="w-full flex justify-end">
        <button
          type="button"
          onClick={handleUpdate}
          disabled={saving}
          className="h-[48px] px-12 bg-[#3E3EDF] hover:bg-[#3232C7] disabled:cursor-not-allowed disabled:opacity-60 text-white font-medium text-[16px] rounded-[8px] shadow-md transition-colors cursor-pointer"
        >
          {saving ? "Saving..." : "Update"}
        </button>
      </div>
    </div>
  );
};
