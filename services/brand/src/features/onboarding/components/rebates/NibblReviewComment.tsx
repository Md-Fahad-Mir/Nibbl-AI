interface NibblReviewCommentProps {
  comment?: string;
  label?: string;
  compact?: boolean;
}

/** Nibbl's comment on a campaign review (changes requested / rejected). */
export default function NibblReviewComment({ comment, label, compact = false }: NibblReviewCommentProps) {
  if (!comment) return null;
  return (
    <div
      className={`bg-amber-50 border border-amber-200 text-left ${
        compact ? "rounded-xl px-3 py-2 mt-3" : "rounded-2xl px-5 py-4 mb-4"
      }`}
    >
      <span className="block text-[10px] font-bold text-amber-700 uppercase tracking-wider">
        {label || "Nibbl's comment"}
      </span>
      <p className={`text-[#131B2E] font-medium mt-1 ${compact ? "text-xs line-clamp-3" : "text-sm"}`}>
        {comment}
      </p>
    </div>
  );
}
