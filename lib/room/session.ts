// Client-side room-session persistence for reconnect-on-refresh (D3, FR-17). No server
// session, so we stash a tiny hint in sessionStorage (survives refresh, clears on tab
// close = one session). NEVER store secret/role data here — only the room code, whether
// this device is the moderator, and the display name. Membership + moderator status are
// re-verified against RTDB on restore; this is just a hint for which room to rejoin.

const KEY = "mafiaWars.roomSession";

export type RoomSession = {
  code: string;
  isModerator: boolean;
  name: string;
};

export function saveRoomSession(session: RoomSession): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    /* storage unavailable (SSR / private mode) — ignore */
  }
}

export function loadRoomSession(): RoomSession | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RoomSession>;
    if (typeof parsed?.code !== "string") return null;
    return {
      code: parsed.code,
      isModerator: parsed.isModerator === true,
      name: typeof parsed.name === "string" ? parsed.name : "",
    };
  } catch {
    return null;
  }
}

export function clearRoomSession(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
