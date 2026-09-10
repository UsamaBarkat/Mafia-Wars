"use client";

// Night action screen (spec-2b FR-3/4/5). Each ALIVE role-holder submits their secret
// night choice; Civilians/custom roles (no night power — D1) see a wait state. A
// submitted choice writes nightActions/{uid}, readable by that uid and the moderator only
// (task-2 rules) — no other player can see it. A player who never submits is simply
// treated as taking no action (FR-5) when the moderator resolves the night (task 6).

import { useGame } from "@/components/GameProvider";
import { useAuthUid } from "@/lib/useAuthUid";
import {
  useGameState,
  useMyMafiaTeam,
  useMyNightAction,
  useMyRole,
  useRoomPlayers,
  useTeammateNightActions,
} from "@/lib/room/subscriptions";
import { submitNightAction } from "@/lib/game/submitNightAction";
import { roomPaths } from "@/lib/room/paths";
import { NightAction } from "@/components/online/NightAction";
import { Chat } from "@/components/online/Chat";
import { SpectatorView } from "@/components/screens/SpectatorView";
import type { NightActionKind } from "@/lib/room/types";

// Role NAMES exactly as dealt into privateRoles (must match lib/roles.ts's defaults).
const MAFIA = "Mafia";
const DOCTOR = "Doctor";
const DETECTIVE = "Detective";

export function NightScreen() {
  const { state } = useGame();
  const { uid } = useAuthUid();
  const code = state.roomCode;

  const game = useGameState(code);
  const players = useRoomPlayers(code);
  const myRole = useMyRole(code, uid);
  const myMafiaTeam = useMyMafiaTeam(code, uid);
  const round = game.data?.round ?? null;
  const myAction = useMyNightAction(code, round, uid);
  // Called unconditionally (before any early return below) per rules of hooks — a
  // no-op for non-Mafia, since myMafiaTeam.data is only ever populated for Mafia.
  const mateUids = myMafiaTeam.data?.mates ?? [];
  const teammateActions = useTeammateNightActions(code, round, mateUids);

  const role = myRole.data?.role ?? null;
  const iAmAlive = uid ? players.data?.[uid]?.alive === true : false;

  // A dead player has no night controls at all (rules-enforced) — they get the alive/dead
  // roster instead (night/day outcomes already show above this, in OnlineRevealScreen).
  if (!iAmAlive) {
    return <SpectatorView />;
  }

  if (round === null || role === null) {
    return (
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4 text-center text-sm text-neutral-400">
        Loading…
      </div>
    );
  }

  // Every living player is a valid target. Doctor may include themselves (self-protect is
  // explicitly allowed — Edge Cases); Mafia and Detective exclude themselves — a Mafia
  // can't eliminate themselves, and investigating your own already-known role is moot.
  const allLivingTargets = Object.entries(players.data ?? {})
    .filter(([, p]) => p.alive === true)
    .map(([targetUid, p]) => ({ uid: targetUid, name: p.name }));
  const targetsExcludingSelf = allLivingTargets.filter((t) => t.uid !== uid);

  const handleSubmit = (action: NightActionKind, targetUid: string) => {
    if (!code || !uid) return;
    submitNightAction(code, round, uid, role, action, targetUid).catch((e) =>
      console.error("submitNightAction failed:", e),
    );
  };

  if (role === MAFIA) {
    const mateUidSet = new Set(mateUids);
    const mateNames = [...mateUidSet]
      .map((mateUid) => players.data?.[mateUid]?.name)
      .filter((name): name is string => Boolean(name));
    // Kill targets exclude self (targetsExcludingSelf) AND fellow Mafia — a Mafia has no
    // reason to eliminate their own team, mirroring the self-target exclusion's reasoning.
    const killTargets = targetsExcludingSelf.filter((t) => !mateUidSet.has(t.uid));

    // Live "haven't agreed" warning (spec-2b D6 revision, post-2c playtesting): the kill
    // now requires every Mafia to submit the SAME target (resolveNight.ts), so surface a
    // mismatch as soon as it's visible instead of letting it be a surprise at resolution.
    // Only counts targets we actually know about — a teammate who hasn't submitted yet
    // isn't "disagreeing," just not decided (mirrors resolveNight's own treatment of a
    // non-submitting Mafia as agreement, not a vote against).
    const myTarget = myAction.data?.targetUid ?? null;
    const teammateKillTargets = Object.values(teammateActions)
      .filter((a) => a.action === "kill")
      .map((a) => a.targetUid);
    const knownTargets = new Set(myTarget ? [myTarget, ...teammateKillTargets] : []);
    const targetsDisagree = knownTargets.size > 1;

    return (
      <div className="flex flex-col gap-3">
        {mateNames.length > 0 && (
          <p className="text-center text-xs text-neutral-400">
            Your fellow Mafia: <span className="text-white">{mateNames.join(", ")}</span>
          </p>
        )}
        <NightAction
          heading="Choose who to eliminate"
          targets={killTargets}
          submittedUid={myAction.data?.targetUid ?? null}
          onSubmit={(targetUid) => handleSubmit("kill", targetUid)}
        />
        {targetsDisagree && (
          <p className="rounded-xl border border-amber-700 bg-amber-950/40 px-3 py-2 text-center text-sm text-amber-300">
            You and your fellow Mafia haven&apos;t agreed on a target — no one will die
            tonight unless you match.
          </p>
        )}
        {/* Mafia-only chat (spec-2c FR-1..FR-5) — only Mafia ever reach this branch, and
            only while alive (the dead-player check above already returned SpectatorView),
            so no extra gating is needed here beyond what the rules already enforce. */}
        {code && (
          <Chat
            path={roomPaths.mafiaChat(code)}
            uid={uid}
            name={state.onlineName || "Player"}
            canPost
            label="Mafia Chat"
          />
        )}
      </div>
    );
  }

  if (role === DOCTOR) {
    return (
      <NightAction
        heading="Choose who to protect"
        subtext="You may protect yourself."
        targets={allLivingTargets}
        submittedUid={myAction.data?.targetUid ?? null}
        onSubmit={(targetUid) => handleSubmit("protect", targetUid)}
      />
    );
  }

  if (role === DETECTIVE) {
    return (
      <NightAction
        heading="Choose who to investigate"
        targets={targetsExcludingSelf}
        submittedUid={myAction.data?.targetUid ?? null}
        onSubmit={(targetUid) => handleSubmit("investigate", targetUid)}
      />
    );
  }

  // Civilians and custom roles have no night power (D1) — they wait.
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4 text-center text-sm text-neutral-400">
      No action tonight — waiting for the night to end…
    </div>
  );
}
