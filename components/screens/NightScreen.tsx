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
} from "@/lib/room/subscriptions";
import { submitNightAction } from "@/lib/game/submitNightAction";
import { NightAction } from "@/components/online/NightAction";
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
    const mateNames = (myMafiaTeam.data?.mates ?? [])
      .map((mateUid) => players.data?.[mateUid]?.name)
      .filter((name): name is string => Boolean(name));
    return (
      <div className="flex flex-col gap-3">
        {mateNames.length > 0 && (
          <p className="text-center text-xs text-neutral-400">
            Your fellow Mafia: <span className="text-white">{mateNames.join(", ")}</span>
          </p>
        )}
        <NightAction
          heading="Choose who to eliminate"
          targets={targetsExcludingSelf}
          submittedUid={myAction.data?.targetUid ?? null}
          onSubmit={(targetUid) => handleSubmit("kill", targetUid)}
        />
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
