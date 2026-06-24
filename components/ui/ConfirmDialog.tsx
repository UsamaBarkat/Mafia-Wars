"use client";

// Simple yes/no modal (FR-11 reveal exit). Presentational: the caller mounts it
// when needed and supplies the message + confirm/cancel handlers. Centered overlay,
// works portrait or landscape.

type ConfirmDialogProps = {
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* Backdrop — tapping it cancels. */}
      <button
        type="button"
        aria-label={cancelLabel}
        onClick={onCancel}
        className="absolute inset-0 bg-black/60"
      />

      <div className="relative w-full max-w-sm rounded-2xl border border-neutral-800 bg-neutral-900 p-6 shadow-xl">
        <p className="text-center text-lg text-white">{message}</p>
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border border-neutral-700 px-4 py-3 text-base font-medium text-neutral-200 hover:bg-neutral-800 active:bg-neutral-700"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 rounded-xl bg-red-700 px-4 py-3 text-base font-medium text-white hover:bg-red-800 active:bg-red-900"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
