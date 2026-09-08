"use client";

// Real-time subscription hooks for a room. Each subscribes to one RTDB path via
// onValue, returns { data, loading, error }, and cleans up its listener on unmount or
// when the path changes (no leaked or duplicate listeners). A missing/removed room
// surfaces as data === null (not an error). Data-layer only — no UI.
//
// Note: useMyRole subscribes ONLY to the caller's own privateRole path; reading the
// parent privateRoles node is denied by the Security Rules (task 7), by design.

import { useEffect, useState } from "react";
import { limitToLast, onValue, query, ref } from "firebase/database";
import { db } from "@/lib/firebase";
import { roomPaths } from "./paths";
import type {
  ChatMessage,
  DayOutcome,
  Game,
  MafiaTeamEntry,
  NightAction,
  NightOutcome,
  NightResult,
  PlayerEntry,
  PrivateRoleEntry,
  PublicRoles,
  RoomMeta,
  Vote,
} from "./types";
import type { Role } from "@/lib/roles";

export type Subscription<T> = {
  /** Current value, or null when the node doesn't exist (or path is inactive). */
  data: T | null;
  /** True until the first snapshot (or error) arrives for an active path. */
  loading: boolean;
  /** Set if the listener was cancelled (e.g. permission denied). */
  error: Error | null;
};

/** Subscribe to a single RTDB path. Pass null to stay inactive (e.g. no room code yet). */
function useDbValue<T>(path: string | null): Subscription<T> {
  const [state, setState] = useState<Subscription<T>>({
    data: null,
    loading: path !== null,
    error: null,
  });

  useEffect(() => {
    if (path === null) {
      setState({ data: null, loading: false, error: null });
      return;
    }

    setState({ data: null, loading: true, error: null });
    const nodeRef = ref(db, path);
    const unsubscribe = onValue(
      nodeRef,
      (snap) => {
        setState({
          data: snap.exists() ? (snap.val() as T) : null,
          loading: false,
          error: null,
        });
      },
      (err) => {
        setState({ data: null, loading: false, error: err });
      },
    );

    return () => unsubscribe();
  }, [path]);

  return state;
}

/** Room meta (status, moderatorId, timestamps). */
export function useRoomMeta(code: string | null): Subscription<RoomMeta> {
  return useDbValue<RoomMeta>(code ? roomPaths.meta(code) : null);
}

/** Player roster keyed by uid (names + connected/presence), updating live. */
export function useRoomPlayers(
  code: string | null,
): Subscription<Record<string, PlayerEntry>> {
  return useDbValue<Record<string, PlayerEntry>>(
    code ? roomPaths.players(code) : null,
  );
}

/** Configured roles keyed by role id. */
export function useRoomRoles(
  code: string | null,
): Subscription<Record<string, Role>> {
  return useDbValue<Record<string, Role>>(
    code ? roomPaths.configRoles(code) : null,
  );
}

/** Live game state — phase/round/winner (null before the moderator begins Night 1). */
export function useGameState(code: string | null): Subscription<Game> {
  return useDbValue<Game>(code ? roomPaths.game(code) : null);
}

/** This client's OWN dealt role only (never the parent node). */
export function useMyRole(
  code: string | null,
  uid: string | null,
): Subscription<PrivateRoleEntry> {
  return useDbValue<PrivateRoleEntry>(
    code && uid ? roomPaths.privateRole(code, uid) : null,
  );
}

/** This client's OWN fellow-Mafia list (absent for non-Mafia, or a solo Mafia — task 4). */
export function useMyMafiaTeam(
  code: string | null,
  uid: string | null,
): Subscription<MafiaTeamEntry> {
  return useDbValue<MafiaTeamEntry>(
    code && uid ? roomPaths.mafiaTeamEntry(code, uid) : null,
  );
}

/** ALL of a round's night actions — moderator-only per the rules (task 2's parent `.read`).
 *  For a live "X of Y acted" indicator; never shows WHO chose WHAT in the UI (FR-16). */
export function useNightActions(
  code: string | null,
  round: number | null,
): Subscription<Record<string, NightAction>> {
  return useDbValue<Record<string, NightAction>>(
    code && round !== null ? roomPaths.nightActions(code, round) : null,
  );
}

/** This client's OWN night action for a round only — never another player's (rules). */
export function useMyNightAction(
  code: string | null,
  round: number | null,
  uid: string | null,
): Subscription<NightAction> {
  return useDbValue<NightAction>(
    code && round !== null && uid ? roomPaths.nightAction(code, round, uid) : null,
  );
}

/** PUBLIC night outcome for a round — who died, or no one (never a role, D8). Absent
 *  until the moderator resolves the night. */
export function useNightOutcome(
  code: string | null,
  round: number | null,
): Subscription<NightOutcome> {
  return useDbValue<NightOutcome>(
    code && round !== null ? roomPaths.nightOutcome(code, round) : null,
  );
}

/** This client's OWN private night result (e.g. the Detective's finding) — own only. */
export function useMyNightResult(
  code: string | null,
  round: number | null,
  uid: string | null,
): Subscription<NightResult> {
  return useDbValue<NightResult>(
    code && round !== null && uid ? roomPaths.nightResult(code, round, uid) : null,
  );
}

/** PUBLIC day outcome for a round — who was eliminated, or no one (never a role, D8).
 *  Absent until the moderator resolves the day. */
export function useDayOutcome(
  code: string | null,
  round: number | null,
): Subscription<DayOutcome> {
  return useDbValue<DayOutcome>(
    code && round !== null ? roomPaths.dayOutcome(code, round) : null,
  );
}

/** PUBLIC uid->role reveal — absent until the game ends (FR-15, D8). */
export function usePublicRoles(code: string | null): Subscription<PublicRoles> {
  return useDbValue<PublicRoles>(code ? roomPaths.publicRoles(code) : null);
}

/** ALL of a round's PUBLIC day votes, keyed by voter uid — visible to every room member
 *  (D2), so the tally can be computed live by anyone, not just the moderator. */
export function useRoomVotes(
  code: string | null,
  round: number | null,
): Subscription<Record<string, Vote>> {
  return useDbValue<Record<string, Vote>>(
    code && round !== null ? roomPaths.votes(code, round) : null,
  );
}

export type ChatMessageWithId = ChatMessage & { id: string };

/**
 * The most recent chat messages (oldest→newest), capped at `max` via limitToLast so a
 * room only ever pulls a bounded window (FR-9). Each carries its push-key `id`.
 */
export function useRoomChat(
  code: string | null,
  max = 50,
): Subscription<ChatMessageWithId[]> {
  const [state, setState] = useState<Subscription<ChatMessageWithId[]>>({
    data: null,
    loading: code !== null,
    error: null,
  });

  useEffect(() => {
    if (!code) {
      setState({ data: null, loading: false, error: null });
      return;
    }

    setState({ data: null, loading: true, error: null });
    const chatQuery = query(ref(db, roomPaths.chat(code)), limitToLast(max));
    const unsubscribe = onValue(
      chatQuery,
      (snap) => {
        const messages: ChatMessageWithId[] = [];
        snap.forEach((child) => {
          messages.push({ ...(child.val() as ChatMessage), id: child.key as string });
        });
        setState({ data: messages, loading: false, error: null });
      },
      (err) => setState({ data: null, loading: false, error: err }),
    );

    return () => unsubscribe();
  }, [code, max]);

  return state;
}
