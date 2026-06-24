// Cryptographically secure, unbiased array shuffle. No React, no UI.
// Source of truth: specs/spec.md (FR-7) and specs/plan.md.
// HARD RULE (CLAUDE.md): never use Math.random for anything affecting fairness.

/**
 * Return a uniformly random integer in [0, maxInclusive] using the OS CSPRNG.
 *
 * A single Uint32 gives us a value in [0, 2^32). We map it into [0, range) with
 * modulo, but plain modulo is biased unless range divides 2^32 evenly: the first
 * `2^32 % range` values would each appear once more than the rest. To remove that
 * bias we reject any draw that lands in that uneven tail and try again, so every
 * remaining value is equally likely (rejection sampling).
 */
function randomIntInclusive(maxInclusive: number): number {
  const range = maxInclusive + 1; // number of distinct outcomes we want
  // Largest multiple of `range` that fits in 2^32; draws at/after it are the
  // biased tail and get rejected.
  const limit = Math.floor(0x1_0000_0000 / range) * range;
  const buf = new Uint32Array(1);
  let value: number;
  do {
    crypto.getRandomValues(buf);
    value = buf[0];
  } while (value >= limit);
  return value % range;
}

/**
 * Fisher–Yates shuffle. Returns a NEW array; the input is not mutated.
 * Generic — shuffles any array. Each ordering is equally likely because every
 * swap index comes from the unbiased CSPRNG draw above.
 */
export function secureShuffle<T>(items: readonly T[]): T[] {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomIntInclusive(i); // uniform in [0, i]
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
