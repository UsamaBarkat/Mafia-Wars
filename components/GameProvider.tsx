"use client";

// Single in-memory game-state layer for the whole app (React context + useReducer).
// No persistence — nothing is written to localStorage/cookies/server, so a refresh
// resets everything to defaults (specs/spec.md Edge Cases, specs/plan.md "State").

import { createContext, useContext, useMemo, useReducer } from "react";
import {
  createCustomRole,
  createDefaultRoles,
  CUSTOM_NAME_MAX,
  type Role,
} from "@/lib/roles";
import { buildAssignment } from "@/lib/assignment";
import { evaluateSetup } from "@/lib/validation";
import { saveRoomSession, clearRoomSession } from "@/lib/room/session";

export type Screen =
  | "home"
  | "configure"
  | "reveal"
  | "allDone"
  | "onlineMode"
  | "waitingRoom";

export type GameState = {
  screen: Screen;
  /** Editable on Home, in memory only, default "Host" (FR-1). */
  hostName: string;
  /** Standard + custom roles, in display order. */
  roles: Role[];
  /** Role name per player slot, set by START; null when not revealing. */
  assignment: string[] | null;
  /** Which player the reveal is on (0-based). */
  revealIndex: number;
  /** Whether the current player's role is currently shown vs hidden (FR-8). */
  revealShown: boolean;
  // --- Online (Phase 2 / 2a) ---
  /** Current online room code, or null when not in an online room. */
  roomCode: string | null;
  /** Whether this device is the room's (non-playing) moderator. */
  isModerator: boolean;
  /** Name entered for online play (persists across visits like hostName). */
  onlineName: string;
};

function createInitialState(): GameState {
  return {
    screen: "home",
    hostName: "Host",
    roles: createDefaultRoles(),
    assignment: null,
    revealIndex: 0,
    revealShown: false,
    roomCode: null,
    isModerator: false,
    onlineName: "",
  };
}

type Action =
  | { type: "SET_HOST_NAME"; name: string }
  | { type: "CHANGE_ROLE_COUNT"; id: string; delta: 1 | -1 }
  | { type: "ADD_CUSTOM_ROLE"; name: string }
  | { type: "REMOVE_CUSTOM_ROLE"; id: string }
  | { type: "START" }
  | { type: "REVEAL_CURRENT" }
  | { type: "NEXT_PLAYER" }
  | { type: "GO_HOME" }
  | { type: "GO_CONFIGURE" }
  | { type: "GO_ONLINE_MODE" }
  | { type: "ENTER_WAITING_ROOM"; code: string; isModerator: boolean; name: string };

/** Normalised form used for the case-insensitive, trimmed duplicate check (FR-6). */
function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case "SET_HOST_NAME":
      return { ...state, hostName: action.name };

    case "CHANGE_ROLE_COUNT":
      return {
        ...state,
        roles: state.roles.map((role) => {
          if (role.id !== action.id) return role;
          // Respect the cap and the 0 floor — out-of-range steps are no-ops (FR-4).
          const next = role.count + action.delta;
          if (next < 0 || next > role.cap) return role;
          return { ...role, count: next };
        }),
      };

    case "ADD_CUSTOM_ROLE": {
      // Trim, enforce the 24-char cap, reject empty, block case-insensitive
      // duplicates against standard AND existing custom names (FR-6).
      const name = action.name.trim().slice(0, CUSTOM_NAME_MAX);
      if (name === "") return state;
      const exists = state.roles.some(
        (role) => normalizeName(role.name) === normalizeName(name),
      );
      if (exists) return state;
      return { ...state, roles: [...state.roles, createCustomRole(name)] };
    }

    case "REMOVE_CUSTOM_ROLE":
      // Standard roles can't be removed — only custom ones (FR-6).
      return {
        ...state,
        roles: state.roles.filter(
          (role) => !(role.id === action.id && !role.isStandard),
        ),
      };

    case "START": {
      // Guard at the state layer too, even though START is also disabled in the UI.
      if (!evaluateSetup(state.roles).canStart) return state;
      return {
        ...state,
        screen: "reveal",
        assignment: buildAssignment(state.roles),
        revealIndex: 0,
        revealShown: false,
      };
    }

    case "REVEAL_CURRENT":
      if (state.screen !== "reveal") return state;
      return { ...state, revealShown: true };

    case "NEXT_PLAYER": {
      if (state.assignment === null) return state;
      const isLast = state.revealIndex >= state.assignment.length - 1;
      if (isLast) {
        // After the last player: All Done. Drop the assignment so no role data lingers.
        return {
          ...state,
          screen: "allDone",
          assignment: null,
          revealIndex: 0,
          revealShown: false,
        };
      }
      // Advance and hide again (a revealed role is hidden the moment Next is tapped — FR-9).
      return { ...state, revealIndex: state.revealIndex + 1, revealShown: false };
    }

    case "GO_HOME":
      // Ends any in-progress reveal/online room and returns Home; role config, host name,
      // and online name persist for the session (FR-11, Edge Cases). Used by reveal exit,
      // All Done, and leaving online.
      return {
        ...state,
        screen: "home",
        assignment: null,
        revealIndex: 0,
        revealShown: false,
        roomCode: null,
        isModerator: false,
      };

    case "GO_CONFIGURE":
      return { ...state, screen: "configure" };

    case "GO_ONLINE_MODE":
      return { ...state, screen: "onlineMode" };

    case "ENTER_WAITING_ROOM":
      return {
        ...state,
        screen: "waitingRoom",
        roomCode: action.code,
        isModerator: action.isModerator,
        onlineName: action.name,
      };

    default:
      return state;
  }
}

