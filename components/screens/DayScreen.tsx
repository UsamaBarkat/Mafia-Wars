"use client";

// Day voting screen (spec-2b FR-10, D2, D7). Every ALIVE player votes publicly for a
// living player or Skip; the tally is live and visible to everyone (votes are public —
// anyone can recompute it, D2), and a vote can be changed until the moderator ends the
// day (task 8). Eliminated players see the same live tally plus the alive/dead roster,
// but get no vote controls (FR-17, task 10's SpectatorView).

import { useGame } from "@/components/GameProvider";
import { useAuthUid } from "@/lib/useAuthUid";
import { useGameState, useRoomPlayers, useRoomVotes } from "@/lib/room/subscriptions";
import { castVote } from "@/lib/game/castVote";
import { roomPaths } from "@/lib/room/paths";
import { VotePanel } from "@/components/online/VotePanel";
import { Chat } from "@/components/online/Chat";
import { SpectatorView } from "@/components/screens/SpectatorView";

export function DayScreen() {
  const { state } = useGame();
  const { uid } = useAuthUid();
  const code = state.roomCode;

  const game = useGameState(code);
  const players = useRoomPlayers(code);
  const round = game.data?.round ?? null;
  const votes = useRoomVotes(code, round);

  const iAmAlive = uid ? players.data?.[uid]?.alive === true : false;

  if (round === null) {
    return (
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4 text-center text-sm text-neutral-400">
        Loading…
      </div>
    );
  }

  const targets = Object.entries(players.data ?? {})
    .filter(([, p]) => p.alive === true)
    .map(([targetUid, p]) => ({ uid: targetUid, name: p.name }));

  const tally: Record<string, number> = {};
  for (const vote of Object.values(votes.data ?? {})) {
    tally[vote.targetUid] = (tally[vote.targetUid] ?? 0) + 1;
  }

  const myVoteUid = uid ? (votes.data?.[uid]?.targetUid ?? null) : null;

  const handleVote = (targetUid: string) => {
    if (!code || !uid || round === null) return;
    castVote(code, round, uid, targetUid).catch((e) =>
      console.error("castVote failed:", e),
    );
  };

  return (
    <div className="flex flex-col gap-3">
      {!iAmAlive && <SpectatorView />}
      <VotePanel
        targets={targets}
        tally={tally}
        myVoteUid={myVoteUid}
        canVote={iAmAlive}
        onVote={handleVote}
      />
      {/* Day chat (spec-2c FR-6..FR-9) — every room member reads it; only the living can
          post. Eliminated players get the same read-only treatment VotePanel already
          gives them above, just for chat instead of votes. */}
      {code && (
        <Chat
          path={roomPaths.dayChat(code)}
          uid={uid}
          name={state.onlineName || "Player"}
          canPost={iAmAlive}
          label="Day Discussion"
        />
      )}
    </div>
  );
}
