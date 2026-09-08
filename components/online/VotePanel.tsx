"use client";

// Public day-vote panel (spec-2b FR-10, D2, D7). Shows every living player plus "Skip",
// each with its LIVE vote count (votes are public — anyone can recompute the tally).
// When `canVote`, tapping a row casts/changes the viewer's own vote and highlights it;
// eliminated players (and anyone else) can pass `canVote={false}` to get the same tally
// read-only, with no controls (FR-17 — dead can't vote, enforced by the rules too).

import { SKIP_VOTE } from "@/lib/room/types";

export function VotePanel({
  targets,
  tally,
  myVoteUid,
  canVote,
  onVote,
}: {
  targets: { uid: string; name: string }[];
  tally: Record<string, number>;
  myVoteUid: string | null;
  canVote: boolean;
  onVote?: (targetUid: string) => void;
}) {
  const rows = [...targets, { uid: SKIP_VOTE, name: "Skip" }];

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
      <p className="text-center text-sm font-semibold uppercase tracking-wide text-neutral-300">
        {canVote ? "Vote to eliminate" : "Live tally"}
      </p>

      <ul className="mt-3 flex flex-col gap-1">
        {rows.map((r) => {
          const count = tally[r.uid] ?? 0;
          const selected = r.uid === myVoteUid;
          const content = (
            <>
              <span className="truncate">{r.name}</span>
              <span className="ml-3 flex shrink-0 items-center gap-2">
                <span className="tabular-nums text-neutral-300">
                  {count} vote{count === 1 ? "" : "s"}
                </span>
                {selected && <span className="text-xs">✓</span>}
              </span>
            </>
          );

          return (
            <li key={r.uid}>
              {canVote ? (
                <button
                  type="button"
                  onClick={() => onVote?.(r.uid)}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-medium ${
                    selected
                      ? "bg-emerald-700 text-white"
                      : "bg-neutral-950 text-neutral-200 hover:bg-neutral-800"
                  }`}
                >
                  {content}
                </button>
              ) : (
                <div className="flex items-center justify-between rounded-lg bg-neutral-950 px-3 py-2 text-sm font-medium text-neutral-200">
                  {content}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
