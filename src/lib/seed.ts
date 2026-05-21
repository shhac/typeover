/*
 * Tiny deterministic PRNG so the same seed always picks the same
 * generator instance. We don't need cryptographic quality — we need
 * "open exercise X with attempt N, always see the same instance."
 *
 * xmur3 string hash → mulberry32 PRNG. Both are public-domain
 * one-liners well-suited to this purpose.
 */

export function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

export function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Returns a deterministic 0..1 random source from a string seed. */
export function rngFromSeed(seed: string): () => number {
  const hash = xmur3(seed);
  return mulberry32(hash());
}

/** Pick one element from an array, deterministic per seed. */
export function pickFrom<T>(rng: () => number, items: readonly T[]): T {
  if (items.length === 0) {
    throw new Error("pickFrom called with empty array");
  }
  return items[Math.floor(rng() * items.length)]!;
}

/** Return a shuffled copy of `items` using a deterministic RNG
 *  (Fisher-Yates). Source is not mutated. */
export function shuffle<T>(rng: () => number, items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}
