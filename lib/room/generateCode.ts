// Pure: a cryptographically secure 6-digit numeric room code (leading zeros allowed).
// No Firebase, no React. Uses crypto.getRandomValues with rejection sampling so each
// digit is uniform 0–9 (no modulo bias) — never Math.random (CLAUDE.md).

export const ROOM_CODE_LENGTH = 6;

export function generateRoomCode(): string {
  const bytes = new Uint8Array(ROOM_CODE_LENGTH);
  let code = "";
  while (code.length < ROOM_CODE_LENGTH) {
    crypto.getRandomValues(bytes);
    for (let i = 0; i < bytes.length; i++) {
      const b = bytes[i];
      // 250 = floor(256 / 10) * 10; reject the top 6 values so 0–9 stay equally likely.
      if (b >= 250) continue;
      code += (b % 10).toString();
      if (code.length === ROOM_CODE_LENGTH) break;
    }
  }
  return code;
}
