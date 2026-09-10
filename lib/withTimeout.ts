// Shared timeout guard for room/game network calls (resolveNightOnClient.ts,
// resolveDayOnClient.ts, resetForPlayAgain.ts). Without it, a stalled read/write (a
// dropped connection, a backgrounded tab resuming with a stale socket — conditions real
// multi-device play hits that the always-local emulator doesn't) leaves the returned
// promise neither resolved nor rejected forever. The moderator's "End Night"/"End
// Day"/"Play Again" button then hangs with no error, since the caller's catch block
// never fires for a promise that never settles. Timing out turns that silent hang into a
// thrown error the existing catch already logs and recovers from.
//
// Lives at the top of lib/ (not under lib/game/ or lib/room/) because it's used by both —
// lib/game/* already depends on lib/room/* for paths/types, so this stays neutral rather
// than creating the first backwards (room -> game) import in the codebase.

export const RESOLVE_TIMEOUT_MS = 15_000;

export function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(
        new Error(
          `${label} timed out after ${RESOLVE_TIMEOUT_MS}ms — the connection may have stalled`,
        ),
      );
    }, RESOLVE_TIMEOUT_MS);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
