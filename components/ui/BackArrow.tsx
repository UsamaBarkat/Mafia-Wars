"use client";

// Top-left, left-pointing back control (FR-11). Presentational: it just calls
// onBack — the caller decides what "back" means for the current screen.

type BackArrowProps = {
  onBack: () => void;
  /** Accessible label; defaults to a generic "Go back". */
  label?: string;
};

export function BackArrow({ onBack, label = "Go back" }: BackArrowProps) {
  return (
    <button
      type="button"
      onClick={onBack}
      aria-label={label}
      className="absolute left-4 top-4 flex h-10 w-10 items-center justify-center rounded-full text-neutral-300 hover:bg-white/10 active:bg-white/20"
    >
      {/* Left-pointing chevron */}
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-6 w-6"
        aria-hidden="true"
      >
        <path d="M15 19l-7-7 7-7" />
      </svg>
    </button>
  );
}
