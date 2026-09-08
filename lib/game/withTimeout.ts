// Shared timeout guard for the resolver's network calls (resolveNightOnClient.ts,
// resolveDayOnClient.ts). Without it, a stalled read/write (a dropped connection, a
// backgrounded tab resuming with a stale socket — conditions real multi-device play hits
// that the always-local emulator doesn't) leaves the returned promise neither resolved
// nor rejected forever. The moderator's "End Night"/"End Day" button then hangs on
// "Resolving…" with no error, since the caller's catch block never fires for a promise
// that never settles. Timing out turns that silent hang into a thrown error the existing
// catch already logs and recovers from.

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