type GameContextValue = {
  state: GameState;
  /** Derived, never stored: sum of all role counts (FR-5). */
  totalPlayers: number;
  /** Derived via evaluateSetup: whether START is allowed and, if not, why. */
  canStart: boolean;
  disabledReason: string | null;
  actions: {
    setHostName: (name: string) => void;
    incRole: (id: string) => void;
    decRole: (id: string) => void;
    addCustomRole: (name: string) => void;
    removeCustomRole: (id: string) => void;
    start: () => void;
    revealCurrent: () => void;
    nextPlayer: () => void;
    endReveal: () => void;
    goHome: () => void;
    goConfigure: () => void;
    goOnlineMode: () => void;
    enterWaitingRoom: (args: {
      code: string;
      isModerator: boolean;
      name: string;
    }) => void;
  };
};

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, createInitialState);

  const value = useMemo<GameContextValue>(() => {
    const totalPlayers = state.roles.reduce((sum, role) => sum + role.count, 0);
    const { canStart, reason } = evaluateSetup(state.roles);
    return {
      state,
      totalPlayers,
      canStart,
      disabledReason: reason,
      actions: {
        setHostName: (name) => dispatch({ type: "SET_HOST_NAME", name }),
        incRole: (id) => dispatch({ type: "CHANGE_ROLE_COUNT", id, delta: 1 }),
        decRole: (id) => dispatch({ type: "CHANGE_ROLE_COUNT", id, delta: -1 }),
        addCustomRole: (name) => dispatch({ type: "ADD_CUSTOM_ROLE", name }),
        removeCustomRole: (id) => dispatch({ type: "REMOVE_CUSTOM_ROLE", id }),
        start: () => dispatch({ type: "START" }),
        revealCurrent: () => dispatch({ type: "REVEAL_CURRENT" }),
        nextPlayer: () => dispatch({ type: "NEXT_PLAYER" }),
        // Reveal exit and All Done both return Home (FR-11).
        endReveal: () => dispatch({ type: "GO_HOME" }),
        goHome: () => {
          clearRoomSession(); // leaving the room ends the reconnect hint
          dispatch({ type: "GO_HOME" });
        },
        goConfigure: () => dispatch({ type: "GO_CONFIGURE" }),
        goOnlineMode: () => dispatch({ type: "GO_ONLINE_MODE" }),
        enterWaitingRoom: ({ code, isModerator, name }) => {
          // Persist a reconnect hint (code + role + name only — no secrets).
          saveRoomSession({ code, isModerator, name });
          dispatch({ type: "ENTER_WAITING_ROOM", code, isModerator, name });
        },
      },
    };
  }, [state]);

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

/** Access the game state + actions. Throws if used outside <GameProvider>. */
export function useGame(): GameContextValue {
  const value = useContext(GameContext);
  if (value === null) {
    throw new Error("useGame must be used within a GameProvider");
  }
  return value;
}
