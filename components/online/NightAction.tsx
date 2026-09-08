"use client";

// Reusable "pick a living player" control for the night phase — Mafia kill / Doctor
// protect / Detective investigate all share this shape (spec-2b FR-3). Tapping a target
// submits immediately; the current submission (if any) stays highlighted and can be
// changed by tapping a different target (submitNightAction overwrites the prior choice).

export function NightAction({
  heading,
  subtext,
  targets,
  submittedUid,
  onSubmit,
}: {
  heading: string;
  subtext?: string;
  targets: { uid: string; name: string }[];
  submittedUid: string | null;
  onSubmit: (targetUid: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
      <p className="text-center text-sm font-semibold uppercase tracking-wide text-neutral-300">
        {heading}
      </p>
      {subtext && (
        <p className="mt-1 text-center text-xs text-neutral-500">{subtext}</p>
      )}

      {targets.length === 0 ? (
        <p className="mt-3 text-center text-sm text-neutral-500">
          No living players to choose.
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-1">
          {targets.map((t) => {
            const selected = t.uid === submittedUid;
            return (
              <li key={t.uid}>
                <button
                  type="button"
                  onClick={() => onSubmit(t.uid)}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-medium ${
                    selected
                      ? "bg-emerald-700 text-white"
                      : "bg-neutral-950 text-neutral-200 hover:bg-neutral-800"
                  }`}
                >
                  <span className="truncate">{t.name}</span>
                  {selected && (
                    <span className="ml-3 shrink-0 text-xs">✓ chosen</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
