"use client";

// Cupid's Night-1 lover picker (spec-2d FR-7/8). Tap two different players (never
// yourself — the caller passes targets that already exclude Cupid), then "Link lovers"
// opens a confirm because the link is final (D3): the Security Rules make it write-once.

import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

export function CupidPicker({
  targets,
  onConfirm,
}: {
  targets: { uid: string; name: string }[];
  onConfirm: (firstUid: string, secondUid: string) => void;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const [confirming, setConfirming] = useState(false);

  // Tapping a picked player un-picks them; a third pick replaces the oldest one.
  const toggle = (uid: string) =>
    setPicked((prev) =>
      prev.includes(uid) ? prev.filter((p) => p !== uid) : [...prev, uid].slice(-2),
    );

  const nameOf = (uid: string) => targets.find((t) => t.uid === uid)?.name ?? "?";

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
      <p className="text-center text-sm font-semibold uppercase tracking-wide text-neutral-300">
        Choose two lovers
      </p>
      <p className="mt-1 text-center text-xs text-neutral-500">
        If one of them dies, so does the other. You can only do this once.
      </p>

      <ul className="mt-3 flex flex-col gap-1">
        {targets.map((t) => {
          const selected = picked.includes(t.uid);
          return (
            <li key={t.uid}>
              <button
                type="button"
                onClick={() => toggle(t.uid)}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-medium ${
                  selected
                    ? "bg-emerald-700 text-white"
                    : "bg-neutral-950 text-neutral-200 hover:bg-neutral-800"
                }`}
              >
                <span className="truncate">{t.name}</span>
                {selected && <span className="ml-3 shrink-0 text-xs">💘 picked</span>}
              </button>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={() => setConfirming(true)}
        disabled={picked.length !== 2}
        className="mt-3 w-full rounded-xl bg-emerald-600 px-6 py-3 text-base font-bold uppercase tracking-wide text-white hover:bg-emerald-700 active:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-emerald-600"
      >
        Link lovers
      </button>

      {confirming && picked.length === 2 && (
        <ConfirmDialog
          message={`Link ${nameOf(picked[0])} and ${nameOf(picked[1])} as lovers? This can't be changed.`}
          confirmLabel="Link"
          cancelLabel="Cancel"
          onConfirm={() => {
            setConfirming(false);
            onConfirm(picked[0], picked[1]);
          }}
          onCancel={() => setConfirming(false)}
        />
      )}
    </div>
  );
}
